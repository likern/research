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

const pages = [
  { source: 'pages/home/index.html', output: 'index.html', route: '/', sitemap: true },
  { source: 'pages/docs/index.html', output: 'docs/index.html', route: '/docs/', sitemap: true },
  {
    source: 'pages/docs/getting-started/index.html',
    output: 'docs/getting-started/index.html',
    route: '/docs/getting-started/',
    sitemap: true,
  },
  { source: 'pages/research/index.html', output: 'research/index.html', route: '/research/', sitemap: true },
  {
    source: 'component-lab/index.html',
    output: 'component-lab/index.html',
    route: '/component-lab/',
    sitemap: false,
  },
  { source: 'pages/404.html', output: '404.html', route: '/404.html', sitemap: false },
];

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
    routes: pages.map(({ route, output, sitemap }) => ({ route, output, sitemap })),
    diagrams: diagrams.ids.map(id => ({
      id,
      model: `/diagrams/models/${id}.json`,
    })),
  }, null, 2)}\n`,
  'utf8',
);

console.log(`Built Pinega website at ${dist} with ${diagrams.ids.length} semantic diagrams`);

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
