import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const projectUrl = process.env.PINEGA_WEB_AWESOME_PROJECT_URL ?? '';
const siteOrigin = normalizeSiteOrigin(process.env.PINEGA_SITE_ORIGIN ?? 'https://pinega.example');

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
  const html = source
    .replaceAll('{{SITE_ORIGIN}}', escapeHtml(siteOrigin))
    .replace(
      '<!-- PINEGA_PROJECT_META -->',
      projectUrl
        ? `<meta name="webawesome-project-url" content="${escapeHtml(projectUrl)}">`
        : '',
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
  `${JSON.stringify({ origin: siteOrigin, routes: pages.map(({ route, output, sitemap }) => ({ route, output, sitemap })) }, null, 2)}\n`,
  'utf8',
);

console.log(`Built Pinega website at ${dist}`);

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
