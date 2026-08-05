import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.woff2', 'font/woff2'],
]);

const server = createServer(async (request, response) => {
  const method = request.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  let requested;
  try {
    requested = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad request');
    return;
  }
  const candidates = routeCandidates(requested);

  for (const candidate of candidates) {
    const file = safeResolve(candidate);
    if (!file) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (await isFile(file)) {
      sendFile(file, method, response, 200);
      return;
    }
  }

  const notFound = resolve(root, '404.html');
  if (await isFile(notFound)) {
    sendFile(notFound, method, response, 404);
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Pinega website: http://127.0.0.1:${port}`);
});

function routeCandidates(pathname) {
  if (pathname === '/') return ['/index.html'];
  if (pathname.endsWith('/')) return [`${pathname}index.html`];
  if (extname(pathname)) return [pathname];
  return [pathname, `${pathname}/index.html`];
}

function safeResolve(requested) {
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

function sendFile(path, method, response, status) {
  response.writeHead(status, {
    'Content-Type': mimeTypes.get(extname(path)) ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
  });
  if (method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(path).pipe(response);
}
