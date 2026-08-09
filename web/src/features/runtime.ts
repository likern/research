import { featureDefinition, parseFeatureList } from '../../navigation/contract.mjs';
import {
  routeFeatureRegistry,
  type RouteFeatureDefinition,
} from './registry.js';

export interface RouteFeaturePhases {
  readonly critical: readonly string[];
  readonly deferred: readonly string[];
  readonly viewport: readonly string[];
}

export interface RouteFeatureActivation extends RouteFeaturePhases {
  readonly deferredSettled: Promise<void>;
}

export class FeatureRuntimeError extends Error {
  readonly featureId: string;
  readonly phase: RouteFeatureDefinition['loading'];

  constructor(featureId: string, phase: RouteFeatureDefinition['loading'], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FeatureRuntimeError';
    this.featureId = featureId;
    this.phase = phase;
  }
}

export class DynamicFeatureGraph {
  #activeRoot: HTMLElement | undefined;
  #activeSerial = 0;
  #observer: IntersectionObserver | undefined;
  #viewportTargets = new Map<Element, string>();
  #viewportFeatures = new Map<string, Set<Element>>();

  async initializeRoute(main: HTMLElement): Promise<RouteFeatureActivation> {
    const features = declaredRouteFeatures(main);
    await this.prepareCritical(features);
    const activation = this.activateRoute(main, features);
    await activation.deferredSettled;
    return activation;
  }

  describe(features: readonly string[]): RouteFeaturePhases {
    return classifyFeatures(features);
  }

  async prepareCritical(features: readonly string[]): Promise<void> {
    const phases = classifyFeatures(features);
    await Promise.all(phases.critical.map(featureId => this.#load(featureId, 'critical')));
  }

  activateRoute(main: HTMLElement, features: readonly string[]): RouteFeatureActivation {
    const phases = classifyFeatures(features);
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#viewportTargets.clear();
    this.#viewportFeatures.clear();
    this.#activeRoot = main;
    this.#activeSerial += 1;
    const serial = this.#activeSerial;
    main.dataset.pinegaFeatureGraph = 'active';

    for (const featureId of phases.critical) this.#mark(main, featureId, 'ready');
    const deferredSettled = Promise.all(phases.deferred.map(featureId => (
      this.#loadForActiveRoute(main, serial, featureId, 'deferred')
    ))).then(() => undefined);
    this.#observeViewportFeatures(main, serial, phases.viewport);

    return Object.freeze({
      ...phases,
      deferredSettled,
    });
  }

  #observeViewportFeatures(main: HTMLElement, serial: number, featureIds: readonly string[]): void {
    if (featureIds.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      for (const featureId of featureIds) {
        void this.#loadForActiveRoute(main, serial, featureId, 'viewport');
      }
      return;
    }

    this.#observer = new IntersectionObserver(entries => {
      const ready = new Set<string>();
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const featureId = this.#viewportTargets.get(entry.target);
        if (featureId) ready.add(featureId);
      }
      for (const featureId of ready) {
        const targets = this.#viewportFeatures.get(featureId) ?? new Set();
        for (const target of targets) this.#observer?.unobserve(target);
        void this.#loadForActiveRoute(main, serial, featureId, 'viewport');
      }
    }, {
      root: null,
      rootMargin: '256px 0px',
      threshold: 0,
    });

    for (const featureId of featureIds) {
      const definition = routeFeatureRegistry.definition(featureId);
      const targets = featureElements(main, definition.element);
      if (targets.length === 0) {
        throw new FeatureRuntimeError(featureId, 'viewport', `Route declares ${JSON.stringify(featureId)} without ${definition.element}.`);
      }
      const targetSet = new Set<Element>(targets);
      this.#viewportFeatures.set(featureId, targetSet);
      this.#mark(main, featureId, 'waiting');
      for (const target of targets) {
        this.#viewportTargets.set(target, featureId);
        this.#observer.observe(target);
      }
    }
  }

  async #loadForActiveRoute(
    main: HTMLElement,
    serial: number,
    featureId: string,
    phase: RouteFeatureDefinition['loading'],
  ): Promise<void> {
    this.#mark(main, featureId, 'loading');
    try {
      await this.#load(featureId, phase);
      if (!this.#owns(main, serial)) return;
      customElements.upgrade(main);
      this.#mark(main, featureId, 'ready');
      dispatchFeatureEvent('ready', featureId, phase, main);
    } catch (error) {
      if (!this.#owns(main, serial)) return;
      this.#mark(main, featureId, 'error');
      dispatchFeatureEvent('error', featureId, phase, main, error);
      console.error(`Pinega ${phase} feature ${JSON.stringify(featureId)} failed to load; semantic HTML remains active.`, error);
    }
  }

  async #load(featureId: string, phase: RouteFeatureDefinition['loading']): Promise<void> {
    const definition = routeFeatureRegistry.definition(featureId);
    try {
      await routeFeatureRegistry.load(featureId);
      if (!customElements.get(definition.element)) {
        throw new TypeError(`Feature module did not define <${definition.element}>.`);
      }
      if (definition.implementation === 'lit') assertSingleLitRuntime();
    } catch (error) {
      throw new FeatureRuntimeError(
        featureId,
        phase,
        `Could not load ${phase} route feature ${JSON.stringify(featureId)}.`,
        { cause: error },
      );
    }
  }

  #owns(main: HTMLElement, serial: number): boolean {
    return this.#activeRoot === main && this.#activeSerial === serial && main.isConnected;
  }

  #mark(main: HTMLElement, featureId: string, state: 'waiting' | 'loading' | 'ready' | 'error'): void {
    const definition = routeFeatureRegistry.definition(featureId);
    for (const element of featureElements(main, definition.element)) {
      element.dataset.pinegaFeatureState = state;
    }
  }
}

