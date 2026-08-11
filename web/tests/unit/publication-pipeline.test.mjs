import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  createPublicationPlan,
  extractPublicationArticle,
  filterTypstPackageProgress,
  parseResearchRegistry,
} from '../../scripts/lib/publication-pipeline.mjs';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repositoryRoot = resolve(webRoot, '..');
const contentIndex = JSON.parse(await readFile(resolve(webRoot, 'content/content-index.json'), 'utf8'));
const researchRegistry = parseResearchRegistry(await readFile(resolve(repositoryRoot, 'research.toml'), 'utf8'));
const mathCss = await readFile(resolve(webRoot, 'src/styles/typst-mathml.css'), 'utf8');
const expectedArticle = Object.freeze({
  publicationId: 'dual-target-contract',
  profile: 'dual-target',
  locale: 'en',
  language: 'en',
  documentId: 'publication-dual-target-contract-en',
  title: 'One source, two reading contracts',
});

test('Gate 5.1 closes the content-index to research-registry join for both locales', () => {
  const plans = createPublicationPlan(contentIndex, researchRegistry);
  assert.deepEqual(plans.map(plan => ({
    documentId: plan.documentId,
    locale: plan.locale,
    route: plan.route,
    pdfUrl: plan.pdfUrl,
    pdfOutput: plan.pdfOutput,
  })), [
    {
      documentId: 'publication-dual-target-contract-en',
      locale: 'en',
      route: '/research/publications/dual-target-contract/',
      pdfUrl: '/research/publications/dual-target-contract/paper.pdf',
      pdfOutput: 'research/publications/dual-target-contract/paper.pdf',
    },
    {
      documentId: 'publication-dual-target-contract-ru',
      locale: 'ru',
      route: '/ru/research/publications/dual-target-contract/',
      pdfUrl: '/ru/research/publications/dual-target-contract/paper.pdf',
      pdfOutput: 'ru/research/publications/dual-target-contract/paper.pdf',
    },
  ]);
  assert.equal(researchRegistry.typst.html_enabled, false, 'arbitrary Typst HTML must remain disabled');
  assert.deepEqual(researchRegistry.typst.html_profiles, ['dual-target']);
});

test('publication planning rejects registry drift and any expansion of the experimental HTML boundary', () => {
  const cases = [
    {
      name: 'global HTML enablement',
      expected: /global Typst HTML export to remain disabled/u,
      mutate: (_index, registry) => { registry.typst.html_enabled = true; },
    },
    {
      name: 'missing profile allowlist',
      expected: /profiles must be exactly/u,
      mutate: (_index, registry) => { registry.typst.html_profiles = []; },
    },
    {
      name: 'expanded profile allowlist',
      expected: /profiles must be exactly/u,
      mutate: (_index, registry) => { registry.typst.html_profiles.push('unreviewed-html'); },
    },
    {
      name: 'unknown localized document',
      expected: /unknown research document/u,
      mutate: index => { index.entries.find(entry => entry.id === 'publication-dual-target-contract').locales.en.publication_document_id = 'publication-missing-en'; },
    },
    {
      name: 'locale mismatch',
      expected: /does not match en/u,
      mutate: (_index, registry) => { registry.documents.find(document => document.id === 'publication-dual-target-contract-en').locale = 'ru'; },
    },
    {
      name: 'missing PDF output',
      expected: /require html and pdf/u,
      mutate: (_index, registry) => { registry.documents.find(document => document.id === 'publication-dual-target-contract-en').formats = ['html']; },
    },
    {
      name: 'unreferenced allowlisted source',
      expected: /not joined to Web routes/u,
      mutate: (_index, registry) => {
        registry.documents.push({
          ...structuredClone(registry.documents.find(document => document.id === 'publication-dual-target-contract-en')),
          id: 'publication-unreferenced-en',
        });
      },
    },
  ];

  for (const fixture of cases) {
    const index = structuredClone(contentIndex);
    const registry = structuredClone(researchRegistry);
    fixture.mutate(index, registry);
    assert.throws(() => createPublicationPlan(index, registry), fixture.expected, fixture.name);
  }
});

