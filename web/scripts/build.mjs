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
const documentationSectionIds = ['start', 'tutorials', 'how-to', 'concepts', 'reference', 'contributing'];
const contentIndex = validateContentIndex(JSON.parse(await readFile(resolve(contentRoot, 'content-index.json'), 'utf8')));
const localeMessages = await loadLocaleMessages(contentIndex.site.locales);
const pages = expandPages(contentIndex);

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
  validatePageSource(source, page);
  let html = source
    .replaceAll('{{SITE_ORIGIN}}', escapeHtml(siteOrigin));
  html = replaceLocalePlaceholders(html, page);
  html = html.replace(
    '<!-- PINEGA_PROJECT_META -->',
    projectUrl ? `<meta name="webawesome-project-url" content="${escapeHtml(projectUrl)}">` : '',
  );
  html = replaceDocumentationPlaceholders(html, page, pages);
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
for (const locale of Object.keys(contentIndex.site.locales)) {
  const output = resolve(dist, `content/${locale}/documentation-manifest.json`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(renderDocumentationManifest(pages, locale), null, 2)}\n`, 'utf8');
}
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
    schemaVersion: 3,
    origin: siteOrigin,
    site: {
      name: contentIndex.site.name,
      organization: contentIndex.site.organization,
      tagline: contentIndex.site.tagline,
      defaultLocale: contentIndex.site.default_locale,
      locales: Object.fromEntries(Object.entries(contentIndex.site.locales).map(([locale, metadata]) => [locale, {
        lang: metadata.lang,
        formatLocale: metadata.format_locale,
        pathPrefix: metadata.path_prefix,
        direction: metadata.direction,
        label: metadata.label,
        summary: metadata.summary,
        primaryNavigation: resolvePrimaryNavigation(contentIndex, locale),
      }])),
    },
    routes: pages.map(page => ({
      id: page.id,
      locale: page.locale,
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
      translations: Object.fromEntries(page.translations.map(translation => [translation.locale, translation.route])),
    })),
    diagrams: diagrams.ids.map(id => ({ id, model: `/diagrams/models/${id}.json` })),
  }, null, 2)}\n`,
  'utf8',
);

