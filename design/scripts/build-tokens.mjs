#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const designDirectory = resolve(scriptDirectory, '..');
const sourcePath = resolve(designDirectory, 'tokens/strata.tokens.json');
const outputDirectory = resolve(designDirectory, 'generated');
const checkOnly = process.argv.includes('--check');

const supportedTypes = new Set([
  'color',
  'dimension',
  'duration',
  'number',
  'fontFamily',
  'fontWeight',
  'cubicBezier',
]);

function fail(message) {
  throw new Error(`Pinega token build failed: ${message}`);
}

function validateName(name, path) {
  if (name.startsWith('$')) return;
  if (/[{}.]/u.test(name)) {
    fail(`invalid token/group name ${JSON.stringify(name)} at ${path || '<root>'}; aliases reserve {, }, and .`);
  }
}

function isToken(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, '$value');
}

function flattenTokens(node, path = [], inheritedType = undefined, output = new Map()) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    fail(`group ${path.join('.') || '<root>'} must be an object`);
  }

  const groupType = node.$type ?? inheritedType;
  for (const [name, value] of Object.entries(node)) {
    if (name.startsWith('$')) continue;
    validateName(name, path.join('.'));
    const tokenPath = [...path, name];

    if (isToken(value)) {
      const type = value.$type ?? groupType;
      if (!type) fail(`token ${tokenPath.join('.')} has no $type and does not inherit one`);
      if (!supportedTypes.has(type)) fail(`token ${tokenPath.join('.')} uses unsupported type ${JSON.stringify(type)}`);
      output.set(tokenPath.join('.'), {
        path: tokenPath,
        type,
        value: value.$value,
        description: value.$description ?? '',
        deprecated: value.$deprecated ?? false,
      });
      continue;
    }

    flattenTokens(value, tokenPath, value?.$type ?? groupType, output);
  }
  return output;
}

const aliasPattern = /^\{([^{}]+)\}$/u;

function resolveToken(path, tokens, cache, stack = []) {
  if (cache.has(path)) return cache.get(path);
  const token = tokens.get(path);
  if (!token) fail(`unknown token alias {${path}}`);
  if (stack.includes(path)) fail(`circular alias: ${[...stack, path].join(' -> ')}`);

  let resolvedValue = token.value;
  if (typeof token.value === 'string') {
    const match = token.value.match(aliasPattern);
    if (match) {
      const referenced = resolveToken(match[1], tokens, cache, [...stack, path]);
      if (referenced.type !== token.type) {
        fail(`type mismatch: ${path} (${token.type}) aliases ${match[1]} (${referenced.type})`);
      }
      resolvedValue = referenced.value;
    } else if (token.value.includes('{') || token.value.includes('}')) {
      fail(`token ${path} contains a non-exact alias; composite string aliases are intentionally unsupported`);
    }
  }

  validateValue(path, token.type, resolvedValue);
  const resolved = { ...token, value: structuredClone(resolvedValue) };
  cache.set(path, resolved);
  return resolved;
}

