import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => readFile(resolve(root, path), 'utf8');

test('the component lab keeps semantic HTML as the durable source', async () => {
  const html = await read('component-lab/index.html');
  assert.match(html, /<main id="main-content"/u);
  assert.match(html, /<nav data-primary-navigation aria-label="Primary navigation">/u);
  assert.match(html, /<pre tabindex="0"><code>/u);
  assert.match(html, /<table>/u);
  assert.match(html, /<caption class="pinega-visually-hidden">/u);
  assert.doesNotMatch(html, /innerHTML=/u);
});

test('the repository contains no purchased Web Awesome project URL or key', async () => {
  const pages = await Promise.all([
    read('component-lab/index.html'),
    read('pages/en/home/index.html'),
    read('pages/en/docs/index.html'),
    read('pages/en/docs/getting-started/index.html'),
    read('pages/en/research/index.html'),
  ]);
  const runtime = await read('src/vendor/webawesome/runtime.ts');
  assert.ok(pages.every(html => html.includes('<!-- PINEGA_PROJECT_META -->')));
  assert.doesNotMatch(`${pages.join('\n')}\n${runtime}`, /kit\.fontawesome\.com\/[a-z0-9]{8,}/iu);
  assert.doesNotMatch(`${pages.join('\n')}\n${runtime}`, /cdn\.webawesome\.com\/[^\s"']{16,}/iu);
});

test('Web Awesome follows the document locale for Core and purchased projects', async () => {
  const runtime = await read('src/vendor/webawesome/runtime.ts');
  assert.match(runtime, /document\.documentElement\.lang/u);
  assert.match(runtime, /@awesome\.me\/webawesome\/dist\/translations\/ru\.js/u);
  assert.match(runtime, /new URL\(`translations\/\$\{locale\}\.js`, projectUrl\)/u);
  assert.match(runtime, /dataset\.webawesomeLocale = locale/u);
});

test('Web Awesome experimental Copy Button is isolated by pinega-code-example', async () => {
  const html = await read('component-lab/index.html');
  const component = await read('src/components/code-example/code-example.ts');
  assert.match(html, /<pinega-code-example>/u);
  assert.match(component, /wa-copy-button/u);
  assert.match(component, /data-native-copy/u);
});
