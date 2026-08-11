import { expect, type Page, type TestInfo } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

interface AxeViolation {
  id: string;
  impact: string | null;
  nodes: Array<{ html: string; target: unknown }>;
}

interface AxeResults {
  violations: AxeViolation[];
}

export interface AccessibilityAuditOptions {
  attachmentStem: string;
  blockingImpacts: readonly string[];
  context: string;
  tags: readonly string[];
  testInfo: TestInfo;
}

export async function expectNoBlockingAxeViolations(
  page: Page,
  options: AccessibilityAuditOptions,
): Promise<void> {
  const hasAxe = await page.evaluate(() => 'axe' in window);
  if (!hasAxe) await page.addScriptTag({ path: axePath });

  const results = await page.evaluate(async input => {
    const context = input.context === 'document'
      ? document
      : document.querySelector(input.context);
    if (!context) throw new TypeError(`Missing axe context ${JSON.stringify(input.context)}.`);
    const axe = (window as unknown as Window & {
      axe: {
        run: (
          root: Document | Element,
          runOptions: unknown,
        ) => Promise<AxeResults>;
      };
    }).axe;
    return axe.run(context, {
      runOnly: { type: 'tag', values: input.tags },
      resultTypes: ['violations'],
    });
  }, { context: options.context, tags: [...options.tags] });

  const blocking = results.violations.filter(violation => (
    violation.impact !== null && options.blockingImpacts.includes(violation.impact)
  ));
  if (blocking.length > 0) {
    await options.testInfo.attach(`${options.attachmentStem}-axe.json`, {
      body: JSON.stringify({ context: options.context, violations: blocking }, null, 2),
      contentType: 'application/json',
    });
  }
  expect(
    blocking,
    `${options.attachmentStem}: ${blocking.map(violation => violation.id).join(', ')}`,
  ).toEqual([]);
}
