import type { Locator, Page, Route, TestInfo } from '@playwright/test';

const regionSelector = '[data-visual-stability-region]';
const dynamicSelector = '[data-visual-stability-dynamic]';
const observedStyles = [
  'display',
  'visibility',
  'opacity',
  'position',
  'inline-size',
  'block-size',
  'min-inline-size',
  'min-block-size',
  'background-color',
  'background-image',
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
  'box-shadow',
  'transform',
] as const;

interface ElementSignature {
  path: string;
  tag: string;
  dynamic: boolean;
  directText: string | null;
  rect: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
}

export interface RegionCapture {
  id: string;
  elements: ElementSignature[];
  screenshot: Buffer;
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
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

export async function capturePhase(page: Page, phase: string): Promise<PhaseCapture> {
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
        };
      });
      return { id, elements };
    });
  }, { regions: regionSelector, dynamic: dynamicSelector, properties: [...observedStyles] });

  const captures: RegionCapture[] = [];
  for (const [index, signature] of signatures.entries()) {
    const locator: Locator = page.locator(regionSelector).nth(index);
    captures.push({
      ...signature,
      screenshot: await locator.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }),
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
    if (JSON.stringify(expected.elements) !== JSON.stringify(actual.elements)) {
      failures.push(`${expected.id}: geometry, text, or computed styles changed between ${reference.phase} and ${candidate.phase}.`);
    }
    if (!expected.screenshot.equals(actual.screenshot)) {
      failures.push(`${expected.id}: rendered pixels changed between ${reference.phase} and ${candidate.phase}.`);
    }
  }
  return failures;
}

export async function attachPhase(testInfo: TestInfo, routeId: string, capture: PhaseCapture): Promise<void> {
  for (const region of capture.regions) {
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
