import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  IMMUTABLE_CACHE_CONTROL,
  NOT_FOUND_CACHE_CONTROL,
  RELEASE_MANIFEST_PATH,
  REVALIDATED_CACHE_CONTROL,
  createReleaseManifest,
  isFingerprintedAssetPath,
  publicMappingForPath,
  renderReleaseHeaders,
  verifyReleaseManifest,
  writeFingerprintedFile,
  writeFingerprintedJson,
  writeReleaseHeaders,
  writeReleaseManifest,
} from '../../scripts/lib/release-contract.mjs';

const buildId = `sha256-${'a'.repeat(64)}`;

test('release contract fingerprints every immutable asset and inventories exact public bytes', async t => {
  const root = await fixture(t);
  const script = await writeFingerprintedFile(resolve(root, 'source/main.js'), resolve(root, 'assets'));
  const graph = await writeFingerprintedJson(resolve(root, 'assets'), 'feature-graph', { entry: script.url });
  await writeFile(resolve(root, 'index.html'), '<!doctype html><html><body>Pinega</body></html>\n', 'utf8');
  await writeFile(resolve(root, '404.html'), '<!doctype html><html><body>Missing</body></html>\n', 'utf8');
  await mkdir(resolve(root, 'ru'));
  await writeFile(resolve(root, 'ru/404.html'), '<!doctype html><html lang="ru"><body>Нет</body></html>\n', 'utf8');
  await writeFile(resolve(root, 'site-manifest.json'), '{}\n', 'utf8');
  await writeReleaseHeaders(root, ['/', '/404.html', '/ru/404.html']);

  const manifest = await writeReleaseManifest(root, buildId);
  await verifyReleaseManifest(root, manifest);

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.buildId, buildId);
  assert.equal(manifest.cachePolicy.immutableAssets, IMMUTABLE_CACHE_CONTROL);
  assert.equal(manifest.cachePolicy.revalidatedDocuments, REVALIDATED_CACHE_CONTROL);
  assert.equal(manifest.cachePolicy.notFoundDocuments, NOT_FOUND_CACHE_CONTROL);
  assert.equal(manifest.cachePolicy.serviceWorker, false);
  assert.deepEqual(manifest.controls.map(entry => entry.path), ['_headers']);
  assert.equal(manifest.inventory.fileCount, manifest.files.length);
  assert.equal(manifest.inventory.totalBytes, manifest.files.reduce((total, file) => total + file.bytes, 0));
  assert.ok(manifest.files.some(entry => entry.path === `assets/${script.fileName}` && entry.cache === 'immutable'));
  assert.ok(manifest.files.some(entry => entry.path === `assets/${graph.fileName}` && entry.cache === 'immutable'));
  assert.deepEqual(
    manifest.files.filter(entry => entry.status === 404).map(entry => [entry.path, entry.url, entry.cache, entry.cacheControl]),
    [
      ['404.html', '/__pinega-release-verification-missing__', 'no-store', NOT_FOUND_CACHE_CONTROL],
      ['ru/404.html', '/ru/__pinega-release-verification-missing__', 'no-store', NOT_FOUND_CACHE_CONTROL],
    ],
  );
  assert.equal(JSON.parse(await readFile(resolve(root, RELEASE_MANIFEST_PATH), 'utf8')).inventory.sha256, manifest.inventory.sha256);
});

test('release manifest detects tampering and refuses stable URLs under the immutable asset namespace', async t => {
  const root = await fixture(t);
  await writeFile(resolve(root, 'index.html'), '<!doctype html><html><body>Pinega</body></html>\n', 'utf8');
  await writeFile(resolve(root, '_headers'), renderReleaseHeaders(['/']), 'utf8');
  await writeFile(resolve(root, 'assets/main-ABCDEFGH.js'), 'export {};\n', 'utf8');
  const manifest = await writeReleaseManifest(root, buildId);
  await writeFile(resolve(root, 'assets/main-ABCDEFGH.js'), 'export const changed = true;\n', 'utf8');
  await assert.rejects(verifyReleaseManifest(root, manifest), /does not match/u);

  await writeFile(resolve(root, 'assets/main.js'), 'export {};\n', 'utf8');
  await assert.rejects(createReleaseManifest(root, buildId), /not content fingerprinted/u);
});

test('Cloudflare header policy keeps immutable and revalidated URL spaces disjoint', () => {
  const headers = renderReleaseHeaders(['/', '/docs/', '/ru/docs/', '/404.html']);
  assert.match(headers, new RegExp(`/assets/\\*\\n  Cache-Control: ${escapeRegex(IMMUTABLE_CACHE_CONTROL)}`, 'u'));
  for (const route of ['/', '/docs/', '/ru/docs/', '/404.html']) {
    assert.match(headers, new RegExp(`(?:^|\\n\\n)${escapeRegex(route)}\\n  Cache-Control: ${escapeRegex(REVALIDATED_CACHE_CONTROL)}`, 'u'));
  }
  assert.doesNotMatch(headers, /^  ETag:/gmu);
  assert.equal((headers.match(/^\/assets\/\*$/gmu) ?? []).length, 1);
  assert.equal((headers.match(new RegExp(escapeRegex(IMMUTABLE_CACHE_CONTROL), 'gu')) ?? []).length, 1);
  assert.equal(headers.includes(`/assets/*\n  Cache-Control: ${REVALIDATED_CACHE_CONTROL}`), false);
});

test('artifact paths have deterministic HTTP mappings and strict fingerprint recognition', () => {
  assert.deepEqual(publicMappingForPath('index.html'), { url: '/', status: 200 });
  assert.deepEqual(publicMappingForPath('docs/index.html'), { url: '/docs/', status: 200 });
  assert.deepEqual(publicMappingForPath('assets/main-ABCDEFGH.js'), { url: '/assets/main-ABCDEFGH.js', status: 200 });
  assert.equal(isFingerprintedAssetPath('assets/main-ABCDEFGH.js'), true);
  assert.equal(isFingerprintedAssetPath('assets/feature-graph-0123456789abcdef.json'), true);
  assert.equal(isFingerprintedAssetPath('assets/main.js'), false);
  assert.equal(isFingerprintedAssetPath('content/model-ABCDEFGH.json'), false);
  assert.throws(() => publicMappingForPath('../secret'), /invalid release artifact path/iu);
});

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'pinega-release-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'assets'), { recursive: true });
  await mkdir(resolve(root, 'source'), { recursive: true });
  await writeFile(resolve(root, 'source/main.js'), 'export const pinega = true;\n', 'utf8');
  return root;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