console.log(`Built Pinega website at ${dist} with ${pages.length} localized page variants and ${diagrams.ids.length} semantic diagrams`);

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
  if (value.schema_version !== 3) throw new TypeError(`Unsupported content index schema: ${JSON.stringify(value.schema_version)}`);
  if (!value.site || typeof value.site !== 'object') throw new TypeError('Content index must define site metadata');
  for (const field of ['name', 'organization', 'tagline', 'default_locale']) requireString(value.site, field, 'site');
  if (!value.site.locales || typeof value.site.locales !== 'object' || Array.isArray(value.site.locales)) throw new TypeError('Content index must define site.locales');
  const localeEntries = Object.entries(value.site.locales);
  if (localeEntries.length < 2) throw new TypeError('Content index must define at least two locales');
  if (!value.site.locales[value.site.default_locale]) throw new TypeError('site.default_locale must identify a configured locale');
  if (!Array.isArray(value.entries) || value.entries.length === 0) throw new TypeError('Content index must define entries');

  const prefixes = new Set();
  for (const [locale, metadata] of localeEntries) {
    validateLocaleCode(locale, `site.locales.${locale}`);
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError(`site.locales.${locale} must be an object`);
    for (const field of ['lang', 'format_locale', 'label', 'og_locale', 'summary']) requireString(metadata, field, `site.locales.${locale}`);
    validateLocaleCode(metadata.lang, `site.locales.${locale}.lang`);
    validateLocaleCode(metadata.format_locale, `site.locales.${locale}.format_locale`);
    if (metadata.lang !== locale) throw new TypeError(`site.locales.${locale}.lang must equal its locale key`);
    if (metadata.direction !== 'ltr' && metadata.direction !== 'rtl') throw new TypeError(`site.locales.${locale}.direction must be ltr or rtl`);
    if (typeof metadata.path_prefix !== 'string' || (metadata.path_prefix && !/^\/[a-z0-9-]+$/u.test(metadata.path_prefix))) throw new TypeError(`site.locales.${locale}.path_prefix is invalid`);
    if (locale === value.site.default_locale && metadata.path_prefix !== '') throw new TypeError('The default locale must use an empty path prefix');
    if (locale !== value.site.default_locale && metadata.path_prefix === '') throw new TypeError(`${locale}: non-default locales must use a path prefix`);
    addUnique(prefixes, metadata.path_prefix, 'locale path prefix');
    if (!Array.isArray(metadata.primary_navigation) || metadata.primary_navigation.length === 0) throw new TypeError(`site.locales.${locale}.primary_navigation must be a non-empty array`);
  }

  const identities = new Set();
  const routes = new Set();
  const sources = new Set();
  const outputs = new Set();
  const documentationPositions = new Set();
  for (const entry of value.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('Every content entry must be an object');
    for (const field of ['id', 'content_type', 'programme', 'maturity_status']) requireString(entry, field, entry.id ?? '<unknown>');
    if (!/^[a-z][a-z0-9-]*$/u.test(entry.id)) throw new TypeError(`Invalid content id: ${JSON.stringify(entry.id)}`);
    for (const field of ['audience', 'topics', 'authors']) {
      if (!Array.isArray(entry[field]) || entry[field].length === 0 || entry[field].some(value => typeof value !== 'string' || value.trim() === '')) throw new TypeError(`${entry.id}.${field} must be a non-empty string array`);
    }
    if (typeof entry.public !== 'boolean') throw new TypeError(`${entry.id}.public must be boolean`);
    if (!Number.isInteger(entry.revision) || entry.revision < 1) throw new TypeError(`${entry.id}.revision must be a positive integer`);
    if (entry.published_at !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(entry.published_at)) throw new TypeError(`${entry.id}: published_at must be null or YYYY-MM-DD`);
    if (entry.research_area !== null && typeof entry.research_area !== 'string') throw new TypeError(`${entry.id}: research_area must be a string or null`);
    if (!entry.locales || typeof entry.locales !== 'object' || Array.isArray(entry.locales) || Object.keys(entry.locales).length === 0) throw new TypeError(`${entry.id}.locales must define at least one published variant`);

    addUnique(identities, entry.id, 'content id');
    for (const [locale, localized] of Object.entries(entry.locales)) {
      if (!value.site.locales[locale]) throw new TypeError(`${entry.id}: unknown locale ${JSON.stringify(locale)}`);
      if (!localized || typeof localized !== 'object' || Array.isArray(localized)) throw new TypeError(`${entry.id}.locales.${locale} must be an object`);
      for (const field of ['route', 'source_path', 'output_path', 'canonical_title', 'navigation_title', 'summary', 'updated_at']) requireString(localized, field, `${entry.id}.locales.${locale}`);
      if (localized.status !== 'published') throw new TypeError(`${entry.id}.locales.${locale}.status must be published; omit unfinished variants instead`);
      if (localized.reviewed_revision !== entry.revision) throw new TypeError(`${entry.id}.locales.${locale} is stale: reviewed revision ${localized.reviewed_revision}, content revision ${entry.revision}`);
      if (!localized.route.startsWith('/')) throw new TypeError(`${entry.id}.${locale}: route must start with /`);
      if (localized.route !== '/' && !localized.route.endsWith('/') && !localized.route.endsWith('.html')) throw new TypeError(`${entry.id}.${locale}: route must end with / or .html`);
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(localized.updated_at)) throw new TypeError(`${entry.id}.${locale}: updated_at must use YYYY-MM-DD`);
      for (const flag of ['sitemap', 'searchable', 'canonical']) if (typeof localized[flag] !== 'boolean') throw new TypeError(`${entry.id}.${locale}.${flag} must be boolean`);
      if (localized.structured_data_type !== null && typeof localized.structured_data_type !== 'string') throw new TypeError(`${entry.id}.${locale}: structured_data_type must be a string or null`);
      if (localized.sitemap && (!entry.public || !localized.canonical)) throw new TypeError(`${entry.id}.${locale}: sitemap entries must be public and canonical`);
      if (localized.searchable && !entry.public) throw new TypeError(`${entry.id}.${locale}: searchable entries must be public`);
      validateLocalizedRoute(entry.id, locale, localized, value.site.locales);
      if (localized.source_path.startsWith('pages/') && !localized.source_path.startsWith(`pages/${locale}/`)) throw new TypeError(`${entry.id}.${locale}: localized page sources must live below pages/${locale}/`);
      if (entry.documentation) validateDocumentationMetadata(entry, localized, locale, value.site.locales[locale], documentationPositions);
      else if (localized.documentation !== undefined) throw new TypeError(`${entry.id}.${locale}: non-documentation content must not define localized documentation metadata`);
      addUnique(routes, localized.route, 'route');
      addUnique(sources, localized.source_path, 'source path');
      addUnique(outputs, localized.output_path, 'output path');
    }
  }

  const entriesById = new Map(value.entries.map(entry => [entry.id, entry]));
  for (const entry of value.entries) {
    for (const relatedId of entry.documentation?.related ?? []) {
      if (relatedId === entry.id) throw new TypeError(`${entry.id}: related content cannot reference itself`);
      const related = entriesById.get(relatedId);
      if (!related?.public) throw new TypeError(`${entry.id}: unknown/non-public related content id ${JSON.stringify(relatedId)}`);
      for (const locale of Object.keys(entry.locales)) {
        if (!related.locales[locale]?.canonical) throw new TypeError(`${entry.id}.${locale}: related content ${JSON.stringify(relatedId)} has no canonical variant in the same locale`);
      }
    }
  }

  if (!routes.has('/')) throw new TypeError('Content index must contain the homepage route');
  for (const [locale, metadata] of localeEntries) {
    const hasPublicCanonicalPage = value.entries.some(entry => entry.public && entry.locales[locale]?.canonical);
    for (const item of metadata.primary_navigation) {
      if (!item || typeof item !== 'object' || typeof item.label !== 'string' || item.label.trim() === '') throw new TypeError(`${locale}: every primary-navigation item must define a label`);
      if ('entry_id' in item) {
        const target = entriesById.get(item.entry_id);
        if (!target?.public) throw new TypeError(`${locale}: primary navigation references unknown/non-public entry ${JSON.stringify(item.entry_id)}`);
        if (hasPublicCanonicalPage && !target.locales[locale]?.canonical) throw new TypeError(`${locale}: primary navigation target ${JSON.stringify(item.entry_id)} has no canonical locale variant`);
      } else if ('href' in item) {
        const url = new URL(item.href);
        if (!['https:', 'http:'].includes(url.protocol) || item.external !== true) throw new TypeError(`Invalid external navigation item: ${item.label}`);
      } else throw new TypeError(`Primary navigation item has no entry_id or href: ${item.label}`);
    }
  }
  return value;
}

