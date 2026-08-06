import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sources = [
  ['/', 'pages/home/index.html'],
  ['/docs/', 'pages/docs/index.html'],
  ['/docs/getting-started/', 'pages/docs/getting-started/index.html'],
  ['/research/', 'pages/research/index.html'],
  ['/component-lab/', 'component-lab/index.html'],
];
const routeSet = new Set(sources.map(([route]) => route));
const read = path => readFile(resolve(root, path), 'utf8');

test('public pages preserve semantic HTML and deployment metadata', async () => {
  for (const [route, path] of sources.slice(0, 4)) {
    const html = await read(path);
    assert.match(html, /<!doctype html>/iu, `${route} must declare HTML`);
    assert.match(html, /<title>[^<]+<\/title>/u, `${route} must have a title`);
    assert.match(html, /<meta name="description" content="[^"]+">/u, `${route} must have a description`);
    assert.match(html, /<link rel="canonical" href="\{\{SITE_ORIGIN\}\}[^"]*">/u, `${route} must have a canonical template`);
    assert.match(html, /<header>/u, `${route} must have a header`);
    assert.match(html, /<main id="main-content"/u, `${route} must have main content`);
    assert.match(html, /<footer class="pinega-site-footer/u, `${route} must have a footer`);
    assert.match(html, /<!-- PINEGA_PROJECT_META -->/u, `${route} must expose the private Pro injection boundary`);
    assert.doesNotMatch(html, /innerHTML\s*=/u, `${route} must remain durable source HTML`);
  }
});

test('all internal anchor routes resolve to a generated page', async () => {
  for (const [route, path] of sources) {
    const html = await read(path);
    const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gu)].map(match => match[1]);
    for (const href of links) {
      if (/^(?:https?:|mailto:|tel:|#)/u.test(href)) continue;
      const pathname = href.split('#', 1)[0] || route;
      assert.ok(routeSet.has(pathname), `${path}: unresolved local route ${href}`);
    }
  }
});

test('homepage and docs make the research-stage boundary explicit', async () => {
  const home = await read('pages/home/index.html');
  const gettingStarted = await read('pages/docs/getting-started/index.html');
  assert.match(home, /Research stage/u);
  assert.match(home, /not a production release/u);
  assert.match(home, /No production binary or performance claim yet/u);
  assert.match(gettingStarted, /does not present an installable Pinega database engine/u);
});

test('documentation search enhances durable cards instead of generating them', async () => {
  const docs = await read('pages/docs/index.html');
  const search = await read('src/components/doc-search/doc-search.ts');
  assert.equal((docs.match(/data-doc-card/gu) ?? []).length, 8);
  assert.match(docs, /<pinega-doc-search/u);
  assert.match(search, /card\.hidden = !matches/u);
  assert.doesNotMatch(search, /innerHTML/u);
});

test('the build defines every public route and keeps the component lab out of the sitemap', async () => {
  const build = await read('scripts/build.mjs');
  for (const [route] of sources) assert.match(build, new RegExp(`route: ['\"]${escapeRegex(route)}['\"]`, 'u'));
  assert.match(build, /route: '\/component-lab\/',\n\s+sitemap: false/u);
  assert.match(build, /PINEGA_SITE_ORIGIN/u);
  assert.match(build, /site-manifest\.json/u);
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
