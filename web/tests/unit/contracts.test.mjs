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
  const html = await read('component-lab/index.html');
  const runtime = await read('src/vendor/webawesome/runtime.ts');
  assert.match(html, /<!-- PINEGA_PROJECT_META -->/u);
  assert.doesNotMatch(`${html}\n${runtime}`, /kit\.fontawesome\.com\/[a-z0-9]{8,}/iu);
  assert.doesNotMatch(`${html}\n${runtime}`, /cdn\.webawesome\.com\/[^\s"']{16,}/iu);
});

test('Web Awesome experimental Copy Button is isolated by pinega-code-example', async () => {
  const html = await read('component-lab/index.html');
  const component = await read('src/components/code-example/code-example.ts');
  assert.match(html, /<pinega-code-example>/u);
  assert.match(component, /wa-copy-button/u);
  assert.match(component, /data-native-copy/u);
});