function validateLocalizedRoute(id, locale, localized, locales) {
  const prefix = locales[locale].path_prefix;
  if (prefix && localized.route !== prefix && !localized.route.startsWith(`${prefix}/`)) throw new TypeError(`${id}.${locale}: route must use locale prefix ${prefix}`);
  if (!prefix) {
    for (const metadata of Object.values(locales)) {
      if (metadata.path_prefix && (localized.route === metadata.path_prefix || localized.route.startsWith(`${metadata.path_prefix}/`))) throw new TypeError(`${id}.${locale}: default-locale route overlaps ${metadata.path_prefix}`);
    }
  }
}

function validateDocumentationMetadata(entry, localized, locale, localeMetadata, positions) {
  const metadata = entry.documentation;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError(`${entry.id}.documentation must be an object`);
  const validSections = new Set(['landing', ...documentationSectionIds]);
  const validPurposes = new Set(['index', 'start', 'tutorial', 'how-to', 'explanation', 'reference', 'contributing']);
  if (!validSections.has(metadata.section)) throw new TypeError(`${entry.id}.documentation.section is invalid`);
  if (!validPurposes.has(metadata.purpose)) throw new TypeError(`${entry.id}.documentation.purpose is invalid`);
  if (!Number.isInteger(metadata.order) || metadata.order < 0) throw new TypeError(`${entry.id}.documentation.order must be a non-negative integer`);
  if (!Array.isArray(metadata.related) || new Set(metadata.related).size !== metadata.related.length) throw new TypeError(`${entry.id}.documentation.related must be a unique array`);
  for (const relatedId of metadata.related) if (typeof relatedId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(relatedId)) throw new TypeError(`${entry.id}.documentation.related contains an invalid content id`);
  if (!localized.documentation || typeof localized.documentation !== 'object') throw new TypeError(`${entry.id}.${locale}: documentation variants must define localized applies_to`);
  requireString(localized.documentation, 'applies_to', `${entry.id}.locales.${locale}.documentation`);
  const docsRoot = `${localeMetadata.path_prefix}/docs/`;
  if (localized.route !== docsRoot && !localized.route.startsWith(docsRoot)) throw new TypeError(`${entry.id}.${locale}: documentation content must use ${docsRoot}`);
  if (localized.route === docsRoot) {
    if (metadata.section !== 'landing' || metadata.purpose !== 'index') throw new TypeError(`${locale}: the documentation landing must use section=landing and purpose=index`);
  } else {
    if (metadata.section === 'landing' || metadata.purpose === 'index') throw new TypeError(`${entry.id}.${locale}: nested documentation cannot use landing/index metadata`);
    addUnique(positions, `${locale}:${metadata.section}:${metadata.order}`, 'documentation section/order position');
  }
  if (!entry.public || !localized.canonical || !localized.searchable) throw new TypeError(`${entry.id}.${locale}: documentation corpus entries must be public, canonical, and searchable`);
}

