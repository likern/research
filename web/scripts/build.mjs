import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const projectUrl = process.env.PINEGA_WEB_AWESOME_PROJECT_URL ?? '';
const siteOrigin = normalizeSiteOrigin(process.env.PINEGA_SITE_ORIGIN ?? 'https://pinega.example');
const diagramRoot = resolve(root, '../design/diagrams');
const diagramModelRoot = resolve(diagramRoot, 'models');
const diagramBuildRoot = resolve(dist, '.diagram-build');
const contentRoot = resolve(root, 'content');
const contentIndex = validateContentIndex(
  JSON.parse(await readFile(resolve(contentRoot, 'content-index.json'), 'utf8')),
);
const pages = contentIndex.entries.map(entry => ({
  ...entry,
  source: entry.source_path,
  output: entry.output_path,
}));

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
  define: {
    __PINEGA_WEB_AWESOME_PROJECT_URL__: JSON.stringify(projectUrl),
  },
  logLevel: 'info',
});

for (const page of pages) {
  const source = await readFile(resolve(root, page.source), 'utf8');
  validatePageSource(source, page, contentIndex.primary_navigation);
  const html = replaceDiagramPlaceholders(
    source
      .replaceAll('{{SITE_ORIGIN}}', escapeHtml(siteOrigin))
      .replace(
        '<!-- PINEGA_PROJECT_META -->',
        projectUrl
          ? `<meta name="webawesome-project-url" content="${escapeHtml(projectUrl)}">`
          : '',
      ),
    diagrams.figures,
    page.source,
  );
  const output = resolve(dist, page.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, 'utf8');
}