function assertSingleLitRuntime(): void {
  const runtime = window as Window & {
    litElementVersions?: string[];
    litHtmlVersions?: string[];
    reactiveElementVersions?: string[];
  };
  const versions = {
    litElement: runtime.litElementVersions ?? [],
    litHtml: runtime.litHtmlVersions ?? [],
    reactiveElement: runtime.reactiveElementVersions ?? [],
  };
  for (const [name, loaded] of Object.entries(versions)) {
    if (loaded.length !== 1) {
      throw new TypeError(`Expected one ${name} runtime, found ${JSON.stringify(loaded)}.`);
    }
  }
}

function declaredRouteFeatures(main: HTMLElement): string[] {
  const features = parseFeatureList(requiredAttribute(main, 'data-pinega-features'));
  const critical = parseFeatureList(requiredAttribute(main, 'data-pinega-critical-features'));
  const expectedCritical = classifyFeatures(features).critical;
  if (critical.length !== expectedCritical.length || critical.some((value, index) => value !== expectedCritical[index])) {
    throw new TypeError('Route critical feature projection disagrees with the closed registry.');
  }
  return features;
}

function classifyFeatures(features: readonly string[]): RouteFeaturePhases {
  const phases: Record<RouteFeatureDefinition['loading'], string[]> = {
    critical: [],
    deferred: [],
    viewport: [],
  };
  for (const featureId of features) {
    const definition = featureDefinition(featureId) as RouteFeatureDefinition | undefined;
    if (!definition) throw new TypeError(`Unknown route feature ${JSON.stringify(featureId)}.`);
    phases[definition.loading].push(featureId);
  }
  return Object.freeze({
    critical: Object.freeze(phases.critical),
    deferred: Object.freeze(phases.deferred),
    viewport: Object.freeze(phases.viewport),
  });
}

function featureElements(main: HTMLElement, elementName: string): HTMLElement[] {
  const elements = [...main.querySelectorAll<HTMLElement>(elementName)];
  if (main.matches(elementName)) elements.unshift(main);
  return elements;
}

function requiredAttribute(element: HTMLElement, name: string): string {
  const value = element.getAttribute(name);
  if (value === null) throw new TypeError(`Route main requires ${name}.`);
  return value;
}

function dispatchFeatureEvent(
  state: 'ready' | 'error',
  featureId: string,
  phase: RouteFeatureDefinition['loading'],
  main: HTMLElement,
  error?: unknown,
): void {
  window.dispatchEvent(new CustomEvent(`pinega:feature-${state}`, {
    detail: {
      featureId,
      phase,
      routeId: main.dataset.pinegaRoute ?? '',
      ...(state === 'error' ? { error } : {}),
    },
  }));
}