function validateLocaleCode(value, label) {
  try {
    Intl.getCanonicalLocales(value);
  } catch {
    throw new TypeError(`${label} must be a valid BCP 47 locale`);
  }
}

function expandPages(index) {
  return index.entries.flatMap(entry => Object.entries(entry.locales).map(([locale, localized]) => {
    const localeMetadata = index.site.locales[locale];
    const translations = Object.entries(entry.locales).map(([translationLocale, translation]) => ({
      locale: translationLocale,
      lang: index.site.locales[translationLocale].lang,
      label: index.site.locales[translationLocale].label,
      ogLocale: index.site.locales[translationLocale].og_locale,
      route: translation.route,
      canonical: translation.canonical,
    }));
    const languages = Object.entries(index.site.locales).map(([languageLocale, languageMetadata]) => ({
      locale: languageLocale,
      lang: languageMetadata.lang,
      direction: languageMetadata.direction,
      label: languageMetadata.label,
      route: entry.locales[languageLocale]?.route ?? null,
    }));
    return {
      ...entry,
      ...localized,
      locale,
      defaultLocale: index.site.default_locale,
      lang: localeMetadata.lang,
      formatLocale: localeMetadata.format_locale,
      direction: localeMetadata.direction,
      ogLocale: localeMetadata.og_locale,
      source: localized.source_path,
      output: localized.output_path,
      primary_navigation: resolvePrimaryNavigation(index, locale),
      translations,
      languages,
      documentation: entry.documentation ? { ...entry.documentation, ...localized.documentation } : undefined,
    };
  }));
}

function resolvePrimaryNavigation(index, locale) {
  return index.site.locales[locale].primary_navigation.map(item => {
    if ('href' in item) return { label: item.label, href: item.href, external: true };
    return {
      label: item.label,
      entryId: item.entry_id,
      route: index.entries.find(entry => entry.id === item.entry_id)?.locales[locale]?.route ?? null,
    };
  });
}

async function loadLocaleMessages(locales) {
  const catalogues = new Map();
  for (const locale of Object.keys(locales)) {
    const messages = JSON.parse(await readFile(resolve(contentRoot, `messages/${locale}.json`), 'utf8'));
    if (messages.locale !== locale) throw new TypeError(`messages/${locale}.json must declare locale=${locale}`);
    for (const targetLocale of Object.keys(locales)) {
      if (typeof messages.navigation?.translation_unavailable?.[targetLocale] !== 'string') {
        throw new TypeError(`messages/${locale}.json must define navigation.translation_unavailable.${targetLocale}`);
      }
    }
    catalogues.set(locale, messages);
  }
  return catalogues;
}

