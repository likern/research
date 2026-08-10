import { randomUUID } from 'node:crypto';
import {
  expect,
  type ElementHandle,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

const snapshotName = /^[a-z0-9][a-z0-9._-]*\.aria\.yml$/u;
const attachmentStem = /^[a-z0-9][a-z0-9._-]*$/u;

export interface RegisteredSemanticTransition {
  id: string;
  selector: string;
}

interface CaptureSemanticTreeOptions {
  registeredTransitions?: readonly RegisteredSemanticTransition[];
}

interface SemanticAssertionOptions {
  attachmentStem: string;
  message: string;
  testInfo: TestInfo;
}

export async function captureSemanticTree(
  target: Locator | Page,
  { registeredTransitions = [] }: CaptureSemanticTreeOptions = {},
): Promise<string> {
  const token = `pinega-semantic-${randomUUID()}`;
  const root = await semanticRoot(target);

  let snapshot: string;
  try {
    if (registeredTransitions.length > 0) {
      await installTransitionSentinels(root, registeredTransitions, token);
    }
    snapshot = await target.ariaSnapshot({ boxes: false });
  } finally {
    try {
      if (registeredTransitions.length > 0) await removeTransitionSentinels(root, token);
    } finally {
      await root.dispose();
    }
  }
  if (snapshot.includes('[box=')) {
    throw new TypeError('Accessibility-tree snapshots must not contain layout geometry.');
  }
  return snapshot;
}

export async function expectSemanticBaseline(
  locator: Locator,
  name: string,
  options?: Omit<SemanticAssertionOptions, 'message'>,
): Promise<void> {
  if (!snapshotName.test(name)) {
    throw new TypeError(`ARIA baseline name must be a simple .aria.yml filename, received ${JSON.stringify(name)}.`);
  }
  try {
    await expect(locator).toMatchAriaSnapshot({ name });
  } catch (error) {
    if (options) {
      await attachSemanticFailure(options.testInfo, options.attachmentStem, await captureSemanticTree(locator));
    }
    throw error;
  }
}

export async function expectSemanticEquivalent(
  reference: string,
  candidate: string,
  options: SemanticAssertionOptions,
): Promise<void> {
  if (candidate === reference) return;
  await attachSemanticFailure(options.testInfo, options.attachmentStem, candidate, reference);
  expect(candidate, options.message).toBe(reference);
}

async function attachSemanticFailure(
  testInfo: TestInfo,
  stem: string,
  actual: string,
  reference?: string,
): Promise<void> {
  if (!attachmentStem.test(stem)) {
    throw new TypeError(`ARIA attachment stem must be filesystem-safe, received ${JSON.stringify(stem)}.`);
  }
  await testInfo.attach(`${stem}-actual.aria.yml`, {
    body: actual,
    contentType: 'application/yaml',
  });
  if (reference !== undefined) {
    await testInfo.attach(`${stem}-reference.aria.yml`, {
      body: reference,
      contentType: 'application/yaml',
    });
  }
}

async function installTransitionSentinels(
  rootHandle: ElementHandle<Element>,
  transitions: readonly RegisteredSemanticTransition[],
  token: string,
): Promise<void> {
  await rootHandle.evaluate((root, input) => {
    const registrations = new Map<Element, string>();
    for (const transition of input.transitions) {
      for (const element of root.querySelectorAll(transition.selector)) {
        if (!registrations.has(element)) registrations.set(element, transition.id);
      }
    }

    const candidates = [...registrations.keys()].filter(element => (
      ![...registrations.keys()].some(parent => parent !== element && parent.contains(element))
    ));
    candidates.sort((left, right) => (
      left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1
    ));

    const ordinals = new Map<string, number>();
    for (const element of candidates) {
      const transitionId = registrations.get(element);
      if (!transitionId) continue;
      const ordinal = (ordinals.get(transitionId) ?? 0) + 1;
      ordinals.set(transitionId, ordinal);

      const sentinel = document.createElement('span');
      sentinel.dataset.pinegaTestSemanticTransition = input.token;
      sentinel.setAttribute('role', 'note');
      sentinel.textContent = `Registered semantic transition ${transitionId} ${ordinal}`;
      sentinel.style.cssText = [
        'position:fixed',
        'inset:0 auto auto 0',
        'inline-size:1px',
        'block-size:1px',
        'overflow:hidden',
        'clip-path:inset(50%)',
        'white-space:nowrap',
      ].join(';');
      element.before(sentinel);

      const masked = element as Element & {
        __pinegaSemanticMask?: { token: string; ariaHidden: string | null };
      };
      Object.defineProperty(masked, '__pinegaSemanticMask', {
        configurable: true,
        value: { token: input.token, ariaHidden: element.getAttribute('aria-hidden') },
      });
      element.setAttribute('data-pinega-test-semantic-mask', input.token);
      element.setAttribute('aria-hidden', 'true');
    }
  }, { token, transitions });
}

async function removeTransitionSentinels(rootHandle: ElementHandle<Element>, token: string): Promise<void> {
  await rootHandle.evaluate((root, maskToken) => {
    for (const element of root.querySelectorAll(`[data-pinega-test-semantic-mask="${CSS.escape(maskToken)}"]`)) {
      const masked = element as Element & {
        __pinegaSemanticMask?: { token: string; ariaHidden: string | null };
      };
      const state = masked.__pinegaSemanticMask;
      if (state?.token !== maskToken) continue;
      if (state.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', state.ariaHidden);
      element.removeAttribute('data-pinega-test-semantic-mask');
      delete masked.__pinegaSemanticMask;
    }
    for (const sentinel of root.querySelectorAll(`[data-pinega-test-semantic-transition="${CSS.escape(maskToken)}"]`)) {
      sentinel.remove();
    }
  }, token);
}

async function semanticRoot(target: Locator | Page): Promise<ElementHandle<Element>> {
  if (isPage(target)) {
    const handle = await target.evaluateHandle(() => document.body);
    const root = handle.asElement();
    if (root) return root;
    await handle.dispose();
    throw new TypeError('Semantic page capture requires a document body.');
  }
  const root = await target.elementHandle();
  if (!root) throw new TypeError('Semantic locator capture requires one attached root element.');
  return root;
}

function isPage(target: Locator | Page): target is Page {
  return 'url' in target && typeof target.url === 'function';
}
