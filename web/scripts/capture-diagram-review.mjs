import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const outputRoot = resolve(process.argv[2] ?? '../artifacts/scientific-diagram-v0.2-review/web');
const baseUrl = process.env.PINEGA_REVIEW_BASE_URL ?? 'http://127.0.0.1:4173';
const ids = ['linearizability-overlap', 'version-chain-snapshot', 'buffer-frame-lifecycle'];
await mkdir(resolve(outputRoot, 'png'), { recursive: true }); await mkdir(resolve(outputRoot, 'svg'), { recursive: true }); await mkdir(resolve(outputRoot, 'pdf'), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  const response = await page.goto(`${baseUrl}/research/`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Research page returned ${response?.status() ?? 'no response'}`);
  if (await page.locator('html').getAttribute('data-pinega-ready') !== 'true') throw new Error('Pinega page did not reach the ready state');
  const figures = [];
  for (const id of ids) {
    const figure = page.locator(`figure[data-diagram-id="${id}"]`);
    if (await figure.count() !== 1) throw new Error(`Expected one figure for ${id}`);
    await figure.screenshot({ path: resolve(outputRoot, 'png', `${id}.png`), animations: 'disabled' });
    const svg = await figure.locator('svg').evaluate(element => `<?xml version="1.0" encoding="UTF-8"?>\n${element.outerHTML}`);
    await writeFile(resolve(outputRoot, 'svg', `${id}.svg`), svg, 'utf8');
    figures.push(await figure.evaluate(element => element.outerHTML));
  }
  const reviewHtml = `<!doctype html><html lang="en" class="pinega-light wa-light wa-theme-pinega-strata wa-palette-pinega"><head><meta charset="utf-8"><base href="${baseUrl}/"><title>Scientific Diagram Language v0.2 — Web review</title><link rel="stylesheet" href="/assets/main.css"><style>@page{size:A4 landscape;margin:12mm}body{background:white;color:#1f2528}main{display:grid;gap:12mm}section{break-after:page}section:last-child{break-after:auto}.pinega-diagram-transcript{display:none}.pinega-semantic-diagram{margin:0}.pinega-diagram-viewport{overflow:visible;border-radius:0}.pinega-diagram-svg{min-inline-size:0}</style></head><body><main><header><p>Pinega Labs · visual review artifact</p><h1>Scientific Diagram Language v0.2</h1></header>${figures.map((figure, index) => `<section><h2>${index + 1}. ${ids[index]}</h2>${figure}</section>`).join('\n')}</main></body></html>`;
  await writeFile(resolve(outputRoot, 'review.html'), reviewHtml, 'utf8');
  await page.setContent(reviewHtml, { waitUntil: 'networkidle' });
  await page.pdf({ path: resolve(outputRoot, 'pdf', 'web-academic-review.pdf'), format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
} finally { await browser.close(); }
