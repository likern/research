import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(webRoot, '..');
const modelRoot = resolve(repositoryRoot, 'design/diagrams/models');
const outputRoot = resolve(process.argv[2] ?? '../artifacts/scientific-diagrams/web');
const baseUrl = process.env.PINEGA_REVIEW_BASE_URL ?? 'http://127.0.0.1:4173';
const diagramVersion = process.env.PINEGA_DIAGRAM_VERSION ?? 'development';
const ids = [
  'linearizability-overlap',
  'version-chain-snapshot',
  'buffer-frame-lifecycle',
];

await Promise.all([
  mkdir(resolve(outputRoot, 'png'), { recursive: true }),
  mkdir(resolve(outputRoot, 'svg'), { recursive: true }),
  mkdir(resolve(outputRoot, 'pdf'), { recursive: true }),
  mkdir(resolve(outputRoot, 'authoring/svg'), { recursive: true }),
  mkdir(resolve(outputRoot, 'authoring/scenes'), { recursive: true }),
  mkdir(resolve(outputRoot, 'authoring/metadata'), { recursive: true }),
  mkdir(resolve(outputRoot, 'authoring/png'), { recursive: true }),
  mkdir(resolve(outputRoot, 'authoring/pdf'), { recursive: true }),
]);

const { renderer, cleanup } = await loadRenderer();
const authoringVariants = await exportAuthoringVariants(renderer);
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2,
  });

  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

  const response = await page.goto(`${baseUrl}/research/`, {
    waitUntil: 'networkidle',
  });

  if (!response?.ok()) {
    throw new Error(`Research page returned ${response?.status() ?? 'no response'}`);
  }

  if (await page.locator('html').getAttribute('data-pinega-ready') !== 'true') {
    throw new Error('Pinega page did not reach the ready state');
  }

  const figures = [];

  for (const id of ids) {
    const figure = page.locator(`figure[data-diagram-id="${id}"]`);

    if (await figure.count() !== 1) {
      throw new Error(`Expected one figure for ${id}`);
    }

    await figure.screenshot({
      path: resolve(outputRoot, 'png', `${id}.png`),
      animations: 'disabled',
    });

    const svg = await figure.locator('svg').evaluate(
      (element) => `<?xml version="1.0" encoding="UTF-8"?>\n${element.outerHTML}`,
    );

    await writeFile(resolve(outputRoot, 'svg', `${id}.svg`), svg, 'utf8');
    figures.push(await figure.evaluate((element) => element.outerHTML));
  }

  const reviewHtml = createReviewHtml({
    baseUrl,
    diagramVersion,
    figures,
    ids,
  });

  await writeFile(resolve(outputRoot, 'review.html'), reviewHtml, 'utf8');
  await page.setContent(reviewHtml, { waitUntil: 'networkidle' });
  await page.pdf({
    path: resolve(outputRoot, 'pdf', 'web-academic-review.pdf'),
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: '12mm',
      right: '12mm',
      bottom: '12mm',
      left: '12mm',
    },
  });

  const authoringReviewHtml = createAuthoringReviewHtml({ diagramVersion, variants: authoringVariants });
  await writeFile(resolve(outputRoot, 'authoring', 'review.html'), authoringReviewHtml, 'utf8');
  await page.setContent(authoringReviewHtml, { waitUntil: 'load' });

  for (const variant of authoringVariants) {
    const article = page.locator(`[data-authoring-review-id="${variant.reviewId}"]`);
    if (await article.count() !== 1) throw new Error(`Missing authoring review surface ${variant.reviewId}`);
    await article.screenshot({
      path: resolve(outputRoot, 'authoring/png', `${variant.reviewId}.png`),
      animations: 'disabled',
    });
  }

  await page.pdf({
    path: resolve(outputRoot, 'authoring/pdf', 'layout-profile-review.pdf'),
    format: 'A3',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: '10mm',
      right: '10mm',
      bottom: '10mm',
      left: '10mm',
    },
  });
} finally {
  await browser.close();
  await cleanup();
}

async function loadRenderer() {
  const temp = await mkdtemp(resolve(tmpdir(), 'pinega-diagram-review-'));
  const rendererPath = resolve(temp, 'renderer.mjs');
  await build({
    entryPoints: [resolve(webRoot, 'src/diagrams/index.ts')],
    outfile: rendererPath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: ['node26'],
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'silent',
  });
  return {
    renderer: await import(`${pathToFileURL(rendererPath).href}?review=${Date.now()}`),
    cleanup: () => rm(temp, { recursive: true, force: true }),
  };
}

