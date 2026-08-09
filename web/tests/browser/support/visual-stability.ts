import type { Page, Route, TestInfo } from '@playwright/test';

const regionSelector = '[data-visual-stability-region]';
const dynamicSelector = '[data-visual-stability-dynamic]';
const observedStyles = [
  'display',
  'visibility',
  'opacity',
  'position',
  'box-sizing',
  'overflow-x',
  'overflow-y',
  'z-index',
  'inline-size',
  'block-size',
  'min-inline-size',
  'min-block-size',
  'max-inline-size',
  'max-block-size',
  'inset-block-start',
  'inset-block-end',
  'inset-inline-start',
  'inset-inline-end',
  'background-color',
  'background-image',
  'background-position',
  'background-repeat',
  'background-size',
  'color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-radius',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-shadow',
  'row-gap',
  'column-gap',
  'align-items',
  'justify-content',
  'flex-direction',
  'grid-template-columns',
  'grid-template-rows',
  'box-shadow',
  'filter',
  'backdrop-filter',
  'clip-path',
  'transform',
] as const;

interface PseudoSignature {
  content: string;
  styles: Record<string, string>;
}

interface ElementSignature {
  path: string;
  tag: string;
  dynamic: boolean;
  directText: string | null;
  rect: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
  pseudos: { before: PseudoSignature; after: PseudoSignature };
}

export interface RegionCapture {
  id: string;
  elements: ElementSignature[];
  screenshot?: Buffer;
}

export interface PhaseCapture {
  phase: string;
  regions: RegionCapture[];
}

export interface UnexpectedShiftReport {
  cls: number;
  entries: Array<{
    value: number;
    sources: Array<{ node: string; dynamic: boolean }>;
  }>;
}

interface PendingRoute {
  route: Route;
  resume: () => void;
}

export class AssetGate {
  readonly #pending: PendingRoute[] = [];
  readonly #waiters: Array<() => void> = [];

  private constructor() {}

  static async install(page: Page, pattern: string | RegExp): Promise<AssetGate> {
    const gate = new AssetGate();
    await page.route(pattern, async route => {
      await new Promise<void>(resume => {
        gate.#pending.push({ route, resume });
        gate.#waiters.splice(0).forEach(notify => notify());
      });
    });
    return gate;
  }

  async waitForRequest(timeoutMs = 10_000): Promise<void> {
    if (this.#pending.length > 0) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for a gated asset request.')), timeoutMs);
      this.#waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async release(): Promise<void> {
    const pending = this.#pending.shift();
    if (!pending) throw new TypeError('Cannot release an asset gate before its request arrives.');
    try {
      await pending.route.continue();
    } finally {
      pending.resume();
    }
  }
}

export async function installUnexpectedShiftProbe(page: Page): Promise<void> {
  await page.addInitScript(({ ignoredSelector }) => {
    const state: UnexpectedShiftReport = { cls: 0, entries: [] };
    (window as Window & { __pinegaUnexpectedShifts?: UnexpectedShiftReport }).__pinegaUnexpectedShifts = state;
    if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) return;

    const describe = (node: Node | null): { node: string; dynamic: boolean } => {
      if (!(node instanceof Element)) return { node: '<unavailable>', dynamic: false };
      const identity = node.id
        ? `${node.localName}#${node.id}`
        : node.hasAttribute('data-visual-stability-region')
          ? `${node.localName}[data-visual-stability-region="${node.getAttribute('data-visual-stability-region')}"]`
          : node.localName;
      return { node: identity, dynamic: node.closest(ignoredSelector) !== null };
    };

    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
        sources?: Array<{ node: Node | null }>;
      }>) {
        if (entry.hadRecentInput) continue;
        const sources = (entry.sources ?? []).map(source => describe(source.node));
        if (sources.length > 0 && sources.every(source => source.dynamic)) continue;
        state.cls += entry.value;
        state.entries.push({ value: entry.value, sources });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  }, { ignoredSelector: dynamicSelector });
}

export async function waitForAuthoredRender(page: Page): Promise<void> {
  await page.waitForFunction(selector => {
    const stylesheet = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href="/assets/main.css"]');
    return stylesheet?.sheet && document.querySelectorAll(selector).length > 0;
  }, regionSelector);
  await page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

