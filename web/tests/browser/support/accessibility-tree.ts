import { expect, type Locator } from '@playwright/test';

const snapshotName = /^[a-z0-9][a-z0-9._-]*\.aria\.yml$/u;

export async function captureSemanticTree(locator: Locator): Promise<string> {
  const snapshot = await locator.ariaSnapshot({ boxes: false });
  if (snapshot.includes('[box=')) {
    throw new TypeError('Accessibility-tree snapshots must not contain layout geometry.');
  }
  return snapshot;
}

export async function expectSemanticBaseline(locator: Locator, name: string): Promise<void> {
  if (!snapshotName.test(name)) {
    throw new TypeError(`ARIA baseline name must be a simple .aria.yml filename, received ${JSON.stringify(name)}.`);
  }
  await expect(locator).toMatchAriaSnapshot({ name });
}

export function expectSemanticEquivalent(reference: string, candidate: string, message: string): void {
  expect(candidate, message).toBe(reference);
}
