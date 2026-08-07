import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { startPinegaServer } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = resolve(root, 'scripts/build.mjs');
const watchedPaths = [
  resolve(root, 'src'),
  resolve(root, 'content'),
  resolve(root, 'pages'),
  resolve(root, 'static'),
  resolve(root, '../design/tokens'),
  resolve(root, '../design/diagrams'),
  resolve(root, '../design/scripts/build-tokens.mjs'),
];
const debounceMilliseconds = 80;
const abortController = new AbortController();
const pendingChanges = new Set();
let activeBuild;
let buildRunning = false;
let rebuildQueued = false;
let debounceTimer;
let shuttingDown = false;

const server = await startPinegaServer({ liveReload: true });
for (const path of watchedPaths) await watchPath(path);
console.log(`Pinega dev: watching ${watchedPaths.length} source roots`);
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

rebuildQueued = true;
pendingChanges.add('initial build');
await drainBuildQueue();

async function watchPath(path) {
  await access(path);
  watch(path, { recursive: true, signal: abortController.signal }, (_event, filename) => {
    const changed = filename ? resolve(path, filename.toString()) : path;
    scheduleRebuild(relative(resolve(root, '..'), changed));
  });
}

function scheduleRebuild(changed) {
  pendingChanges.add(changed);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    rebuildQueued = true;
    void drainBuildQueue();
  }, debounceMilliseconds);
}

async function drainBuildQueue() {
  if (buildRunning || shuttingDown) return;
  buildRunning = true;
  try {
    while (rebuildQueued && !shuttingDown) {
      rebuildQueued = false;
      const changes = [...pendingChanges].sort();
      pendingChanges.clear();
      const suffix = changes.length === 1 ? changes[0] : `${changes.length} changes`;
      console.log(`\nPinega dev: rebuilding (${suffix})`);
      const succeeded = await runBuild();
      if (succeeded) {
        console.log('Pinega dev: build succeeded; reloading browsers');
        server.reload();
      } else if (!shuttingDown) {
        console.error('Pinega dev: build failed; browser not reloaded. Watching for the next change.');
      }
    }
  } finally {
    buildRunning = false;
  }
}

function runBuild() {
  return new Promise(resolveBuild => {
    activeBuild = spawn(process.execPath, [buildScript], {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    });
    activeBuild.once('error', error => {
      console.error('Pinega dev: failed to start the build.', error);
      activeBuild = undefined;
      resolveBuild(false);
    });
    activeBuild.once('exit', (code, signal) => {
      activeBuild = undefined;
      resolveBuild(code === 0 && signal === null);
    });
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(debounceTimer);
  abortController.abort();
  if (activeBuild && !activeBuild.killed) activeBuild.kill('SIGTERM');
  await server.close();
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
}