test('standalone Typst HTML is reduced to one inert semantic article', () => {
  const article = extractPublicationArticle(validStandaloneHtml(), expectedArticle, mathCss);
  assert.match(article, /^<article class="pinega-publication-article"/u);
  assert.match(article, /<h1 id="publication-title">One source, two reading contracts<\/h1>/u);
  assert.match(article, /<section role="doc-endnotes" class="pinega-publication-endnotes">/u);
  assert.doesNotMatch(article, /<html|<head|<body|<style|style=/u);
  assert.equal((article.match(/<math/gu) ?? []).length, 3);
  assert.match(article, /<pre tabindex="0"><code>return projection;<\/code><\/pre>/u);
});

test('HTML adapter rejects active content, unsafe URLs, duplicate identities, and compiler CSS drift', () => {
  const cases = [
    {
      name: 'active content',
      html: validStandaloneHtml().replace('<pre>', '<script>void 0</script><pre>'),
      css: mathCss,
      expected: /forbidden <script>/u,
    },
    {
      name: 'unsafe URL',
      html: validStandaloneHtml().replace('href="https://doi.org/example"', 'href="javascript:alert(1)"'),
      css: mathCss,
      expected: /forbidden URL scheme/u,
    },
    {
      name: 'duplicate IDs',
      html: validStandaloneHtml().replace('<pre>', '<p id="publication-title">duplicate</p><pre>'),
      css: mathCss,
      expected: /Duplicate publication-dual-target-contract-en article id/u,
    },
    {
      name: 'MathML stylesheet drift',
      html: validStandaloneHtml(),
      css: `${mathCss}\nmath { color: red; }`,
      expected: /MathML stylesheet drifted/u,
    },
  ];
  for (const fixture of cases) {
    assert.throws(
      () => extractPublicationArticle(fixture.html, expectedArticle, fixture.css),
      fixture.expected,
      fixture.name,
    );
  }
});

test('fresh-cache package progress cannot mask Typst diagnostics', () => {
  const output = [
    'downloading @preview/cetz:0.5.2',
    '',
    '  0 B / 213.8 KiB (  0 %),   2.1 MiB/s, ETA: 0 s',
    '213.8 KiB / 213.8 KiB (100 %),   1.5 MiB/s, ETA: 0 s',
    'downloading @preview/oxifmt:1.0.0',
    'warning: html export is under active development and incomplete',
  ].join('\r\n');
  assert.equal(filterTypstPackageProgress(output), 'warning: html export is under active development and incomplete');
  assert.equal(filterTypstPackageProgress(`${output}\nunexpected compiler warning`), 'warning: html export is under active development and incomplete\nunexpected compiler warning');
});

function validStandaloneHtml() {
  return `<!doctype html>
<html lang="en">
  <head><style>${mathCss}</style></head>
  <body>
    <article class="pinega-publication-article" data-pinega-publication-id="dual-target-contract" data-pinega-publication-profile="dual-target" data-pinega-publication-locale="en" aria-labelledby="publication-title">
      <h1 id="publication-title">One source, two reading contracts</h1>
      <p><a href="https://doi.org/example">Reference</a></p>
      <math><mi>x</mi></math><math><mi>y</mi></math><math display="block"><mi>z</mi></math>
      <table><tbody><tr><td>Meaning</td></tr></tbody></table>
      <pre><code>return projection;</code></pre>
      <div class="pinega-publication-diagram-slot" data-pinega-diagram-placeholder="linearizability-overlap"></div>
      <section role="doc-bibliography"><ul style="list-style-type: none"><li id="reference-one">Reference</li></ul></section>
    </article>
    <section role="doc-endnotes"><ol style="list-style-type: none"><li id="note-one">Note</li></ol></section>
  </body>
</html>`;
}
