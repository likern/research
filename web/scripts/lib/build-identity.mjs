import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

import {
  BUILD_ID_ALGORITHM,
  BUILD_ID_PLACEHOLDER,
  isBuildId,
} from '../../navigation/contract.mjs';

const excludedArtifactPaths = new Set([
  '.well-known/pinega-deployment.json',
]);

export async function finalizeBuildIdentity(root, identityPaths) {
  const buildId = await computeBuildIdentity(root);
  for (const path of identityPaths) {
    const absolute = resolve(root, path);
    const source = await readFile(absolute, 'utf8');
    const occurrences = source.split(BUILD_ID_PLACEHOLDER).length - 1;
    if (occurrences !== 1) {
      throw new TypeError(`${path}: expected exactly one build ID placeholder, found ${occurrences}`);
    }
    await writeFile(absolute, source.replace(BUILD_ID_PLACEHOLDER, buildId), 'utf8');
  }
  await verifyBuildIdentity(root, buildId, identityPaths);
  return buildId;
}

export async function verifyBuildIdentity(root, buildId, identityPaths) {
  if (!isBuildId(buildId)) throw new TypeError(`Invalid build ID: ${JSON.stringify(buildId)}`);
  const normalized = new Map();
  for (const path of identityPaths) {
    const source = await readFile(resolve(root, path), 'utf8');
    const occurrences = source.split(buildId).length - 1;
    if (occurrences !== 1) throw new TypeError(`${path}: expected exactly one ${buildId}, found ${occurrences}`);
    normalized.set(normalizePath(path), Buffer.from(source.replace(buildId, BUILD_ID_PLACEHOLDER)));
  }
  const actual = await computeBuildIdentity(root, normalized);
  if (actual !== buildId) {
    throw new TypeError(`Build identity mismatch: declared ${buildId}, normalized artifact produced ${actual}`);
  }
}

export async function computeBuildIdentity(root, normalizedFiles = new Map()) {
  const files = await walk(root);
  const hash = createHash('sha256');
  hash.update(`${BUILD_ID_ALGORITHM}\0`);
  for (const absolute of files) {
    const path = normalizePath(relative(root, absolute));
    if (excludedArtifactPaths.has(path)) continue;
    const content = normalizedFiles.get(path) ?? await readFile(absolute);
    hash.update(path);
    hash.update('\0');
    hash.update(String(content.byteLength));
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return `sha256-${hash.digest('hex')}`;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}

function normalizePath(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
