import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const defaultHost = '127.0.0.1';
const defaultPort = Number(process.env.PORT ?? 4173);
const liveReloadPath = '/_pinega/live-reload';
const liveReloadScript = `<script data-pinega-live-reload>new EventSource('${liveReloadPath}').onmessage=()=>location.reload();</script>`;
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json'],
  ['.map', 'application/json'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml'],
  ['.woff2', 'font/woff2'],
]);

export async function startPinegaServer({
  root = defaultRoot,
  host = defaultHost,
  port = defaultPort,
  liveReload = false,
  log = true,
} = {}) {
  const clients = new Set();
  const server = createServer((request, response) => {
    void handleRequest(request, response, { root, liveReload, clients }).catch(error => {
      console.error('Pinega website server failed to handle a request.', error);
      if (!response.headersSent) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Internal server error');
      } else {
        response.destroy(error);
      }
    });
  });

  await new Promise((resolveListen, rejectListen) => {
    const onError = error => {
      server.off('listening', onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const url = `http://${host}:${actualPort}`;
  if (log) console.log(`Pinega website: ${url}`);

  return {
    url,
    reload() {
      for (const client of clients) client.write('data: reload\n\n');
    },
    async close() {
      for (const client of clients) client.end();
      clients.clear();
      await new Promise((resolveClose, rejectClose) => {
        server.close(error => (error ? rejectClose(error) : resolveClose()));
      });
    },
  };
}

async function handleRequest(request, response, { root, liveReload, clients }) {
  const method = request.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (liveReload && url.pathname === liveReloadPath) {
    if (method === 'HEAD') {
      response.writeHead(200, liveReloadHeaders()).end();
      return;
    }
    response.writeHead(200, liveReloadHeaders());
    response.write('retry: 1000\n\n');
    clients.add(response);
    response.on('close', () => clients.delete(response));
    return;
  }

  let requested;
  try {
    requested = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad request');
    return;
  }
  const candidates = routeCandidates(requested);

  for (const candidate of candidates) {
    const file = safeResolve(root, candidate);
    if (!file) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (await isFile(file)) {
      await sendFile(file, method, response, 200, liveReload);
      return;
    }
  }

  const notFound = resolve(root, requested === '/ru' || requested.startsWith('/ru/') ? 'ru/404.html' : '404.html');
  if (await isFile(notFound)) {
    await sendFile(notFound, method, response, 404, liveReload);
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
}

function routeCandidates(pathname) {
  if (pathname === '/') return ['/index.html'];
  if (pathname.endsWith('/')) return [`${pathname}index.html`];
  if (extname(pathname)) return [pathname];
  return [pathname, `${pathname}/index.html`];
}

function safeResolve(root, requested) {
  const file = resolve(root, `.${requested}`);
  return file === root || file.startsWith(`${root}${sep}`) ? file : undefined;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function sendFile(path, method, response, status, liveReload) {
  const headers = {
    'Content-Type': mimeTypes.get(extname(path)) ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
  };
  response.writeHead(status, headers);
  if (method === 'HEAD') {
    response.end();
    return;
  }
  if (liveReload && extname(path) === '.html') {
    const html = await readFile(path, 'utf8');
    response.end(injectLiveReload(html));
    return;
  }
  createReadStream(path).pipe(response);
}

function injectLiveReload(html) {
  const index = html.lastIndexOf('</body>');
  return index === -1 ? `${html}\n${liveReloadScript}\n` : `${html.slice(0, index)}${liveReloadScript}\n${html.slice(index)}`;
}

function liveReloadHeaders() {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await startPinegaServer();
