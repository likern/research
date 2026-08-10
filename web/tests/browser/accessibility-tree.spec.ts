import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  captureSemanticTree,
  expectSemanticBaseline,
  expectSemanticEquivalent,
} from './support/accessibility-tree.js';

interface CoverageRegistry {
  policy: {
    required_profiles: string[];
  };
  requirements: Array<{
    oracle: {
      snapshot: string;
    };
  }>;
}

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = await readFile(resolve(webRoot, 'tests/fixtures/accessibility/serializer-conformance.html'), 'utf8');
const registry = JSON.parse(await readFile(resolve(webRoot, 'tests/accessibility/coverage.json'), 'utf8')) as CoverageRegistry;
const registeredProfiles = new Set(registry.policy.required_profiles);
const baselineName = registry.requirements[0]?.oracle.snapshot;

if (!baselineName) throw new TypeError('Accessibility coverage registry does not name a serializer baseline.');

async function loadFixture(page: Page): Promise<void> {
  await page.setContent(fixture, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#serializer-conformance')).toBeVisible();
}

async function expectIdReference(page: Page, selector: string, attribute: string, targetId: string): Promise<void> {
  await expect(page.locator(selector)).toHaveAttribute(attribute, targetId);
  await expect(page.locator(`#${targetId}`)).toHaveCount(1);
}

test.describe('Playwright ARIA serializer conformance', {
  tag: ['@aria-tree', '@accessibility'],
}, () => {
  test('serializes the accepted semantic projection identically in every profile', async ({ page }, testInfo) => {
    expect(registeredProfiles.has(testInfo.project.name), `Unregistered Playwright profile ${testInfo.project.name}`).toBe(true);
    await loadFixture(page);

    const root = page.locator('#serializer-conformance');
    await test.step('strict shared serializer baseline', async () => {
      const before = await captureSemanticTree(root);
      await expectSemanticBaseline(root, baselineName);
      const after = await captureSemanticTree(root);

      expectSemanticEquivalent(before, after, 'ARIA serialization changed between two captures of the same DOM');
      await expect(page.getByRole('button', { name: 'Add evidence item' })).toHaveAccessibleName('Add evidence item');
      expect(after).not.toContain('Decorative plus must stay hidden');
    });

    await test.step('explicit DOM-only properties and relationships', async () => {
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('#current-contract-link')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#pending-region')).toHaveAttribute('aria-busy', 'true');
      await expect(page.locator('#save-status')).toHaveAttribute('aria-live', 'polite');
      await expect(page.locator('#nested-button svg')).toHaveAttribute('aria-hidden', 'true');
      await expectIdReference(page, '#details-toggle', 'aria-controls', 'details-panel');
      await expectIdReference(page, '#heading-region', 'aria-labelledby', 'heading-contract-title');
      await expectIdReference(page, '#invalid-email', 'aria-describedby', 'email-error');

      await expect(root).toHaveAttribute('tabindex', '-1');
      await root.focus();
      await expect(root).toBeFocused();

      const snapshot = await captureSemanticTree(root);
      expect(snapshot).not.toMatch(/\[(?:busy|current|live|controls|labelledby|describedby)(?:=|\])/u);
    });
  });
});
