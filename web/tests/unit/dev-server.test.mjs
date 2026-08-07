import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  assert.match(await page.text(), /data-pinega-live-reload/u);
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

  const server = await startPinegaServer({ root, port: 0, liveReload: false, log: false });
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  const page = await fetch(`${server.url}/`);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), html);
});
