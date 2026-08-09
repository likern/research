import { ROUTE_FEATURE_DEFINITIONS } from '../../navigation/contract.mjs';
import { ClosedFeatureRegistry } from '../../navigation/feature-registry.mjs';

export interface RouteFeatureDefinition {
  readonly id: string;
  readonly element: string;
  readonly loading: 'critical' | 'deferred' | 'viewport';
  readonly implementation: 'native' | 'lit';
  readonly module: string;
}

export interface LoadedFeatureModule {
  readonly featureId: string;
  readonly featureElement: string;
  readonly featureImplementation: 'native' | 'lit';
}

interface RuntimeFeatureRegistry {
  definitions(): readonly RouteFeatureDefinition[];
  definition(featureId: string): RouteFeatureDefinition;
  status(featureId: string): 'unloaded' | 'loading' | 'loaded';
  load(featureId: string): Promise<LoadedFeatureModule>;
}

// Every specifier is a source literal. Route-owned data can select an ID only
// after document-contract validation; it can never become an import specifier.
const featureLoaders = Object.freeze({
  benchmark: Object.freeze({
    source: 'src/features/benchmark.ts',
    load: () => import('./benchmark.js'),
  }),
  'code-example': Object.freeze({
    source: 'src/features/code-example.ts',
    load: () => import('./code-example.js'),
  }),
  'diagram-viewer': Object.freeze({
    source: 'src/features/diagram-viewer.ts',
    load: () => import('./diagram-viewer.js'),
  }),
  'doc-topic-filter': Object.freeze({
    source: 'src/features/doc-topic-filter.ts',
    load: () => import('./doc-topic-filter.js'),
  }),
});

export const routeFeatureRegistry = new ClosedFeatureRegistry(
  ROUTE_FEATURE_DEFINITIONS,
  featureLoaders,
) as RuntimeFeatureRegistry;