function validatePageSource(html, page) {
  const title = html.match(/<title>([^<]+)<\/title>/u)?.[1];
  if (title !== page.canonical_title) throw new TypeError(`${page.source}: expected title ${JSON.stringify(page.canonical_title)}, got ${JSON.stringify(title)}`);
  const description = html.match(/<meta name="description" content="([^"]+)">/u)?.[1];
  if (description !== page.summary) throw new TypeError(`${page.source}: meta description does not match the content registry`);
  const language = html.match(/<html\b[^>]*\blang="([^"]+)"/u)?.[1];
  if (language !== page.lang) throw new TypeError(`${page.source}: expected html lang=${JSON.stringify(page.lang)}, got ${JSON.stringify(language)}`);
  const pageId = html.match(/<html\b[^>]*\bdata-page="([^"]+)"/u)?.[1];
  if (pageId !== page.id) throw new TypeError(`${page.source}: expected data-page=${JSON.stringify(page.id)}`);
  if ((html.match(/<h1\b/gu) ?? []).length !== 1) throw new TypeError(`${page.source}: every registered page must contain exactly one h1`);
  const canonical = `<link rel="canonical" href="{{SITE_ORIGIN}}${page.route}">`;
  if (page.canonical && !html.includes(canonical)) throw new TypeError(`${page.source}: missing canonical template ${canonical}`);
  if (!page.canonical && /<link rel="canonical"/u.test(html)) throw new TypeError(`${page.source}: non-canonical content must not emit a canonical link`);
  if (page.public) {
    const navigation = html.match(/<nav\b[^>]*data-primary-navigation[^>]*>[\s\S]*?<\/nav>/u)?.[0];
    if (!navigation) throw new TypeError(`${page.source}: missing primary navigation`);
    for (const item of page.primary_navigation) {
      const destination = item.route ?? item.href;
      if (!destination) throw new TypeError(`${page.source}: locale navigation target ${item.entryId} is not published`);
      if (!navigation.includes(`href="${destination}"`)) throw new TypeError(`${page.source}: primary navigation is missing ${destination}`);
    }
    if (navigation.includes('/component-lab/')) throw new TypeError(`${page.source}: component lab must not appear in public primary navigation`);
  }
  if (page.documentation?.section === 'landing') {
    for (const marker of ['PINEGA_DOC_COUNT', 'PINEGA_DOC_CATALOGUE']) if (!html.includes(`<!-- ${marker} -->`)) throw new TypeError(`${page.source}: missing ${marker} build marker`);
  } else if (page.documentation) {
    for (const marker of ['PINEGA_DOC_NAV', 'PINEGA_BREADCRUMBS', 'PINEGA_DOC_PROVENANCE']) if (!html.includes(`<!-- ${marker} -->`)) throw new TypeError(`${page.source}: missing ${marker} build marker`);
  }
  if (!html.includes('<!-- PINEGA_LANGUAGE_SWITCHER -->')) throw new TypeError(`${page.source}: every registered page must expose the language-switcher marker`);
}

function replaceLocalePlaceholders(html, page) {
  let output = html.replace(/<html\b([^>]*)>/u, (_match, attributes) => {
    const normalized = attributes
      .replace(/\sdir="[^"]*"/u, '')
      .replace(/\sdata-locale="[^"]*"/u, '');
    return `<html${normalized} dir="${page.direction}" data-locale="${page.locale}">`;
  });
  const metadata = renderLocaleMetadata(page);
  output = output.replace('<!-- PINEGA_PROJECT_META -->', `${metadata}${metadata ? '\n    ' : ''}<!-- PINEGA_PROJECT_META -->`);
  output = output.replace('<!-- PINEGA_LANGUAGE_SWITCHER -->', renderLanguageSwitcher(page));
  const notices = renderTranslationNotices(page);
  if (notices) {
    if (!output.includes('</pinega-site-header>')) throw new TypeError(`${page.source}: missing site-header boundary for translation notices`);
    output = output.replace('</pinega-site-header>', `${notices}\n      </pinega-site-header>`);
  }
  if (/PINEGA_LANGUAGE_SWITCHER/u.test(output)) throw new TypeError(`${page.source}: unresolved language-switcher marker`);
  return output;
}

