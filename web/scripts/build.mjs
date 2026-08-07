import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const contentRoot = resolve(root, 'content');
const diagramRoot = resolve(root, '../design/diagrams');
const diagramModelRoot = resolve(diagramRoot, 'models');
const diagramBuildRoot = resolve(dist, '.diagram-build');
const projectUrl = process.env.PINEGA_WEB_AWESOME_PROJECT_URL ?? '';
const siteOrigin = normalizeSiteOrigin(process.env.PINEGA_SITE_ORIGIN ?? 'https://pinega.example');
const documentationSections = [
  ['start', 'Start', 'Orientation and reproducible first paths through the Pinega programme and workspaces.'],
  ['tutorials', 'Tutorials', 'Learning-oriented walkthroughs that build familiarity by doing.'],
  ['how-to', 'How-to', 'Goal-oriented procedures for concrete repository and Web tasks.'],
  ['concepts', 'Concepts', 'Explanations of programme boundaries, architecture, evidence, and engineering rationale.'],
  ['reference', 'Reference', 'Exact repository, environment, command, and metadata contracts.'],
  ['contributing', 'Contributing', 'Review, validation, and release gates for changes to the shared programme workspace.'],
].map(([id, label, description]) => ({ id, label, description }));
const documentationSectionById = new Map(documentationSections.map(section => [section.id, section]));
const contentIndex = validateContentIndex(JSON.parse(await readFile(resolve(contentRoot, 'content-index.json'), 'utf8')));
const pages = contentIndex.entries.map(entry => ({ ...entry, source: entry.source_path, output: entry.output_path }));

await import('../../design/scripts/build-tokens.mjs');
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'assets'), { recursive: true });
await mkdir(diagramBuildRoot, { recursive: true });
const diagrams = await buildSemanticDiagrams();

await build({
  entryPoints: [resolve(root, 'src/main.ts')],
  outdir: resolve(dist, 'assets'),
  bundle: true,
  splitting: true,
  format: 'esm',
  target: ['es2022'],
  sourcemap: true,
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  assetNames: '[name]-[hash]',
  legalComments: 'eof',
  define: { __PINEGA_WEB_AWESOME_PROJECT_URL__: JSON.stringify(projectUrl) },
  logLevel: 'info',
});

for (const page of pages) {
  const source = await readFile(resolve(root, page.source), 'utf8');
  validatePageSource(source, page, contentIndex.primary_navigation);
  let html = source
    .replaceAll('{{SITE_ORIGIN}}', escapeHtml(siteOrigin))
    .replace(
      '<!-- PINEGA_PROJECT_META -->',
      projectUrl ? `<meta name="webawesome-project-url" content="${escapeHtml(projectUrl)}">` : '',
    );
  html = replaceDocumentationPlaceholders(html, page, contentIndex);
  html = replaceDiagramPlaceholders(html, diagrams.figures, page.source);
  const output = resolve(dist, page.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, 'utf8');
}

