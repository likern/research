import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

import { parse, serializeOuter } from 'parse5';
import { parse as parseToml } from 'smol-toml';

export const PUBLICATION_MANIFEST_PATH = 'content/publications-manifest.json';
export const PUBLICATION_MANIFEST_SCHEMA_VERSION = 1;
export const DUAL_TARGET_PROFILE = 'dual-target';

const execFileAsync = promisify(execFile);
const publicationIdPattern = /^[a-z][a-z0-9-]*$/u;
const documentIdPattern = /^[a-z][a-z0-9-]*$/u;
const expectedHtmlDiagnostic = 'warning: html export is under active development and incomplete';
const forbiddenArticleElements = new Set([
  'base',
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'meta',
  'object',
  'script',
  'select',
  'style',
  'textarea',
]);

export function parseResearchRegistry(source) {
  if (typeof source !== 'string' || source.trim() === '') throw new TypeError('research.toml must be a non-empty string.');
  const registry = parseToml(source);
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('research.toml must decode to an object.');
  return registry;
}

export function createPublicationPlan(contentIndex, researchRegistry) {
  if (!contentIndex || typeof contentIndex !== 'object' || Array.isArray(contentIndex)) throw new TypeError('Content index must be an object.');
  if (contentIndex.schema_version !== 4) throw new TypeError(`Publication pipeline requires content schema v4, received ${JSON.stringify(contentIndex.schema_version)}.`);
  if (!researchRegistry || typeof researchRegistry !== 'object' || Array.isArray(researchRegistry)) throw new TypeError('Research registry must be an object.');
  if (researchRegistry.schema !== 1) throw new TypeError(`Unsupported research registry schema: ${JSON.stringify(researchRegistry.schema)}.`);
  if (researchRegistry.typst?.html_enabled !== false) throw new TypeError('Gate 5.1 requires global Typst HTML export to remain disabled.');
  if (!Array.isArray(researchRegistry.typst?.html_profiles)
    || researchRegistry.typst.html_profiles.length !== 1
    || researchRegistry.typst.html_profiles[0] !== DUAL_TARGET_PROFILE) {
    throw new TypeError(`research.toml HTML profiles must be exactly [${JSON.stringify(DUAL_TARGET_PROFILE)}].`);
  }
  if (!Array.isArray(researchRegistry.documents)) throw new TypeError('research.toml must contain a documents array.');

  const documents = new Map();
  for (const document of researchRegistry.documents) {
    requireObject(document, 'research document');
    requireIdentifier(document.id, 'research document id', documentIdPattern);
    if (documents.has(document.id)) throw new TypeError(`Duplicate research document id: ${document.id}.`);
    documents.set(document.id, document);
  }

  const locales = Object.keys(contentIndex.site?.locales ?? {});
  if (locales.length === 0) throw new TypeError('Content index has no site locales.');
  const plans = [];
  const referencedDocuments = new Set();
  const pdfOutputs = new Set();
  const pdfUrls = new Set();

  for (const entry of contentIndex.entries ?? []) {
    requireObject(entry, 'content entry');
    if (!entry.publication) {
      for (const localized of Object.values(entry.locales ?? {})) {
        if (localized?.publication_document_id !== undefined) {
          throw new TypeError(`${entry.id}: publication_document_id requires an entry-level publication contract.`);
        }
      }
      continue;
    }

    requireObject(entry.publication, `${entry.id}.publication`);
    if (entry.content_type !== 'research-publication') throw new TypeError(`${entry.id}: publication entries must use content_type research-publication.`);
    if (entry.publication.profile !== DUAL_TARGET_PROFILE) throw new TypeError(`${entry.id}: Gate 5.1 supports only the ${DUAL_TARGET_PROFILE} profile.`);
    requireIdentifier(entry.publication.slug, `${entry.id}.publication.slug`, publicationIdPattern);
    if (entry.publication.slug !== entry.id.replace(/^publication-/u, '')) {
      throw new TypeError(`${entry.id}: publication slug must match the logical entry id suffix.`);
    }

    for (const [locale, localized] of Object.entries(entry.locales ?? {})) {
      if (!locales.includes(locale)) throw new TypeError(`${entry.id}: unknown publication locale ${locale}.`);
      requireObject(localized, `${entry.id}.locales.${locale}`);
      requireIdentifier(localized.publication_document_id, `${entry.id}.${locale}.publication_document_id`, documentIdPattern);
      if (referencedDocuments.has(localized.publication_document_id)) {
        throw new TypeError(`Research document ${localized.publication_document_id} is referenced more than once.`);
      }
      const document = documents.get(localized.publication_document_id);
      if (!document) throw new TypeError(`${entry.id}.${locale}: unknown research document ${localized.publication_document_id}.`);
      if (document.publication_profile !== entry.publication.profile) {
        throw new TypeError(`${localized.publication_document_id}: publication profile does not match ${entry.id}.`);
      }
      if (document.locale !== locale) throw new TypeError(`${localized.publication_document_id}: locale ${JSON.stringify(document.locale)} does not match ${locale}.`);
      if (!Array.isArray(document.formats) || !document.formats.includes('html') || !document.formats.includes('pdf')) {
        throw new TypeError(`${localized.publication_document_id}: dual-target documents require html and pdf formats.`);
      }
      if (!Array.isArray(document.categories) || !document.categories.includes('web-publication')) {
        throw new TypeError(`${localized.publication_document_id}: publication document must use the web-publication category.`);
      }
      requireString(document.source, `${localized.publication_document_id}.source`);
      if (!document.source.startsWith('ydmp/publications/')) throw new TypeError(`${localized.publication_document_id}: publication source must live below ydmp/publications/.`);
      requireString(localized.route, `${entry.id}.${locale}.route`);
      requireString(localized.output_path, `${entry.id}.${locale}.output_path`);
      requireString(localized.navigation_title, `${entry.id}.${locale}.navigation_title`);
      if (!localized.route.endsWith(`/${entry.publication.slug}/`)) {
        throw new TypeError(`${entry.id}.${locale}: route must end in /${entry.publication.slug}/.`);
      }
      if (!localized.output_path.endsWith('/index.html')) throw new TypeError(`${entry.id}.${locale}: publication output must end in /index.html.`);

      const pdfOutput = `${localized.output_path.slice(0, -'index.html'.length)}paper.pdf`;
      const pdfUrl = `${localized.route}paper.pdf`;
      addUnique(pdfOutputs, pdfOutput, 'publication PDF output');
      addUnique(pdfUrls, pdfUrl, 'publication PDF URL');
      referencedDocuments.add(localized.publication_document_id);
      plans.push(Object.freeze({
        entryId: entry.id,
        publicationId: entry.publication.slug,
        profile: entry.publication.profile,
        locale,
        language: contentIndex.site.locales[locale].lang,
        documentId: localized.publication_document_id,
        source: document.source,
        title: localized.navigation_title,
        route: localized.route,
        output: localized.output_path,
        pdfOutput,
        pdfUrl,
      }));
    }
  }

  if (plans.length === 0) throw new TypeError('Gate 5.1 requires at least one publication locale variant.');
  const allowlistedDocuments = [...documents.values()].filter(document => document.publication_profile !== undefined);
  const unreferenced = allowlistedDocuments.filter(document => !referencedDocuments.has(document.id));
  if (unreferenced.length > 0) {
    throw new TypeError(`Publication documents are not joined to Web routes: ${unreferenced.map(document => document.id).join(', ')}.`);
  }
  return Object.freeze(plans.toSorted((left, right) => compareText(left.route, right.route)));
}