function validateValue(path, type, value) {
  switch (type) {
    case 'color': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${path}: color must be an object`);
      if (value.colorSpace !== 'oklch') fail(`${path}: only oklch source colors are supported in v0.1`);
      if (!Array.isArray(value.components) || value.components.length !== 3 || value.components.some(component => typeof component !== 'number')) {
        fail(`${path}: color components must be [lightness, chroma, hue] numbers`);
      }
      const [lightness, chroma, hue] = value.components;
      if (lightness < 0 || lightness > 1) fail(`${path}: OKLCH lightness must be in [0, 1]`);
      if (chroma < 0) fail(`${path}: OKLCH chroma must be non-negative`);
      if (!Number.isFinite(hue)) fail(`${path}: OKLCH hue must be finite`);
      if (value.alpha !== undefined && (typeof value.alpha !== 'number' || value.alpha < 0 || value.alpha > 1)) {
        fail(`${path}: color alpha must be in [0, 1]`);
      }
      break;
    }
    case 'dimension':
    case 'duration': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${path}: ${type} must be an object`);
      if (typeof value.value !== 'number' || !Number.isFinite(value.value)) fail(`${path}: ${type}.value must be finite`);
      const units = type === 'duration' ? new Set(['ms', 's']) : new Set(['px', 'rem', 'em', 'ch', '%']);
      if (!units.has(value.unit)) fail(`${path}: unsupported ${type} unit ${JSON.stringify(value.unit)}`);
      break;
    }
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path}: number token must be finite`);
      break;
    case 'fontFamily':
      if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== 'string' || item.length === 0)) {
        fail(`${path}: fontFamily must be a non-empty string array`);
      }
      break;
    case 'fontWeight':
      if (typeof value !== 'number' || value < 1 || value > 1000) fail(`${path}: fontWeight must be a number in [1, 1000]`);
      break;
    case 'cubicBezier':
      if (!Array.isArray(value) || value.length !== 4 || value.some(item => typeof item !== 'number' || !Number.isFinite(item))) {
        fail(`${path}: cubicBezier must contain four finite numbers`);
      }
      if (value[0] < 0 || value[0] > 1 || value[2] < 0 || value[2] > 1) {
        fail(`${path}: cubicBezier x coordinates must be in [0, 1]`);
      }
      break;
    default:
      fail(`${path}: unhandled token type ${type}`);
  }
}

function formatNumber(value) {
  if (Object.is(value, -0)) return '0';
  return Number(value.toFixed(6)).toString();
}

function cssColor(value) {
  const [lightness, chroma, hue] = value.components;
  const alpha = value.alpha ?? 1;
  const base = `oklch(${formatNumber(lightness * 100)}% ${formatNumber(chroma)} ${formatNumber(hue)}`;
  return alpha === 1 ? `${base})` : `${base} / ${formatNumber(alpha)})`;
}

function cssValue(token) {
  const { type, value } = token;
  switch (type) {
    case 'color': return cssColor(value);
    case 'dimension': return `${formatNumber(value.value)}${value.unit}`;
    case 'duration': return `${formatNumber(value.value)}${value.unit}`;
    case 'number': return formatNumber(value);
    case 'fontFamily': return value.map(item => (/^[a-z-]+$/iu.test(item) ? item : JSON.stringify(item))).join(', ');
    case 'fontWeight': return formatNumber(value);
    case 'cubicBezier': return `cubic-bezier(${value.map(formatNumber).join(', ')})`;
    default: fail(`cannot format CSS value for ${type}`);
  }
}

function typstValue(token, remBasePt) {
  const { type, value } = token;
  switch (type) {
    case 'color': {
      const [lightness, chroma, hue] = value.components;
      const alpha = value.alpha ?? 1;
      return `oklch(${formatNumber(lightness * 100)}%, ${formatNumber(chroma)}, ${formatNumber(hue)}deg, ${formatNumber(alpha * 100)}%)`;
    }
    case 'dimension': {
      const conversions = {
        rem: `${formatNumber(value.value * remBasePt)}pt`,
        em: `${formatNumber(value.value)}em`,
        px: `${formatNumber(value.value * 0.75)}pt`,
        ch: `${formatNumber(value.value * 0.5)}em`,
        '%': `${formatNumber(value.value)}%`,
      };
      return conversions[value.unit];
    }
    case 'duration': {
      const milliseconds = value.unit === 's' ? value.value * 1000 : value.value;
      return formatNumber(milliseconds);
    }
    case 'number': return formatNumber(value);
    case 'fontFamily': return `(${value.map(item => JSON.stringify(item)).join(', ')},)`;
    case 'fontWeight': return formatNumber(value);
    case 'cubicBezier': return `(${value.map(formatNumber).join(', ')})`;
    default: fail(`cannot format Typst value for ${type}`);
  }
}

function cssName(path) {
  let parts;
  if (path[0] === 'reference') parts = ['ref', ...path.slice(1)];
  else if (path[0] === 'system' && (path[1] === 'light' || path[1] === 'dark')) parts = ['sys', ...path.slice(2)];
  else if (path[0] === 'system') parts = ['sys', ...path.slice(1)];
  else if (path[0] === 'research' && (path[1] === 'light' || path[1] === 'dark')) parts = ['research', ...path.slice(2)];
  else if (path[0] === 'component') parts = ['component', ...path.slice(1)];
  else parts = path;
  return `--pinega-${parts.map(part => part.replace(/[A-Z]/gu, match => `-${match.toLowerCase()}`).toLowerCase()).join('-')}`;
}

function cssBlock(selector, entries) {
  const declarations = entries
    .sort((left, right) => left.path.join('.').localeCompare(right.path.join('.')))
    .map(token => `  ${cssName(token.path)}: ${cssValue(token)};`)
    .join('\n');
  return `${selector} {\n${declarations}\n}`;
}

function buildCss(resolved) {
  const reference = [];
  const sharedSystem = [];
  const lightSystem = [];
  const darkSystem = [];
  const lightResearch = [];
  const darkResearch = [];
  const component = [];

  for (const token of resolved.values()) {
    const [root, mode] = token.path;
    if (root === 'reference') reference.push(token);
    else if (root === 'system' && mode === 'light') lightSystem.push(token);
    else if (root === 'system' && mode === 'dark') darkSystem.push(token);
    else if (root === 'system') sharedSystem.push(token);
    else if (root === 'research' && mode === 'light') lightResearch.push(token);
    else if (root === 'research' && mode === 'dark') darkResearch.push(token);
    else if (root === 'component') component.push(token);
  }

  return `/* Generated from design/tokens/strata.tokens.json. Do not edit. */\n\n@layer pinega.tokens {\n${indent(cssBlock(':root, .pinega-light', [...reference, ...sharedSystem, ...lightSystem, ...lightResearch, ...component]), 2)}\n\n${indent(cssBlock('.pinega-dark', [...darkSystem, ...darkResearch]), 2)}\n\n  @media (prefers-color-scheme: dark) {\n${indent(cssBlock(':root:not(.pinega-light)', [...darkSystem, ...darkResearch]), 4)}\n  }\n\n  @media (prefers-reduced-motion: reduce) {\n    :root {\n      --pinega-sys-motion-duration-fast: 0ms;\n      --pinega-sys-motion-duration-normal: 0ms;\n      --pinega-sys-motion-duration-slow: 0ms;\n    }\n  }\n}\n`;
}

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return text.split('\n').map(line => `${prefix}${line}`).join('\n');
}

function objectFromEntries(entries, valueFormatter) {
  return Object.fromEntries(entries.map(token => [token.path.join('.'), valueFormatter(token)]));
}

function buildTypeScript(resolved) {
  const raw = objectFromEntries([...resolved.values()].sort((a, b) => a.path.join('.').localeCompare(b.path.join('.'))), token => token.value);
  const css = objectFromEntries([...resolved.values()].sort((a, b) => a.path.join('.').localeCompare(b.path.join('.'))), cssValue);
  return `// Generated from design/tokens/strata.tokens.json. Do not edit.\n\nexport const strataTokenValues = ${JSON.stringify(raw, null, 2)} as const;\n\nexport const strataCssValues = ${JSON.stringify(css, null, 2)} as const;\n\nexport type StrataTokenPath = keyof typeof strataTokenValues;\n\nexport function strataCssValue(path: StrataTokenPath): string {\n  return strataCssValues[path];\n}\n`;
}