try {
  await cp(resolve(root, 'static'), dist, { recursive: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
await cp(diagramRoot, resolve(dist, 'diagrams'), { recursive: true });
await cp(contentRoot, resolve(dist, 'content'), { recursive: true });
await writeFile(
  resolve(dist, 'content/documentation-manifest.json'),
  `${JSON.stringify(renderDocumentationManifest(contentIndex.entries), null, 2)}\n`,
  'utf8',
);
await rm(diagramBuildRoot, { recursive: true, force: true });
try {
  await cp(resolve(root, 'node_modules/@awesome.me/webawesome/dist/assets'), resolve(dist, 'assets/webawesome'), { recursive: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const publicRoutes = pages.filter(page => page.sitemap).map(page => page.route);
await writeFile(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n`, 'utf8');
await writeFile(resolve(dist, 'sitemap.xml'), renderSitemap(siteOrigin, publicRoutes), 'utf8');
await writeFile(
  resolve(dist, 'site-manifest.json'),
  `${JSON.stringify({
    origin: siteOrigin,
    site: contentIndex.site,
    primaryNavigation: contentIndex.primary_navigation,
    routes: pages.map(page => ({
      id: page.id,
      route: page.route,
      output: page.output,
      contentType: page.content_type,
      title: page.canonical_title,
      navigationTitle: page.navigation_title,
      summary: page.summary,
      audience: page.audience,
      programme: page.programme,
      researchArea: page.research_area,
      topics: page.topics,
      maturityStatus: page.maturity_status,
      publishedAt: page.published_at,
      updatedAt: page.updated_at,
      authors: page.authors,
      sitemap: page.sitemap,
      searchable: page.searchable,
      structuredDataType: page.structured_data_type,
      public: page.public,
      canonical: page.canonical,
      documentation: page.documentation ?? null,
    })),
    diagrams: diagrams.ids.map(id => ({ id, model: `/diagrams/models/${id}.json` })),
  }, null, 2)}\n`,
  'utf8',
);

console.log(`Built Pinega website at ${dist} with ${pages.length} registered pages and ${diagrams.ids.length} semantic diagrams`);

async function buildSemanticDiagrams() {
  const rendererPath = resolve(diagramBuildRoot, 'renderer.mjs');
  await build({
    entryPoints: [resolve(root, 'src/diagrams/index.ts')],
    outfile: rendererPath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: ['node26'],
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'silent',
  });
  const renderer = await import(`${pathToFileURL(rendererPath).href}?build=${Date.now()}`);
  const files = (await readdir(diagramModelRoot, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));
  const figures = new Map();
  const ids = [];
  for (const entry of files) {
    const model = renderer.validateDiagramModel(JSON.parse(await readFile(resolve(diagramModelRoot, entry.name), 'utf8')));
    const fileId = basename(entry.name, '.json');
    if (model.id !== fileId) throw new TypeError(`Diagram file ${entry.name} declares id ${JSON.stringify(model.id)}`);
    if (figures.has(model.id)) throw new TypeError(`Duplicate diagram id: ${model.id}`);
    figures.set(model.id, renderer.renderDiagramFigure(model));
    ids.push(model.id);
  }
  if (ids.length === 0) throw new TypeError('No semantic diagram models were found');
  return { figures, ids };
}

function validateContentIndex(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('content-index.json must contain an object');
  if (value.schema_version !== 2) throw new TypeError(`Unsupported content index schema: ${JSON.stringify(value.schema_version)}`);
  if (!value.site || typeof value.site !== 'object') throw new TypeError('Content index must define site metadata');
  for (const field of ['name', 'organization', 'tagline', 'summary']) requireString(value.site, field, 'site');
  if (!Array.isArray(value.primary_navigation) || value.primary_navigation.length === 0) throw new TypeError('Content index must define primary_navigation');
  if (!Array.isArray(value.entries) || value.entries.length === 0) throw new TypeError('Content index must define entries');

  const identities = new Set();
  const routes = new Set();
  const sources = new Set();
  const outputs = new Set();
  const documentationPositions = new Set();
  for (const entry of value.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('Every content entry must be an object');
    for (const field of ['id', 'route', 'source_path', 'output_path', 'content_type', 'canonical_title', 'navigation_title', 'summary', 'programme', 'maturity_status', 'updated_at']) requireString(entry, field, entry.id ?? '<unknown>');
    if (!/^[a-z][a-z0-9-]*$/u.test(entry.id)) throw new TypeError(`Invalid content id: ${JSON.stringify(entry.id)}`);
    if (!entry.route.startsWith('/')) throw new TypeError(`${entry.id}: route must start with /`);
    if (entry.route !== '/' && !entry.route.endsWith('/') && !entry.route.endsWith('.html')) throw new TypeError(`${entry.id}: route must end with / or .html`);
    for (const field of ['audience', 'topics', 'authors']) {
      if (!Array.isArray(entry[field]) || entry[field].length === 0 || entry[field].some(value => typeof value !== 'string' || value.trim() === '')) throw new TypeError(`${entry.id}.${field} must be a non-empty string array`);
    }
    for (const flag of ['sitemap', 'searchable', 'public', 'canonical']) if (typeof entry[flag] !== 'boolean') throw new TypeError(`${entry.id}.${flag} must be boolean`);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(entry.updated_at)) throw new TypeError(`${entry.id}: updated_at must use YYYY-MM-DD`);
    if (entry.published_at !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(entry.published_at)) throw new TypeError(`${entry.id}: published_at must be null or YYYY-MM-DD`);
    if (entry.research_area !== null && typeof entry.research_area !== 'string') throw new TypeError(`${entry.id}: research_area must be a string or null`);
    if (entry.structured_data_type !== null && typeof entry.structured_data_type !== 'string') throw new TypeError(`${entry.id}: structured_data_type must be a string or null`);
    if (entry.sitemap && (!entry.public || !entry.canonical)) throw new TypeError(`${entry.id}: sitemap entries must be public and canonical`);
    if (entry.searchable && !entry.public) throw new TypeError(`${entry.id}: searchable entries must be public`);

    const docsRoute = entry.route === '/docs/' || entry.route.startsWith('/docs/');
    if (docsRoute && !entry.documentation) throw new TypeError(`${entry.id}: documentation routes must define documentation metadata`);
    if (!docsRoute && entry.documentation !== undefined) throw new TypeError(`${entry.id}: non-documentation routes must not define documentation metadata`);
    if (entry.documentation) validateDocumentationMetadata(entry, documentationPositions);

    addUnique(identities, entry.id, 'content id');
    addUnique(routes, entry.route, 'route');
    addUnique(sources, entry.source_path, 'source path');
    addUnique(outputs, entry.output_path, 'output path');
  }

  const entriesById = new Map(value.entries.map(entry => [entry.id, entry]));
  for (const entry of value.entries.filter(entry => entry.documentation)) {
    for (const relatedId of entry.documentation.related) {
      if (relatedId === entry.id) throw new TypeError(`${entry.id}: related content cannot reference itself`);
      const related = entriesById.get(relatedId);
      if (!related?.public || !related.canonical) throw new TypeError(`${entry.id}: unknown/non-public related content id ${JSON.stringify(relatedId)}`);
    }
  }

  if (!routes.has('/')) throw new TypeError('Content index must contain the homepage route');
  for (const item of value.primary_navigation) {
    if (!item || typeof item !== 'object' || typeof item.label !== 'string') throw new TypeError('Every primary-navigation item must define a label');
    if ('route' in item) {
      if (!value.entries.find(entry => entry.route === item.route)?.public) throw new TypeError(`Primary navigation route is not public: ${JSON.stringify(item.route)}`);
    } else if ('href' in item) {
      const url = new URL(item.href);
      if (!['https:', 'http:'].includes(url.protocol) || item.external !== true) throw new TypeError(`Invalid external navigation item: ${item.label}`);
    } else throw new TypeError(`Primary navigation item has no route or href: ${item.label}`);
  }
  return value;
}

function validateDocumentationMetadata(entry, positions) {
  const metadata = entry.documentation;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError(`${entry.id}.documentation must be an object`);
  const validSections = new Set(['landing', ...documentationSections.map(section => section.id)]);
  const validPurposes = new Set(['index', 'start', 'tutorial', 'how-to', 'explanation', 'reference', 'contributing']);
  if (!validSections.has(metadata.section)) throw new TypeError(`${entry.id}.documentation.section is invalid`);
  if (!validPurposes.has(metadata.purpose)) throw new TypeError(`${entry.id}.documentation.purpose is invalid`);
  if (!Number.isInteger(metadata.order) || metadata.order < 0) throw new TypeError(`${entry.id}.documentation.order must be a non-negative integer`);
  requireString(metadata, 'applies_to', `${entry.id}.documentation`);
  if (!Array.isArray(metadata.related) || new Set(metadata.related).size !== metadata.related.length) throw new TypeError(`${entry.id}.documentation.related must be a unique array`);
  for (const relatedId of metadata.related) if (typeof relatedId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(relatedId)) throw new TypeError(`${entry.id}.documentation.related contains an invalid content id`);
  if (entry.route === '/docs/') {
    if (metadata.section !== 'landing' || metadata.purpose !== 'index') throw new TypeError('The documentation landing must use section=landing and purpose=index');
  } else {
    if (metadata.section === 'landing' || metadata.purpose === 'index') throw new TypeError(`${entry.id}: nested documentation cannot use landing/index metadata`);
    addUnique(positions, `${metadata.section}:${metadata.order}`, 'documentation section/order position');
  }
  if (!entry.public || !entry.canonical || !entry.searchable) throw new TypeError(`${entry.id}: documentation corpus entries must be public, canonical, and searchable`);
}

function validatePageSource(html, page, primaryNavigation) {
  const title = html.match(/<title>([^<]+)<\/title>/u)?.[1];
  if (title !== page.canonical_title) throw new TypeError(`${page.source}: expected title ${JSON.stringify(page.canonical_title)}, got ${JSON.stringify(title)}`);
  const description = html.match(/<meta name="description" content="([^"]+)">/u)?.[1];
  if (description !== page.summary) throw new TypeError(`${page.source}: meta description does not match the content registry`);
  const pageId = html.match(/<html\b[^>]*\bdata-page="([^"]+)"/u)?.[1];
  if (pageId !== page.id) throw new TypeError(`${page.source}: expected data-page=${JSON.stringify(page.id)}`);
  if ((html.match(/<h1\b/gu) ?? []).length !== 1) throw new TypeError(`${page.source}: every registered page must contain exactly one h1`);
  const canonical = `<link rel="canonical" href="{{SITE_ORIGIN}}${page.route}">`;
  if (page.canonical && !html.includes(canonical)) throw new TypeError(`${page.source}: missing canonical template ${canonical}`);
  if (!page.canonical && /<link rel="canonical"/u.test(html)) throw new TypeError(`${page.source}: non-canonical content must not emit a canonical link`);
  if (page.public) {
    const navigation = html.match(/<nav\b[^>]*data-primary-navigation[^>]*>[\s\S]*?<\/nav>/u)?.[0];
    if (!navigation) throw new TypeError(`${page.source}: missing primary navigation`);
    for (const item of primaryNavigation) {
      const destination = 'route' in item ? item.route : item.href;
      if (!navigation.includes(`href="${destination}"`)) throw new TypeError(`${page.source}: primary navigation is missing ${destination}`);
    }
    if (navigation.includes('/component-lab/')) throw new TypeError(`${page.source}: component lab must not appear in public primary navigation`);
  }
  if (page.documentation?.section === 'landing') {
    for (const marker of ['PINEGA_DOC_COUNT', 'PINEGA_DOC_CATALOGUE']) if (!html.includes(`<!-- ${marker} -->`)) throw new TypeError(`${page.source}: missing ${marker} build marker`);
  } else if (page.documentation) {
    for (const marker of ['PINEGA_DOC_NAV', 'PINEGA_BREADCRUMBS', 'PINEGA_DOC_PROVENANCE']) if (!html.includes(`<!-- ${marker} -->`)) throw new TypeError(`${page.source}: missing ${marker} build marker`);
  }
}

function replaceDocumentationPlaceholders(html, page, index) {
  const docs = getDocumentationEntries(index.entries);
  let output = html;
  if (page.documentation?.section === 'landing') {
    output = output.replace('<!-- PINEGA_DOC_COUNT -->', String(docs.length)).replace('<!-- PINEGA_DOC_CATALOGUE -->', renderDocumentationCatalogue(docs));
  } else if (page.documentation) {
    output = output
      .replace('<!-- PINEGA_DOC_NAV -->', renderDocumentationNavigation(docs, page))
      .replace('<!-- PINEGA_BREADCRUMBS -->', renderDocumentationBreadcrumbs(page))
      .replace('<!-- PINEGA_DOC_PROVENANCE -->', renderDocumentationProvenance(page, index.entries));
  }
  if (/PINEGA_DOC_[A-Z_]+/u.test(output)) throw new TypeError(`${page.source}: unresolved documentation build marker`);
  return output;
}

function getDocumentationEntries(entries) {
  return entries.filter(entry => entry.documentation && entry.documentation.section !== 'landing').toSorted(compareDocumentationEntries);
}

function compareDocumentationEntries(left, right) {
  const rank = id => documentationSections.findIndex(section => section.id === id);
  return rank(left.documentation.section) - rank(right.documentation.section)
    || left.documentation.order - right.documentation.order
    || left.navigation_title.localeCompare(right.navigation_title);
}

function renderDocumentationCatalogue(entries) {
  return documentationSections.map(section => {
    const sectionEntries = entries.filter(entry => entry.documentation.section === section.id);
    if (sectionEntries.length === 0) return '';
    return `          <section class="pinega-doc-catalogue-group" data-doc-group data-doc-section="${section.id}" aria-labelledby="docs-${section.id}-title">\n            <header class="pinega-doc-catalogue-heading"><div><p class="pinega-eyebrow">${escapeHtml(section.label)}</p><h3 id="docs-${section.id}-title">${escapeHtml(section.label)}</h3></div><p>${escapeHtml(section.description)}</p></header>\n            <div class="pinega-doc-grid">\n${sectionEntries.map(renderDocumentationCard).join('\n')}\n            </div>\n          </section>`;
  }).filter(Boolean).join('\n');
}

function renderDocumentationCard(entry) {
  const metadata = entry.documentation;
  const searchTokens = [entry.navigation_title, entry.summary, entry.programme, entry.maturity_status, metadata.section, metadata.purpose, metadata.applies_to, ...entry.topics].join(' ');
  return `              <article class="pinega-doc-card" data-doc-card data-content-type="${escapeHtml(metadata.purpose)}" data-search="${escapeHtml(searchTokens)}">\n                <div class="pinega-doc-card-header"><span class="pinega-doc-card-state" data-state="${escapeHtml(entry.maturity_status)}">${escapeHtml(maturityLabel(entry.maturity_status))}</span><span class="pinega-eyebrow">${escapeHtml(purposeLabel(metadata.purpose))}</span></div>\n                <h4><a href="${escapeHtml(entry.route)}">${escapeHtml(entry.navigation_title)}</a></h4>\n                <p>${escapeHtml(entry.summary)}</p>\n                <dl class="pinega-doc-card-meta"><div><dt>Applies to</dt><dd>${escapeHtml(metadata.applies_to)}</dd></div><div><dt>Updated</dt><dd><time datetime="${escapeHtml(entry.updated_at)}">${escapeHtml(entry.updated_at)}</time></dd></div></dl>\n              </article>`;
}

function renderDocumentationNavigation(entries, current) {
  const groups = documentationSections.map(section => {
    const links = entries.filter(entry => entry.documentation.section === section.id);
    if (links.length === 0) return '';
    return `          <div class="pinega-doc-navigation-group"><p>${escapeHtml(section.label)}</p><ul>\n${links.map(entry => `              <li><a href="${escapeHtml(entry.route)}"${entry.id === current.id ? ' aria-current="page"' : ''}>${escapeHtml(entry.navigation_title)}</a></li>`).join('\n')}\n            </ul></div>`;
  }).filter(Boolean).join('\n');
  return `        <nav class="pinega-doc-navigation" aria-label="Documentation">\n          <div class="pinega-doc-status"><span>Documentation stage</span><strong>Research-stage corpus</strong></div>\n          <a class="pinega-doc-navigation-home" href="/docs/">All documentation</a>\n${groups}\n        </nav>`;
}

function renderDocumentationBreadcrumbs(page) {
  const section = documentationSectionById.get(page.documentation.section);
  return `          <nav class="pinega-breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Pinega</a></li><li><a href="/docs/">Documentation</a></li><li><span>${escapeHtml(section?.label ?? page.documentation.section)}</span></li><li><span aria-current="page">${escapeHtml(page.navigation_title)}</span></li></ol></nav>`;
}

function renderDocumentationProvenance(page, entries) {
  const related = page.documentation.related.map(id => entries.find(entry => entry.id === id)).filter(Boolean);
  const relatedNavigation = related.length === 0 ? '' : `\n            <nav class="pinega-doc-related" aria-label="Related content"><p>Related content</p><ul>\n${related.map(entry => `              <li><a href="${escapeHtml(entry.route)}">${escapeHtml(entry.navigation_title)}</a></li>`).join('\n')}\n            </ul></nav>`;
  const repositoryPath = `web/${page.source_path}`;
  return `          <footer class="pinega-doc-provenance" data-doc-provenance><div><p class="pinega-eyebrow">Page provenance</p><h2>Documentation contract</h2></div><dl><div><dt>Purpose</dt><dd>${escapeHtml(purposeLabel(page.documentation.purpose))}</dd></div><div><dt>Evidence status</dt><dd>${escapeHtml(maturityLabel(page.maturity_status))}</dd></div><div><dt>Applies to</dt><dd>${escapeHtml(page.documentation.applies_to)}</dd></div><div><dt>Updated</dt><dd><time datetime="${escapeHtml(page.updated_at)}">${escapeHtml(page.updated_at)}</time></dd></div><div><dt>Owner</dt><dd>${escapeHtml(page.authors.join(', '))} · ${escapeHtml(page.programme)}</dd></div><div><dt>Registry ID</dt><dd><code>${escapeHtml(page.id)}</code></dd></div></dl><p class="pinega-doc-source-links"><a href="https://github.com/likern/research/blob/main/${escapeHtml(repositoryPath)}">View source</a><a href="https://github.com/likern/research/edit/main/${escapeHtml(repositoryPath)}">Edit on GitHub</a></p>${relatedNavigation}</footer>`;
}

function renderDocumentationManifest(entries) {
  const docs = getDocumentationEntries(entries);
  return {
    schema_version: 1,
    sections: documentationSections.filter(section => docs.some(entry => entry.documentation.section === section.id)).map(section => ({ id: section.id, label: section.label, description: section.description })),
    entries: docs.map(entry => ({
      id: entry.id,
      route: entry.route,
      title: entry.navigation_title,
      summary: entry.summary,
      section: entry.documentation.section,
      purpose: entry.documentation.purpose,
      order: entry.documentation.order,
      appliesTo: entry.documentation.applies_to,
      related: entry.documentation.related,
      topics: entry.topics,
      programme: entry.programme,
      maturityStatus: entry.maturity_status,
      updatedAt: entry.updated_at,
      authors: entry.authors,
    })),
  };
}

function purposeLabel(value) {
  return ({ start: 'Start', tutorial: 'Tutorial', 'how-to': 'How-to', explanation: 'Explanation', reference: 'Reference', contributing: 'Contributing' })[value] ?? value;
}
function maturityLabel(value) {
  return ({ available: 'Available', validated: 'Design contract', research: 'Research', decision: 'Decision' })[value] ?? value;
}
function requireString(object, field, prefix) {
  if (typeof object[field] !== 'string' || object[field].trim() === '') throw new TypeError(`${prefix}.${field} must be a non-empty string`);
}
function addUnique(values, value, label) {
  if (values.has(value)) throw new TypeError(`Duplicate ${label}: ${JSON.stringify(value)}`);
  values.add(value);
}
function replaceDiagramPlaceholders(html, figures, sourcePath) {
  const output = html.replace(/<!--\s*PINEGA_DIAGRAM:([a-z][a-z0-9-]*)\s*-->/gu, (_match, id) => {
    const figure = figures.get(id);
    if (!figure) throw new TypeError(`${sourcePath}: unknown semantic diagram ${JSON.stringify(id)}`);
    return figure;
  });
  if (/PINEGA_DIAGRAM:/u.test(output)) throw new TypeError(`${sourcePath}: unresolved semantic diagram placeholder`);
  return output;
}
function normalizeSiteOrigin(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new TypeError('PINEGA_SITE_ORIGIN must use http or https.');
  if (url.pathname !== '/' || url.search || url.hash) throw new TypeError('PINEGA_SITE_ORIGIN must be an origin without path, query, or fragment.');
  return url.origin;
}
function renderSitemap(origin, routes) {
  const entries = routes.map(route => `  <url><loc>${escapeXml(`${origin}${route}`)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", '&apos;');
}
