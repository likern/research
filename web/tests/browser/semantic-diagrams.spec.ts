import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  const response = await page.goto('/research/', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-pinega-ready', 'true');
}

test('research page exposes three accessible figures from shared semantic models', async ({ page }) => {
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
});

test('diagram viewports and transcripts are keyboard reachable', async ({ page }) => {
  await ready(page);
  const firstViewport = page.locator('.pinega-diagram-viewport').first();
  await firstViewport.focus();
  await expect(firstViewport).toBeFocused();

  const details = page.locator('.pinega-diagram-transcript').first();
  await details.locator('summary').click();
  const transcript = details.locator('pre');
  await expect(transcript).toBeVisible();
  await expect(transcript).toHaveAttribute('tabindex', '0');
  await transcript.click();
  await expect(transcript).toBeFocused();
  await expect(transcript).toContainText('Newest-to-oldest row-version chain');
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
  const before = await page.locator('svg.pinega-diagram-svg').count();
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveClass(/pinega-dark/u);
  await expect(page.locator('svg.pinega-diagram-svg')).toHaveCount(before);
  await expect(page.locator('figure.pinega-semantic-diagram figcaption').first()).toBeVisible();
});
