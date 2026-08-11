import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { startPinegaServer } from '../../scripts/serve.mjs';

const html = '<!doctype html><html><body><main>Pinega</main></body></html>\n';

test('live-reload mode is response-only and publishes successful rebuild notifications', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'pinega-web-server-'));
  await writeFile(resolve(root, 'index.html'), html, 'utf8');
  await writeFile(resolve(root, '404.html'), '<!doctype html><html><body>Not found</body></html>\n', 'utf8');

  const server = await startPinegaServer({ root, port: 0, liveReload: true, log: false });
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  const page = await fetch(`${server.url}/`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  const liveHtml = await page.text();
  assert.match(liveHtml, /data-pinega-live-reload/u);
  assert.match(liveHtml, /__PINEGA_INITIAL_RESPONSE_NO_STORE__=true/u);
  assert.equal(await readFile(resolve(root, 'index.html'), 'utf8'), html);

  const events = await fetch(`${server.url}/_pinega/live-reload`);
  assert.equal(events.status, 200);
  assert.match(events.headers.get('content-type') ?? '', /^text\/event-stream/iu);
  const reader = events.body.getReader();
  const decoder = new TextDecoder();
  assert.match(decoder.decode((await reader.read()).value), /retry: 1000/u);
  server.reload();
  assert.match(decoder.decode((await reader.read()).value), /data: reload/u);
  await reader.cancel();
});

test('ordinary serve mode does not alter built HTML', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'pinega-web-server-'));
  await writeFile(resolve(root, 'index.html'), html, 'utf8');
  await mkdir(resolve(root, 'assets'));
  await writeFile(resolve(root, 'assets/main-ABCDEFGH.js'), 'export {}\n', 'utf8');
  await mkdir(resolve(root, 'research/publications/specimen'), { recursive: true });
  await writeFile(resolve(root, 'research/publications/specimen/paper.pdf'), Buffer.from('%PDF-1.7\nPinega\n'));

  const server = await startPinegaServer({ root, port: 0, liveReload: false, log: false });
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  const page = await fetch(`${server.url}/`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.match(page.headers.get('etag') ?? '', /^"sha256-[a-f0-9]{64}"$/u);
  assert.equal(await page.text(), html);

  const notModified = await fetch(`${server.url}/`, {
    headers: { 'If-None-Match': page.headers.get('etag') },
  });
  assert.equal(notModified.status, 304);
  assert.equal(await notModified.text(), '');

  const asset = await fetch(`${server.url}/assets/main-ABCDEFGH.js`);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.match(asset.headers.get('etag') ?? '', /^"sha256-[a-f0-9]{64}"$/u);

  const publication = await fetch(`${server.url}/research/publications/specimen/paper.pdf`);
  assert.equal(publication.status, 200);
  assert.equal(publication.headers.get('content-type'), 'application/pdf');
  assert.equal(publication.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.equal(Buffer.from(await publication.arrayBuffer()).toString(), '%PDF-1.7\nPinega\n');
});

test('not-found responses follow the requested locale prefix', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'pinega-web-server-'));
  await mkdir(resolve(root, 'ru'));
  await writeFile(resolve(root, '404.html'), '<!doctype html><html lang="en"><body>English not found</body></html>\n', 'utf8');
  await writeFile(resolve(root, 'ru/404.html'), '<!doctype html><html lang="ru"><body>Страница не найдена</body></html>\n', 'utf8');

  const server = await startPinegaServer({ root, port: 0, liveReload: false, log: false });
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  const english = await fetch(`${server.url}/missing`);
  assert.equal(english.status, 404);
  assert.equal(english.headers.get('cache-control'), 'no-store');
  assert.equal(english.headers.get('etag'), null);
  assert.match(await english.text(), /lang="en"/u);

  const russian = await fetch(`${server.url}/ru/missing`);
  assert.equal(russian.status, 404);
  assert.equal(russian.headers.get('cache-control'), 'no-store');
  assert.equal(russian.headers.get('etag'), null);
  assert.match(await russian.text(), /lang="ru"/u);
});
