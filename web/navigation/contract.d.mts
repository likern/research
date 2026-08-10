export interface RouteFeatureDefinition {
  readonly id: string;
  readonly element: string;
  readonly loading: 'critical' | 'deferred' | 'viewport';
  readonly implementation: 'native' | 'lit';
  readonly module: string;
}

export interface LitIslandPolicy {
  readonly schemaVersion: 1;
  readonly ownership: 'component-local';
  readonly routeLoading: false;
  readonly router: false;
  readonly globalRendering: false;
  readonly globalHydration: false;
  readonly taskPackage: '@lit/task';
  readonly islands: readonly {
    readonly id: string;
    readonly element: string;
    readonly feature: string;
    readonly fallback: 'canonical-light-dom';
    readonly asyncScope: 'component-local-model';
    readonly reconnect: true;
  }[];
}

export const DOCUMENT_CONTRACT_VERSION: string;
export const SHELL_VERSION: string;
export const BUILD_ID_ALGORITHM: string;
export const BUILD_ID_PLACEHOLDER: string;
export const NATIVE_NAVIGATION_ROUTE_IDS: readonly string[];
export const ROUTE_FEATURE_DEFINITIONS: readonly RouteFeatureDefinition[];
export const LIT_ISLAND_POLICY: LitIslandPolicy;
export const SHELL_CUSTOM_ELEMENTS: readonly string[];
export const ROUTE_OWNED_METADATA: readonly string[];

export function classifyPinegaElement(elementName: string):
  | { kind: 'route-feature'; feature: RouteFeatureDefinition }
  | { kind: 'shell' }
  | { kind: 'unknown' };
export function featureDefinition(featureId: string): RouteFeatureDefinition | undefined;
export function normalizeRouteUrl(input: string | URL, siteOrigin: string | URL): string;
export function routeCacheKey(buildId: string, input: string | URL, siteOrigin: string | URL): string;
export function parseFeatureList(value: string): string[];
export function isBuildId(value: unknown, options?: { allowPlaceholder?: boolean }): value is string;