const staticRoot = resolve(root, 'static');
try {
  await cp(staticRoot, dist, { recursive: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

await cp(diagramRoot, resolve(dist, 'diagrams'), { recursive: true });
await cp(contentRoot, resolve(dist, 'content'), { recursive: true });
await rm(diagramBuildRoot, { recursive: true, force: true });

const webAwesomeAssets = resolve(root, 'node_modules/@awesome.me/webawesome/dist/assets');
try {
  await cp(webAwesomeAssets, resolve(dist, 'assets/webawesome'), { recursive: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const publicRoutes = pages.filter(page => page.sitemap).map(page => page.route);
await writeFile(
  resolve(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n`,
  'utf8',
);
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
    })),
    diagrams: diagrams.ids.map(id => ({
      id,
      model: `/diagrams/models/${id}.json`,
    })),
  }, null, 2)}\n`,
  'utf8',
);

console.log(
  `Built Pinega website at ${dist} with ${pages.length} registered pages and ${diagrams.ids.length} semantic diagrams`,
);

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
  const entries = (await readdir(diagramModelRoot, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));
  const figures = new Map();
  const ids = [];

  for (const entry of entries) {
    const file = resolve(diagramModelRoot, entry.name);
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    const model = renderer.validateDiagramModel(parsed);
    const fileId = basename(entry.name, '.json');
    if (model.id !== fileId) {
      throw new TypeError(`Diagram file ${entry.name} declares id ${JSON.stringify(model.id)}`);
    }
    if (figures.has(model.id)) throw new TypeError(`Duplicate diagram id: ${model.id}`);
    figures.set(model.id, renderer.renderDiagramFigure(model));
    ids.push(model.id);
  }

  if (ids.length === 0) throw new TypeError('No semantic diagram models were found');
  return { figures, ids };
}

function validateContentIndex(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('content-index.json must contain an object');
  }
  if (value.schema_version !== 1) {
    throw new TypeError(`Unsupported content index schema: ${JSON.stringify(value.schema_version)}`);
  }
  if (!value.site || typeof value.site !== 'object') {
    throw new TypeError('Content index must define site metadata');
  }
  for (const field of ['name', 'organization', 'tagline', 'summary']) {
    if (typeof value.site[field] !== 'string' || value.site[field].trim() === '') {
      throw new TypeError(`Content index site.${field} must be a non-empty string`);
    }
  }
  if (!Array.isArray(value.primary_navigation) || value.primary_navigation.length === 0) {
    throw new TypeError('Content index must define primary_navigation');
  }
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    throw new TypeError('Content index must define entries');
  }

  const identities = new Set();
  const routes = new Set();
  const sources = new Set();
  const outputs = new Set();
  const requiredStrings = [
    'id',
    'route',
    'source_path',
    'output_path',
    'content_type',
    'canonical_title',
    'navigation_title',
    'summary',
    'programme',
    'maturity_status',
    'updated_at',
  ];

  for (const entry of value.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError('Every content entry must be an object');
    }
    for (const field of requiredStrings) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
        throw new TypeError(`${entry.id ?? '<unknown>'}.${field} must be a non-empty string`);
      }
    }
    if (!/^[a-z][a-z0-9-]*$/u.test(entry.id)) {
      throw new TypeError(`Invalid content id: ${JSON.stringify(entry.id)}`);
    }
    if (!entry.route.startsWith('/')) {
      throw new TypeError(`${entry.id}: route must start with /`);
    }
    if (entry.route !== '/' && !entry.route.endsWith('/') && !entry.route.endsWith('.html')) {
      throw new TypeError(`${entry.id}: route must end with / or .html`);
    }
    if (!Array.isArray(entry.audience) || entry.audience.length === 0) {
      throw new TypeError(`${entry.id}: audience must be a non-empty array`);
    }
    if (!Array.isArray(entry.topics) || entry.topics.length === 0) {
      throw new TypeError(`${entry.id}: topics must be a non-empty array`);
    }
    if (!Array.isArray(entry.authors) || entry.authors.length === 0) {
      throw new TypeError(`${entry.id}: authors must be a non-empty array`);
    }
    for (const flag of ['sitemap', 'searchable', 'public', 'canonical']) {
      if (typeof entry[flag] !== 'boolean') {
        throw new TypeError(`${entry.id}.${flag} must be boolean`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(entry.updated_at)) {
      throw new TypeError(`${entry.id}: updated_at must use YYYY-MM-DD`);
    }
    if (entry.published_at !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(entry.published_at)) {
      throw new TypeError(`${entry.id}: published_at must be null or YYYY-MM-DD`);
    }
    if (entry.research_area !== null && typeof entry.research_area !== 'string') {
      throw new TypeError(`${entry.id}: research_area must be a string or null`);
    }
    if (entry.structured_data_type !== null && typeof entry.structured_data_type !== 'string') {
      throw new TypeError(`${entry.id}: structured_data_type must be a string or null`);
    }
    if (entry.sitemap && (!entry.public || !entry.canonical)) {
      throw new TypeError(`${entry.id}: sitemap entries must be public and canonical`);
    }
    if (entry.searchable && !entry.public) {
      throw new TypeError(`${entry.id}: searchable entries must be public`);
    }

    addUnique(identities, entry.id, 'content id');
    addUnique(routes, entry.route, 'route');
    addUnique(sources, entry.source_path, 'source path');
    addUnique(outputs, entry.output_path, 'output path');
  }

  if (!routes.has('/')) throw new TypeError('Content index must contain the homepage route');
  for (const item of value.primary_navigation) {
    if (!item || typeof item !== 'object' || typeof item.label !== 'string') {
      throw new TypeError('Every primary-navigation item must define a label');
    }
    if ('route' in item) {
      const target = value.entries.find(entry => entry.route === item.route);
      if (!target?.public) {
        throw new TypeError(`Primary navigation route is not public: ${JSON.stringify(item.route)}`);
      }
    } else if ('href' in item) {
      const url = new URL(item.href);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new TypeError(`Unsupported primary-navigation URL: ${item.href}`);
      }
      if (item.external !== true) {
        throw new TypeError(`External navigation item must set external=true: ${item.label}`);
      }
    } else {
      throw new TypeError(`Primary navigation item has no route or href: ${item.label}`);
    }
  }

  return value;
}

function validatePageSource(html, page, primaryNavigation) {
  const title = html.match(/<title>([^<]+)<\/title>/u)?.[1];
  if (title !== page.canonical_title) {
    throw new TypeError(`${page.source}: expected title ${JSON.stringify(page.canonical_title)}, got ${JSON.stringify(title)}`);
  }
  const description = html.match(/<meta name="description" content="([^"]+)">/u)?.[1];
  if (description !== page.summary) {
    throw new TypeError(`${page.source}: meta description does not match the content registry`);
  }
  const pageId = html.match(/<html\b[^>]*\bdata-page="([^"]+)"/u)?.[1];
  if (pageId !== page.id) {
    throw new TypeError(`${page.source}: expected data-page=${JSON.stringify(page.id)}`);
  }
  if ((html.match(/<h1\b/gu) ?? []).length !== 1) {
    throw new TypeError(`${page.source}: every registered page must contain exactly one h1`);
  }
  const canonical = `<link rel="canonical" href="{{SITE_ORIGIN}}${page.route}">`;
  if (page.canonical && !html.includes(canonical)) {
    throw new TypeError(`${page.source}: missing canonical template ${canonical}`);
  }
  if (!page.canonical && /<link rel="canonical"/u.test(html)) {
    throw new TypeError(`${page.source}: non-canonical content must not emit a canonical link`);
  }

  if (page.public) {
    const navigation = html.match(/<nav\b[^>]*data-primary-navigation[^>]*>[\s\S]*?<\/nav>/u)?.[0];
    if (!navigation) throw new TypeError(`${page.source}: missing primary navigation`);
    for (const item of primaryNavigation) {
      const destination = 'route' in item ? item.route : item.href;
      if (!navigation.includes(`href="${destination}"`)) {
        throw new TypeError(`${page.source}: primary navigation is missing ${destination}`);
      }
    }
    if (navigation.includes('/component-lab/')) {
      throw new TypeError(`${page.source}: component lab must not appear in public primary navigation`);
    }
  }
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
  if (/PINEGA_DIAGRAM:/u.test(output)) {
    throw new TypeError(`${sourcePath}: unresolved semantic diagram placeholder`);
  }
  return output;
}

function normalizeSiteOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('PINEGA_SITE_ORIGIN must use http or https.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError('PINEGA_SITE_ORIGIN must be an origin without path, query, or fragment.');
  }
  return url.origin;
}

function renderSitemap(origin, routes) {
  const entries = routes
    .map(route => `  <url><loc>${escapeXml(`${origin}${route}`)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", '&apos;');
}