function renderLocaleMetadata(page) {
  const lines = [];
  const canonicalTranslations = page.translations.filter(translation => translation.canonical);
  if (page.canonical) {
    for (const translation of canonicalTranslations) {
      lines.push(`<link rel="alternate" hreflang="${escapeHtml(translation.lang)}" href="${escapeHtml(`${siteOrigin}${translation.route}`)}">`);
    }
    const defaultTranslation = canonicalTranslations.find(translation => translation.locale === page.defaultLocale);
    if (defaultTranslation) lines.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(`${siteOrigin}${defaultTranslation.route}`)}">`);
  }
  if (page.canonical && page.ogLocale) {
    lines.push(`<meta property="og:locale" content="${escapeHtml(page.ogLocale)}">`);
    for (const translation of canonicalTranslations.filter(translation => translation.locale !== page.locale)) {
      lines.push(`<meta property="og:locale:alternate" content="${escapeHtml(translation.ogLocale)}">`);
    }
  }
  return lines.join('\n    ');
}

function renderLanguageSwitcher(page) {
  const messages = messagesFor(page.locale);
  const options = page.languages.map(language => {
    const label = `<span lang="${escapeHtml(language.lang)}" dir="${escapeHtml(language.direction)}" translate="no">${escapeHtml(language.label)}</span>`;
    if (language.locale === page.locale) return `<span class="pinega-language-option" aria-current="page">${label}</span>`;
    if (language.route) return `<a class="pinega-language-option" href="${escapeHtml(language.route)}" hreflang="${escapeHtml(language.lang)}">${label}</a>`;
    const noticeId = translationNoticeId(language.locale);
    return `<a class="pinega-language-option" href="#${noticeId}" data-translation-unavailable aria-controls="${noticeId}">${label}</a>`;
  }).join('');
  return `<nav class="pinega-language-switcher" aria-label="${escapeHtml(messages.navigation.language)}">${options}</nav>`;
}

function renderTranslationNotices(page) {
  const messages = messagesFor(page.locale);
  return page.languages
    .filter(language => language.locale !== page.locale && !language.route)
    .map(language => {
      const noticeId = translationNoticeId(language.locale);
      const message = messages.navigation.translation_unavailable[language.locale];
      return `<aside class="pinega-translation-notice" id="${noticeId}" data-translation-notice role="status" aria-live="polite" aria-atomic="true"><p data-translation-notice-message data-message="${escapeHtml(message)}">${escapeHtml(message)}</p></aside>`;
    })
    .join('');
}

function translationNoticeId(locale) {
  return `pinega-translation-unavailable-${locale.toLocaleLowerCase()}`;
}

function replaceDocumentationPlaceholders(html, page, allPages) {
  const docs = getDocumentationEntries(allPages, page.locale);
  const messages = messagesFor(page.locale);
  let output = html;
  if (page.documentation?.section === 'landing') {
    output = output.replace('<!-- PINEGA_DOC_COUNT -->', String(docs.length)).replace('<!-- PINEGA_DOC_CATALOGUE -->', renderDocumentationCatalogue(docs, messages));
  } else if (page.documentation) {
    output = output
      .replace('<!-- PINEGA_DOC_NAV -->', renderDocumentationNavigation(docs, page, allPages, messages))
      .replace('<!-- PINEGA_BREADCRUMBS -->', renderDocumentationBreadcrumbs(page, allPages, messages))
      .replace('<!-- PINEGA_DOC_PROVENANCE -->', renderDocumentationProvenance(page, allPages, messages));
  }
  if (/PINEGA_DOC_[A-Z_]+/u.test(output)) throw new TypeError(`${page.source}: unresolved documentation build marker`);
  return output;
}