export async function capturePhase(page: Page, phase: string, captureScreenshots: boolean): Promise<PhaseCapture> {
  await page.evaluate(async () => {
    scrollTo(0, 0);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const signatures = await page.evaluate(({ regions, dynamic, properties }) => {
    const round = (value: number): number => Math.round(value * 64) / 64;
    const pathWithin = (element: Element, region: Element): string => {
      if (element === region) return ':scope';
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current !== region) {
        const parent: Element | null = current.parentElement;
        const index = parent ? [...parent.children].indexOf(current) : -1;
        parts.unshift(`${current.localName}:${index}`);
        current = parent;
      }
      return parts.join('/');
    };
    const directText = (element: Element): string => [...element.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent ?? '')
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim();

    return [...document.querySelectorAll<HTMLElement>(regions)].map((region, index) => {
      const id = region.dataset.visualStabilityRegion || `region-${index}`;
      const candidates = [region, ...region.querySelectorAll<HTMLElement>('*')]
        .filter(element => {
          const owner = element.closest(dynamic);
          return owner === null || owner === element;
        });
      const elements = candidates.map(element => {
        const computed = getComputedStyle(element);
        const pseudo = (name: '::before' | '::after'): PseudoSignature => {
          const styles = getComputedStyle(element, name);
          const content = styles.content;
          const rendered = styles.display !== 'none' && content !== 'none' && content !== 'normal';
          return {
            content,
            styles: rendered
              ? Object.fromEntries(properties.map(property => [property, styles.getPropertyValue(property)]))
              : {},
          };
        };
        const rect = element.getBoundingClientRect();
        const isDynamic = element.matches(dynamic);
        return {
          path: pathWithin(element, region),
          tag: element.localName,
          dynamic: isDynamic,
          directText: isDynamic ? null : directText(element),
          rect: {
            x: round(rect.x),
            y: round(rect.y),
            width: round(rect.width),
            height: round(rect.height),
          },
          styles: Object.fromEntries(properties.map(property => [property, computed.getPropertyValue(property)])),
          pseudos: { before: pseudo('::before'), after: pseudo('::after') },
        };
      });
      return { id, elements };
    });
  }, { regions: regionSelector, dynamic: dynamicSelector, properties: [...observedStyles] });

  const captures: RegionCapture[] = [];
  for (const [index, signature] of signatures.entries()) {
    captures.push({
      ...signature,
      ...(captureScreenshots
        ? {
            screenshot: await page.locator(regionSelector).nth(index).screenshot({
              animations: 'disabled',
              caret: 'hide',
              scale: 'css',
            }),
          }
        : {}),
    });
  }
  return { phase, regions: captures };
}

export function comparePhases(reference: PhaseCapture, candidate: PhaseCapture): string[] {
  const failures: string[] = [];
  const candidateById = new Map(candidate.regions.map(region => [region.id, region]));
  if (reference.regions.length !== candidate.regions.length) {
    failures.push(`${reference.phase} has ${reference.regions.length} stability regions; ${candidate.phase} has ${candidate.regions.length}.`);
  }
  for (const expected of reference.regions) {
    const actual = candidateById.get(expected.id);
    if (!actual) {
      failures.push(`${candidate.phase} is missing region ${expected.id}.`);
      continue;
    }
    failures.push(...compareElements(expected.id, reference, candidate, expected.elements, actual.elements));
  }
  return failures;
}

function compareElements(
  regionId: string,
  reference: PhaseCapture,
  candidate: PhaseCapture,
  expectedElements: ElementSignature[],
  actualElements: ElementSignature[],
): string[] {
  const failures: string[] = [];
  const actualByPath = new Map(actualElements.map(element => [element.path, element]));
  const describe = (path: string, property: string, expected: unknown, actual: unknown): void => {
    failures.push(`${regionId} ${path} ${property}: ${JSON.stringify(expected)} -> ${JSON.stringify(actual)} (${reference.phase} -> ${candidate.phase}).`);
  };

  for (const expected of expectedElements) {
    const actual = actualByPath.get(expected.path);
    if (!actual) {
      failures.push(`${regionId}: ${candidate.phase} is missing ${expected.path}.`);
      continue;
    }
    for (const property of ['tag', 'dynamic', 'directText'] as const) {
      if (expected[property] !== actual[property]) describe(expected.path, property, expected[property], actual[property]);
    }
    for (const property of ['x', 'y', 'width', 'height'] as const) {
      if (expected.rect[property] !== actual.rect[property]) {
        describe(expected.path, `rect.${property}`, expected.rect[property], actual.rect[property]);
      }
    }
    for (const [property, value] of Object.entries(expected.styles)) {
      if (value !== actual.styles[property]) describe(expected.path, property, value, actual.styles[property]);
    }
    for (const pseudo of ['before', 'after'] as const) {
      if (expected.pseudos[pseudo].content !== actual.pseudos[pseudo].content) {
        describe(expected.path, `::${pseudo}.content`, expected.pseudos[pseudo].content, actual.pseudos[pseudo].content);
      }
      for (const [property, value] of Object.entries(expected.pseudos[pseudo].styles)) {
        if (value !== actual.pseudos[pseudo].styles[property]) {
          describe(expected.path, `::${pseudo}.${property}`, value, actual.pseudos[pseudo].styles[property]);
        }
      }
    }
  }
  for (const actual of actualElements) {
    if (!expectedElements.some(expected => expected.path === actual.path)) {
      failures.push(`${regionId}: ${candidate.phase} added ${actual.path}.`);
    }
  }
  return failures;
}

export async function attachPhase(testInfo: TestInfo, routeId: string, capture: PhaseCapture): Promise<void> {
  for (const region of capture.regions) {
    if (!region.screenshot) continue;
    await testInfo.attach(`${routeId}-${capture.phase}-${region.id}.png`, {
      body: region.screenshot,
      contentType: 'image/png',
    });
  }
}

export async function readUnexpectedShifts(page: Page): Promise<UnexpectedShiftReport> {
  return page.evaluate(() => (
    (window as Window & { __pinegaUnexpectedShifts?: UnexpectedShiftReport }).__pinegaUnexpectedShifts
      ?? { cls: 0, entries: [] }
  ));
}