async function exportAuthoringVariants(renderer) {
  const entries = (await readdir(modelRoot, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));
  const variants = [];

  for (const entry of entries) {
    const parsed = JSON.parse(await readFile(resolve(modelRoot, entry.name), 'utf8'));
    const model = renderer.validateDiagramModel(parsed);
    const profiles = renderer.listDiagramLayoutProfiles(model.kind);

    for (const profile of profiles) {
      const reviewId = `${model.id}--${profile.id}`;
      const svg = renderer.renderDiagramAuthoringSvg(model, {
        profile: profile.id,
        systemVersion: diagramVersion,
      });
      const scene = renderer.renderDiagramScene(model, { profile: profile.id });
      const metadata = {
        diagramSystemVersion: diagramVersion,
        diagramId: model.id,
        diagramKind: model.kind,
        semanticSource: `design/diagrams/models/${basename(entry.name)}`,
        layoutProfile: profile.id,
        layoutStatus: profile.status,
        layoutStrategy: profile.strategy,
        typstSupported: profile.typstSupported,
        canonical: false,
        manualEditing: false,
        authoringFormat: 'pinega-svg-v1',
      };

      await Promise.all([
        writeFile(resolve(outputRoot, 'authoring/svg', `${reviewId}.svg`), svg, 'utf8'),
        writeFile(resolve(outputRoot, 'authoring/scenes', `${reviewId}.json`), `${JSON.stringify(scene, null, 2)}\n`, 'utf8'),
        writeFile(resolve(outputRoot, 'authoring/metadata', `${reviewId}.json`), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8'),
      ]);

      variants.push({
        ...metadata,
        profileLabel: profile.label,
        reviewId,
        svg: svg.replace(/^<\?xml[^>]*>\s*/u, ''),
      });
    }
  }

  const manifest = {
    diagramSystemVersion: diagramVersion,
    authoringFormat: 'pinega-svg-v1',
    layerOrder: ['background', 'relations', 'objects', 'annotations', 'proof'],
    variants: variants.map(({ svg: _svg, profileLabel, reviewId, ...metadata }) => ({
      ...metadata,
      profileLabel,
      reviewId,
      svg: `svg/${reviewId}.svg`,
      scene: `scenes/${reviewId}.json`,
      metadata: `metadata/${reviewId}.json`,
      preview: `png/${reviewId}.png`,
    })),
  };
  await writeFile(resolve(outputRoot, 'authoring', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return variants;
}

function createReviewHtml({ baseUrl, diagramVersion, figures, ids }) {
  const version = escapeHtml(diagramVersion);
  const sections = figures
    .map(
      (figure, index) =>
        `<section><h2>${index + 1}. ${escapeHtml(ids[index])}</h2>${figure}</section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en" class="pinega-light wa-light wa-theme-pinega-strata wa-palette-pinega">
  <head>
    <meta charset="utf-8">
    <base href="${escapeHtml(baseUrl)}/">
    <title>Scientific Diagram Language ${version} — Web review</title>
    <link rel="stylesheet" href="/assets/main.css">
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { background: white; color: #1f2528; }
      main { display: grid; gap: 12mm; }
      section { break-after: page; }
      section:last-child { break-after: auto; }
      .pinega-diagram-transcript { display: none; }
      .pinega-semantic-diagram { margin: 0; }
      .pinega-diagram-viewport { overflow: visible; border-radius: 0; }
      .pinega-diagram-svg { min-inline-size: 0; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p>Pinega Labs · visual review artifact</p>
        <h1>Scientific Diagram Language ${version}</h1>
      </header>
      ${sections}
    </main>
  </body>
</html>`;
}

function createAuthoringReviewHtml({ diagramVersion, variants }) {
  const sections = variants.map(variant => `
    <article data-authoring-review-id="${escapeHtml(variant.reviewId)}">
      <header>
        <div>
          <p>${escapeHtml(variant.diagramKind)} · ${escapeHtml(variant.layoutStatus)}</p>
          <h2>${escapeHtml(variant.diagramId)}</h2>
        </div>
        <div class="profile">
          <strong>${escapeHtml(variant.profileLabel)}</strong>
          <code>${escapeHtml(variant.layoutProfile)}</code>
        </div>
      </header>
      <div class="canvas">${variant.svg}</div>
      <footer>Strategy: <code>${escapeHtml(variant.layoutStrategy)}</code> · editable SVG layers: background, relations, objects, annotations, proof</footer>
    </article>`).join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Scientific Diagram Language ${escapeHtml(diagramVersion)} — authoring profiles</title>
    <style>
      @page { size: A3 landscape; margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #f3efe7; color: #272827; font-family: "DejaVu Sans", sans-serif; }
      main { display: grid; gap: 28px; padding: 28px; }
      article { break-after: page; border: 1px solid #c9bead; background: #fbf7ef; padding: 24px; }
      article:last-child { break-after: auto; }
      header { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 18px; }
      h1, h2, p { margin: 0; } h1 { font-size: 28px; } h2 { font-size: 22px; }
      header p, footer { color: #67625b; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
      .profile { display: grid; justify-items: end; gap: 4px; } code { font-family: "DejaVu Sans Mono", monospace; }
      .canvas { overflow: hidden; border-top: 1px solid #c9bead; border-bottom: 1px solid #c9bead; padding: 18px 0; }
      .canvas svg { display: block; width: 100%; height: auto; max-height: 700px; }
      footer { margin-top: 14px; text-transform: none; letter-spacing: 0; }
    </style>
  </head>
  <body>
    <main>
      <header><div><p>Pinega Labs · authoring review artifact</p><h1>Layout profiles · ${escapeHtml(diagramVersion)}</h1></div></header>
      ${sections}
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