function typstDictionary(name, entries, remBasePt) {
  const body = entries
    .sort((left, right) => left.path.join('.').localeCompare(right.path.join('.')))
    .map(token => `  ${JSON.stringify(token.path.join('.'))}: ${typstValue(token, remBasePt)},`)
    .join('\n');
  return `#let ${name} = (\n${body}\n)`;
}

function buildTypst(resolved, remBasePt) {
  const tokens = [...resolved.values()];
  const reference = tokens.filter(token => token.path[0] === 'reference');
  const shared = tokens.filter(token => token.path[0] === 'system' && !['light', 'dark'].includes(token.path[1]));
  const component = tokens.filter(token => token.path[0] === 'component');
  const light = tokens.filter(token => token.path[0] === 'system' && token.path[1] === 'light');
  const dark = tokens.filter(token => token.path[0] === 'system' && token.path[1] === 'dark');
  const researchLight = tokens.filter(token => token.path[0] === 'research' && token.path[1] === 'light');
  const researchDark = tokens.filter(token => token.path[0] === 'research' && token.path[1] === 'dark');

  return `// Generated from design/tokens/strata.tokens.json. Do not edit.\n// Duration values are emitted as milliseconds. Reference prose measure is unitless.\n\n${typstDictionary('pinega-strata-reference', reference, remBasePt)}\n\n${typstDictionary('pinega-strata-system', [...shared, ...component], remBasePt)}\n\n${typstDictionary('pinega-strata-light', [...light, ...researchLight], remBasePt)}\n\n${typstDictionary('pinega-strata-dark', [...dark, ...researchDark], remBasePt)}\n\n#let pinega-strata-token(path, mode: \"light\") = {\n  let mode-tokens = if mode == \"dark\" { pinega-strata-dark } else { pinega-strata-light }\n  if path in mode-tokens { return mode-tokens.at(path) }\n  if path in pinega-strata-system { return pinega-strata-system.at(path) }\n  pinega-strata-reference.at(path)\n}\n`;
}

async function writeOrCheck(path, content) {
  if (checkOnly) {
    let existing;
    try {
      existing = await readFile(path, 'utf8');
    } catch {
      fail(`generated file is missing: ${path}`);
    }
    if (existing !== content) fail(`generated file is stale: ${path}`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const extension = source.$extensions?.['dev.pinega.strata'];
if (!extension || extension.formatVersion !== '2025.10') fail('missing Pinega formatVersion 2025.10 extension');
const remBasePt = extension.typstRemBasePt;
if (typeof remBasePt !== 'number' || remBasePt <= 0) fail('typstRemBasePt must be a positive number');

const tokens = flattenTokens(source);
const resolved = new Map();
for (const path of tokens.keys()) resolveToken(path, tokens, resolved);

await writeOrCheck(resolve(outputDirectory, 'strata.tokens.css'), buildCss(resolved));
await writeOrCheck(resolve(outputDirectory, 'strata.tokens.ts'), buildTypeScript(resolved));
await writeOrCheck(resolve(outputDirectory, 'strata.tokens.typ'), buildTypst(resolved, remBasePt));
await writeOrCheck(
  resolve(outputDirectory, 'strata.tokens.manifest.json'),
  `${JSON.stringify({ formatVersion: extension.formatVersion, tokenCount: resolved.size, sources: ['design/tokens/strata.tokens.json'] }, null, 2)}\n`,
);

console.log(`${checkOnly ? 'Verified' : 'Generated'} ${resolved.size} Pinega Strata tokens.`);