function getDocumentationEntries(entries, locale) {
  return entries.filter(entry => entry.locale === locale && entry.documentation && entry.documentation.section !== 'landing').toSorted(compareDocumentationEntries);
}

function compareDocumentationEntries(left, right) {
  const rank = id => documentationSectionIds.indexOf(id);
  return rank(left.documentation.section) - rank(right.documentation.section)
    || left.documentation.order - right.documentation.order
    || left.navigation_title.localeCompare(right.navigation_title, left.formatLocale);
}

function renderDocumentationCatalogue(entries, messages) {
  return documentationSections(messages).map(section => {
    const sectionEntries = entries.filter(entry => entry.documentation.section === section.id);
    if (sectionEntries.length === 0) return '';
    return `          <section class="pinega-doc-catalogue-group" data-doc-group data-doc-section="${section.id}" aria-labelledby="docs-${section.id}-title">\n            <header class="pinega-doc-catalogue-heading"><div><p class="pinega-eyebrow">${escapeHtml(section.label)}</p><h3 id="docs-${section.id}-title">${escapeHtml(section.label)}</h3></div><p>${escapeHtml(section.description)}</p></header>\n            <div class="pinega-doc-grid">\n${sectionEntries.map(entry => renderDocumentationCard(entry, messages)).join('\n')}\n            </div>\n          </section>`;
  }).filter(Boolean).join('\n');
}

function renderDocumentationCard(entry, messages) {
  const metadata = entry.documentation;
  const searchTokens = [entry.navigation_title, entry.summary, entry.programme, entry.maturity_status, metadata.section, metadata.purpose, metadata.applies_to, ...entry.topics].join(' ');
  return `              <article class="pinega-doc-card" data-doc-card data-content-type="${escapeHtml(metadata.purpose)}" data-search="${escapeHtml(searchTokens)}">\n                <div class="pinega-doc-card-header"><span class="pinega-doc-card-state" data-state="${escapeHtml(entry.maturity_status)}">${escapeHtml(maturityLabel(entry.maturity_status, messages))}</span><span class="pinega-eyebrow">${escapeHtml(purposeLabel(metadata.purpose, messages))}</span></div>\n                <h4><a href="${escapeHtml(entry.route)}">${escapeHtml(entry.navigation_title)}</a></h4>\n                <p>${escapeHtml(entry.summary)}</p>\n                <dl class="pinega-doc-card-meta"><div><dt>${escapeHtml(messages.documentation.applies_to)}</dt><dd>${escapeHtml(metadata.applies_to)}</dd></div><div><dt>${escapeHtml(messages.documentation.updated)}</dt><dd><time datetime="${escapeHtml(entry.updated_at)}">${escapeHtml(entry.updated_at)}</time></dd></div></dl>\n              </article>`;
}

function renderDocumentationNavigation(entries, current, allPages, messages) {
  const groups = documentationSections(messages).map(section => {
    const links = entries.filter(entry => entry.documentation.section === section.id);
    if (links.length === 0) return '';
    return `          <div class="pinega-doc-navigation-group"><p>${escapeHtml(section.label)}</p><ul>\n${links.map(entry => `              <li><a href="${escapeHtml(entry.route)}"${entry.id === current.id ? ' aria-current="page"' : ''}>${escapeHtml(entry.navigation_title)}</a></li>`).join('\n')}\n            </ul></div>`;
  }).filter(Boolean).join('\n');
  const documentationHome = findLocalePage(allPages, 'documentation', current.locale);
  return `        <nav class="pinega-doc-navigation" aria-label="${escapeHtml(messages.navigation.documentation)}">\n          <div class="pinega-doc-status"><span>${escapeHtml(messages.documentation.stage_label)}</span><strong>${escapeHtml(messages.documentation.stage_value)}</strong></div>\n          <a class="pinega-doc-navigation-home" href="${escapeHtml(documentationHome.route)}">${escapeHtml(messages.documentation.all)}</a>\n${groups}\n        </nav>`;
}

