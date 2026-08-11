import { expect, test, type Page } from '@playwright/test';
import { openReadyDocument } from './support/direct-document.js';
import { expectInteractiveState } from './support/interactive-accessibility.js';

const semanticTest = { tag: ['@aria-tree', '@accessibility'] };

async function ready(page: Page): Promise<void> {
  await openReadyDocument(page, '/research/');
}

interface SemanticDiagramState {
  dark: boolean;
  firstCaptionVisible: boolean;
  markup: string[];
}

async function semanticDiagramState(page: Page, toggleTheme = false): Promise<SemanticDiagramState> {
  return page.evaluate(shouldToggleTheme => {
    if (shouldToggleTheme) {
      const toggle = document.querySelector<HTMLElement>('[data-theme-toggle]');
      if (!toggle) throw new Error('Theme toggle is missing');
      toggle.click();
    }

    const caption = document.querySelector<HTMLElement>('figure.pinega-semantic-diagram figcaption');
    const captionStyle = caption ? getComputedStyle(caption) : undefined;
    return {
      dark: document.documentElement.classList.contains('pinega-dark'),
      firstCaptionVisible: Boolean(
        caption
        && captionStyle?.display !== 'none'
        && captionStyle?.visibility !== 'hidden'
        && caption.getClientRects().length > 0
      ),
      markup: Array.from(
        document.querySelectorAll('svg.pinega-diagram-svg'),
        element => element.outerHTML,
      ),
    };
  }, toggleTheme);
}

test('research page exposes three accessible figures from shared semantic models', semanticTest, async ({ page }, testInfo) => {
  await ready(page);
  const figures = page.locator('figure.pinega-semantic-diagram');
  await expect(figures).toHaveCount(3);
  await expect(page.locator('svg.pinega-diagram-svg[role="img"]')).toHaveCount(3);
  await expect(page.locator('svg.pinega-diagram-svg > title')).toHaveCount(3);
  await expect(page.locator('svg.pinega-diagram-svg > desc')).toHaveCount(3);
  await expect(page.locator('.pinega-diagram-transcript')).toHaveCount(3);
  await expect(page.locator('.pinega-diagram-transcript a[download]')).toHaveCount(3);

  const names = await page.locator('svg.pinega-diagram-svg').evaluateAll(elements => elements.map(element => element.getAttribute('aria-labelledby')));
  expect(names.every(value => value?.includes('-title ') && value.endsWith('-desc'))).toBeTruthy();

  const ids = await figures.evaluateAll(elements => elements.map(element => element.getAttribute('data-diagram-id')));
  expect(ids).toEqual([
    'version-chain-snapshot',
    'buffer-frame-lifecycle',
    'linearizability-overlap',
  ]);
  await expectInteractiveState(page, 'DIAGRAM-SVG', testInfo);
});

test('diagram viewports and transcripts expose closed, open, and keyboard states', semanticTest, async ({ page }, testInfo) => {
  await ready(page);
  const firstViewport = page.locator('.pinega-diagram-viewport').first();
  await firstViewport.focus();
  await expect(firstViewport).toBeFocused();

  const firstViewer = page.locator('pinega-diagram-viewer').first();
  await expect(firstViewer).toHaveAttribute('data-pinega-feature-state', 'ready');
  await expect(firstViewer).toHaveAttribute('data-renderer', 'lit');

  const details = page.locator('.pinega-diagram-transcript').first();
  await expect(details).not.toHaveAttribute('open', '');
  await expectInteractiveState(page, 'DIAGRAM-TRANSCRIPT-CLOSED', testInfo);
  await details.locator('summary').click();
  const transcript = details.locator('pre');
  await expect(transcript).toBeVisible();
  await expect(transcript).toHaveAttribute('tabindex', '0');
  await transcript.click();
  await expect(transcript).toBeFocused();
  await expect(transcript).toContainText('Newest-to-oldest row-version chain');
  await expectInteractiveState(page, 'DIAGRAM-TRANSCRIPT-OPEN', testInfo);
});

test('downloadable model endpoints preserve semantic JSON', async ({ request }) => {
  for (const id of ['linearizability-overlap', 'version-chain-snapshot', 'buffer-frame-lifecycle']) {
    const response = await request.get(`/diagrams/models/${id}.json`);
    expect(response.ok(), id).toBeTruthy();
    const model = await response.json() as { schemaVersion: number; id: string; kind: string; title: string };
    expect(model).toMatchObject({ schemaVersion: 1, id });
    expect(['history', 'version-chain', 'lifecycle']).toContain(model.kind);
    expect(model.title.length).toBeGreaterThan(0);
  }
});

test('diagram SVG adapts to dark mode without replacing semantic markup', async ({ page }) => {
  await ready(page);
  const before = await semanticDiagramState(page);
  expect(before.markup).toHaveLength(3);

  // Pointer actionability is covered by foundation.spec.ts; this assertion isolates the DOM/CSS contract.
  const after = await semanticDiagramState(page, true);
  expect(after.dark).toBe(true);
  expect(after.markup).toEqual(before.markup);
  expect(after.firstCaptionVisible).toBe(true);
});
