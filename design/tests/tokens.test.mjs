import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = resolve(root, 'scripts/build-tokens.mjs');

function read(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('generated token files are current', () => {
  execFileSync(process.execPath, [buildScript, '--check'], { stdio: 'pipe' });
});

test('CSS exposes canonical cross-platform token families', async () => {
  const css = await read('generated/strata.tokens.css');
  assert.match(css, /--pinega-ref-color-river-40:/u);
  assert.match(css, /--pinega-sys-color-surface-canvas:/u);
  assert.match(css, /--pinega-research-color-confirmed:/u);
  assert.match(css, /--pinega-component-benchmark-chart-height:/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
});

test('light and dark modes expose the same semantic color names', async () => {
  const css = await read('generated/strata.tokens.css');
  const variable = '--pinega-sys-color-text-primary';
  assert.equal(css.split(variable).length - 1, 3, 'light, explicit dark, and preferred dark declarations');
});

test('Typst output contains mode-aware lookup without web-only units for prose measure', async () => {
  const typst = await read('generated/strata.tokens.typ');
  assert.match(typst, /#let pinega-strata-token\(/u);
  assert.match(typst, /"system\.measure\.prose": 68,/u);
  assert.doesNotMatch(typst, /68ch/u);
});