function renderDocumentationBreadcrumbs(page, allPages, messages) {
  const section = documentationSections(messages).find(candidate => candidate.id === page.documentation.section);
  const home = findLocalePage(allPages, 'home', page.locale);
  const documentationHome = findLocalePage(allPages, 'documentation', page.locale);
  return `          <nav class="pinega-breadcrumbs" aria-label="${escapeHtml(messages.navigation.breadcrumb)}"><ol><li><a href="${escapeHtml(home.route)}">Pinega</a></li><li><a href="${escapeHtml(documentationHome.route)}">${escapeHtml(messages.navigation.documentation)}</a></li><li><span>${escapeHtml(section?.label ?? page.documentation.section)}</span></li><li><span aria-current="page">${escapeHtml(page.navigation_title)}</span></li></ol></nav>`;
}

function renderDocumentationProvenance(page, entries, messages) {
  const related = page.documentation.related.map(id => entries.find(entry => entry.id === id && entry.locale === page.locale)).filter(Boolean);
  const relatedNavigation = related.length === 0 ? '' : `\n            <nav class="pinega-doc-related" aria-label="${escapeHtml(messages.documentation.related_content)}"><p>${escapeHtml(messages.documentation.related_content)}</p><ul>\n${related.map(entry => `              <li><a href="${escapeHtml(entry.route)}">${escapeHtml(entry.navigation_title)}</a></li>`).join('\n')}\n            </ul></nav>`;
  const repositoryPath = `web/${page.source_path}`;
  return `          <footer class="pinega-doc-provenance" data-doc-provenance><div><p class="pinega-eyebrow">${escapeHtml(messages.documentation.page_provenance)}</p><h2>${escapeHtml(messages.documentation.contract)}</h2></div><dl><div><dt>${escapeHtml(messages.documentation.purpose)}</dt><dd>${escapeHtml(purposeLabel(page.documentation.purpose, messages))}</dd></div><div><dt>${escapeHtml(messages.documentation.evidence_status)}</dt><dd>${escapeHtml(maturityLabel(page.maturity_status, messages))}</dd></div><div><dt>${escapeHtml(messages.documentation.applies_to)}</dt><dd>${escapeHtml(page.documentation.applies_to)}</dd></div><div><dt>${escapeHtml(messages.documentation.updated)}</dt><dd><time datetime="${escapeHtml(page.updated_at)}">${escapeHtml(page.updated_at)}</time></dd></div><div><dt>${escapeHtml(messages.documentation.owner)}</dt><dd>${escapeHtml(page.authors.join(', '))} · ${escapeHtml(page.programme)}</dd></div><div><dt>${escapeHtml(messages.documentation.registry_id)}</dt><dd><code>${escapeHtml(page.id)}</code></dd></div></dl><p class="pinega-doc-source-links"><a href="https://github.com/likern/research/blob/main/${escapeHtml(repositoryPath)}">${escapeHtml(messages.documentation.view_source)}</a><a href="https://github.com/likern/research/edit/main/${escapeHtml(repositoryPath)}">${escapeHtml(messages.documentation.edit_github)}</a></p>${relatedNavigation}</footer>`;
}

function renderDocumentationManifest(entries, locale) {
  const docs = getDocumentationEntries(entries, locale);
  const messages = messagesFor(locale);
  return {
    schema_version: 2,
    locale,
    sections: documentationSections(messages).filter(section => docs.some(entry => entry.documentation.section === section.id)).map(section => ({ id: section.id, label: section.label, description: section.description })),
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

function documentationSections(messages) {
  return documentationSectionIds.map(id => ({ id, ...messages.documentation.sections[id] }));
}
function messagesFor(locale) {
  const messages = localeMessages.get(locale);
  if (!messages) throw new TypeError(`Missing messages for ${locale}`);
  return messages;
}
function findLocalePage(allPages, id, locale) {
  const page = allPages.find(candidate => candidate.id === id && candidate.locale === locale);
  if (!page) throw new TypeError(`Missing ${id} page for locale ${locale}`);
  return page;
}
function purposeLabel(value, messages) {
  return messages.documentation.purposes[value] ?? value;
}
function maturityLabel(value, messages) {
  return messages.documentation.maturity[value] ?? value;
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