export async function buildPublications({ contentIndex, dist, repositoryRoot, webRoot }) {
  const registrySource = await readFile(resolve(repositoryRoot, 'research.toml'), 'utf8');
  const researchRegistry = parseResearchRegistry(registrySource);
  const plans = createPublicationPlan(contentIndex, researchRegistry);
  const typstVersion = (await readFile(resolve(repositoryRoot, researchRegistry.toolchain.typst_version_file), 'utf8')).trim();
  const typst = await resolveTypstBinary(repositoryRoot, researchRegistry, typstVersion);
  const mathCss = await readFile(resolve(webRoot, 'src/styles/typst-mathml.css'), 'utf8');
  const buildRoot = resolve(dist, '.publication-build');
  const packageCache = process.env.TYPST_PACKAGE_CACHE_PATH ?? resolve(repositoryRoot, '.tools/typst-package-cache');
  await mkdir(buildRoot, { recursive: true });
  await mkdir(packageCache, { recursive: true });

  const articles = new Map();
  const manifestEntries = [];
  try {
    for (const plan of plans) {
      const source = resolve(repositoryRoot, plan.source);
      await assertFile(source, `${plan.documentId}: source`);
      const htmlOutput = resolve(buildRoot, `${plan.documentId}.html`);
      const pdfOutput = resolve(dist, plan.pdfOutput);
      await mkdir(dirname(pdfOutput), { recursive: true });

      const compileEnvironment = {
        ...process.env,
        SOURCE_DATE_EPOCH: '0',
        TYPST_PACKAGE_CACHE_PATH: packageCache,
      };
      await compileTypst(typst, [
        'compile',
        '--root', repositoryRoot,
        '--features', 'html',
        '--format', 'html',
        '--pretty',
        '--jobs', '1',
        '--diagnostic-format', 'short',
        source,
        htmlOutput,
      ], { cwd: repositoryRoot, environment: compileEnvironment, expectedDiagnostic: expectedHtmlDiagnostic });
      await compileTypst(typst, [
        'compile',
        '--root', repositoryRoot,
        '--creation-timestamp', '0',
        '--jobs', '1',
        '--diagnostic-format', 'short',
        source,
        pdfOutput,
      ], { cwd: repositoryRoot, environment: compileEnvironment, expectedDiagnostic: '' });

      const standaloneHtml = await readFile(htmlOutput, 'utf8');
      const article = extractPublicationArticle(standaloneHtml, plan, mathCss);
      articles.set(`${plan.entryId}:${plan.locale}`, article);
      const pdf = await readFile(pdfOutput);
      manifestEntries.push(Object.freeze({
        id: plan.publicationId,
        locale: plan.locale,
        language: plan.language,
        profile: plan.profile,
        documentId: plan.documentId,
        source: plan.source,
        route: plan.route,
        readOutput: plan.output,
        htmlArticle: Object.freeze({ bytes: Buffer.byteLength(article), sha256: sha256(article) }),
        pdf: Object.freeze({ url: plan.pdfUrl, output: plan.pdfOutput, bytes: pdf.byteLength, sha256: sha256(pdf) }),
      }));
    }
  } finally {
    await rm(buildRoot, { recursive: true, force: true });
  }

  const tokenSource = await readFile(resolve(repositoryRoot, 'design/tokens/strata.tokens.json'));
  const tokenManifest = JSON.parse(await readFile(resolve(repositoryRoot, 'design/generated/strata.tokens.manifest.json'), 'utf8'));
  const manifest = Object.freeze({
    schemaVersion: PUBLICATION_MANIFEST_SCHEMA_VERSION,
    kind: 'pinega-dual-target-publications',
    toolchain: Object.freeze({ typst: typstVersion, htmlFeature: 'experimental-allowlist', sourceDateEpoch: 0 }),
    design: Object.freeze({
      system: 'Pinega Strata',
      tokenFormatVersion: tokenManifest.formatVersion,
      tokenCount: tokenManifest.tokenCount,
      sourceSha256: sha256(tokenSource),
    }),
    entries: Object.freeze(manifestEntries),
  });
  const manifestOutput = resolve(dist, PUBLICATION_MANIFEST_PATH);
  await mkdir(dirname(manifestOutput), { recursive: true });
  await writeFile(manifestOutput, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return Object.freeze({
    articles,
    manifest,
    plans,
    artifactRoutes: Object.freeze(plans.map(plan => plan.pdfUrl)),
  });
}

export function extractPublicationArticle(standaloneHtml, expected, expectedMathCss) {
  if (typeof standaloneHtml !== 'string' || standaloneHtml.trim() === '') throw new TypeError('Typst HTML output must be a non-empty string.');
  const document = parse(standaloneHtml);
  const roots = findElements(document, element => element.tagName === 'html');
  const root = exactlyOne(roots, 'Typst html root');
  const rootAttributes = attributes(root);
  if (rootAttributes.get('lang') !== expected.language) {
    throw new TypeError(`${expected.documentId}: Typst root language does not match ${expected.language}.`);
  }
  const head = exactlyOne(findElements(root, element => element.tagName === 'head'), 'Typst head');
  const body = exactlyOne(findElements(root, element => element.tagName === 'body'), 'Typst body');
  const styles = findElements(head, element => element.tagName === 'style');
  const mathStyle = textContent(exactlyOne(styles, 'Typst MathML stylesheet'));
  if (normalizeCss(mathStyle) !== normalizeCss(expectedMathCss)) {
    throw new TypeError(`${expected.documentId}: Typst MathML stylesheet drifted from the checked-in Pinega adapter.`);
  }

  const article = exactlyOne(findElements(body, element => element.tagName === 'article'), 'Typst publication article');
  const articleAttributes = attributes(article);
  assertAttribute(articleAttributes, 'data-pinega-publication-id', expected.publicationId, expected.documentId);
  assertAttribute(articleAttributes, 'data-pinega-publication-profile', expected.profile, expected.documentId);
  assertAttribute(articleAttributes, 'data-pinega-publication-locale', expected.locale, expected.documentId);
  const headings = findElements(article, element => /^h[1-6]$/u.test(element.tagName ?? ''));
  const h1 = headings.filter(element => element.tagName === 'h1');
  if (h1.length !== 1 || textContent(h1[0]).trim() !== expected.title) {
    throw new TypeError(`${expected.documentId}: publication article must contain exactly one matching h1.`);
  }

  const endnotes = findElements(body, element => element.tagName === 'section' && attributes(element).get('role') === 'doc-endnotes')
    .filter(element => !isDescendant(article, element));
  const endnote = exactlyOne(endnotes, 'Typst publication endnotes');
  detach(endnote);
  setAttribute(endnote, 'class', 'pinega-publication-endnotes');
  endnote.parentNode = article;
  article.childNodes.push(endnote);

  const ids = new Set();
  for (const element of findElements(article, () => true)) {
    const values = attributes(element);
    if (forbiddenArticleElements.has(element.tagName)) throw new TypeError(`${expected.documentId}: forbidden <${element.tagName}> in publication article.`);
    for (const [name, value] of values) {
      if (/^on/iu.test(name)) throw new TypeError(`${expected.documentId}: event handler attribute ${name} is forbidden.`);
      if (name === 'style') {
        if (!['ol', 'ul'].includes(element.tagName) || value !== 'list-style-type: none') {
          throw new TypeError(`${expected.documentId}: unexpected inline style on <${element.tagName}>.`);
        }
        removeAttribute(element, 'style');
      }
      if (name === 'href') assertSafeUrl(value, expected.documentId);
      if (name === 'src') assertSafeUrl(value, expected.documentId);
    }
    const id = attributes(element).get('id');
    if (id) addUnique(ids, id, `${expected.documentId} article id`);
  }
  if (findElements(article, element => element.tagName === 'math').length < 3) throw new TypeError(`${expected.documentId}: specimen must exercise MathML.`);
  if (findElements(article, element => element.tagName === 'table').length !== 1) throw new TypeError(`${expected.documentId}: specimen must contain one semantic table.`);
  const codeBlocks = findElements(article, element => element.tagName === 'pre');
  if (codeBlocks.length < 1) throw new TypeError(`${expected.documentId}: specimen must contain a code block.`);
  for (const codeBlock of codeBlocks) setAttribute(codeBlock, 'tabindex', '0');
  if (findElements(article, element => attributes(element).has('data-pinega-diagram-placeholder')).length !== 1) {
    throw new TypeError(`${expected.documentId}: specimen must contain one shared semantic diagram placeholder.`);
  }
  if (findElements(article, element => attributes(element).get('role') === 'doc-bibliography').length !== 1) {
    throw new TypeError(`${expected.documentId}: specimen must contain one bibliography.`);
  }
  return serializeOuter(article);
}

async function resolveTypstBinary(repositoryRoot, registry, requiredVersion) {
  const override = process.env[registry.toolchain.typst_override_env];
  const candidates = [
    override,
    resolve(repositoryRoot, registry.toolchain.local_tools_root, 'typst', requiredVersion, process.platform === 'win32' ? 'typst.exe' : 'typst'),
    process.platform === 'win32' ? 'typst.exe' : 'typst',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const { stdout, stderr } = await execFileAsync(candidate, ['--version'], { cwd: repositoryRoot, maxBuffer: 1024 * 1024 });
      if (stderr.trim()) throw new TypeError(`Typst version probe emitted diagnostics: ${stderr.trim()}`);
      const actual = stdout.match(/typst\s+([0-9]+\.[0-9]+\.[0-9]+)/u)?.[1];
      if (actual !== requiredVersion) throw new TypeError(`Unsupported Typst: expected ${requiredVersion}, got ${actual ?? stdout.trim()}.`);
      return candidate;
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
  }
  throw new TypeError(`Typst ${requiredVersion} is unavailable. Install the pinned toolchain or set ${registry.toolchain.typst_override_env}.`);
}

async function compileTypst(binary, arguments_, { cwd, environment, expectedDiagnostic }) {
  try {
    const { stdout, stderr } = await execFileAsync(binary, arguments_, {
      cwd,
      env: environment,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (stdout.trim()) throw new TypeError(`Typst unexpectedly wrote to stdout: ${stdout.trim()}`);
    const diagnostic = filterTypstPackageProgress(stderr);
    if (diagnostic !== expectedDiagnostic) {
      throw new TypeError(`Unexpected Typst diagnostics. Expected ${JSON.stringify(expectedDiagnostic)}, got ${JSON.stringify(diagnostic)}.`);
    }
  } catch (error) {
    if (error?.stderr || error?.stdout) {
      throw new TypeError(`Typst compilation failed: ${(error.stderr || error.stdout).trim()}`, { cause: error });
    }
    throw error;
  }
}

export function filterTypstPackageProgress(stderr) {
  const lines = String(stderr)
    .replace(/\u001b\[[0-9;]*[A-Za-z]/gu, '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  return lines.filter(line => !isTypstPackageProgress(line)).join('\n');
}

function isTypstPackageProgress(line) {
  if (/^downloading @preview\/[a-z0-9][a-z0-9-]*:[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/u.test(line)) return true;
  return /^[0-9]+(?:\.[0-9]+)? (?:B|KiB|MiB|GiB) \/\s*[0-9]+(?:\.[0-9]+)? (?:B|KiB|MiB|GiB) \(\s*[0-9]+ %\),\s*[0-9]+(?:\.[0-9]+)? (?:B|KiB|MiB|GiB)\/s, ETA: [0-9]+ s$/u.test(line);
}

function normalizeCss(value) {
  return String(value)
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll('"', "'")
    .replace(/\s+/gu, ' ')
    .replace(/\s*([{}:;,>])\s*/gu, '$1')
    .trim();
}

function assertSafeUrl(value, documentId) {
  if (value.startsWith('#')) return;
  const url = new URL(value, 'https://pinega.example/');
  if (!['https:', 'http:'].includes(url.protocol)) throw new TypeError(`${documentId}: forbidden URL scheme in ${JSON.stringify(value)}.`);
}

function findElements(node, predicate, output = []) {
  if (node?.tagName && predicate(node)) output.push(node);
  for (const child of node?.childNodes ?? []) findElements(child, predicate, output);
  return output;
}

function attributes(element) {
  return new Map((element?.attrs ?? []).map(attribute => [attribute.name, attribute.value]));
}

function textContent(node) {
  if (node?.nodeName === '#text') return node.value ?? '';
  return (node?.childNodes ?? []).map(textContent).join('');
}

function setAttribute(element, name, value) {
  const existing = element.attrs.find(attribute => attribute.name === name);
  if (existing) existing.value = value;
  else element.attrs.push({ name, value });
}

function removeAttribute(element, name) {
  element.attrs = element.attrs.filter(attribute => attribute.name !== name);
}

function detach(node) {
  const parent = node.parentNode;
  if (!parent) throw new TypeError('Cannot detach a node without a parent.');
  parent.childNodes = parent.childNodes.filter(child => child !== node);
  node.parentNode = null;
}

function isDescendant(ancestor, candidate) {
  let node = candidate.parentNode;
  while (node) {
    if (node === ancestor) return true;
    node = node.parentNode;
  }
  return false;
}

function exactlyOne(values, label) {
  if (values.length !== 1) throw new TypeError(`Expected exactly one ${label}, found ${values.length}.`);
  return values[0];
}

function assertAttribute(values, name, expected, prefix) {
  if (values.get(name) !== expected) throw new TypeError(`${prefix}: expected ${name}=${JSON.stringify(expected)}.`);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string.`);
}

function requireIdentifier(value, label, pattern) {
  requireString(value, label);
  if (!pattern.test(value)) throw new TypeError(`${label} is invalid: ${JSON.stringify(value)}.`);
}

function addUnique(values, value, label) {
  if (values.has(value)) throw new TypeError(`Duplicate ${label}: ${JSON.stringify(value)}.`);
  values.add(value);
}

async function assertFile(path, label) {
  try {
    await access(path);
    if (!(await stat(path)).isFile()) throw new TypeError(`${label} is not a file: ${path}.`);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new TypeError(`${label} is missing: ${path}.`);
    throw error;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
