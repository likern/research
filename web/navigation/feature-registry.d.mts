export interface FeatureDefinition {
  readonly id: string;
  readonly element: string;
  readonly loading: 'critical' | 'deferred' | 'viewport';
  readonly implementation: 'native' | 'lit';
  readonly module: string;
}

export interface FeatureModuleNamespace {
  readonly featureId: string;
  readonly featureElement: string;
  readonly featureImplementation: 'native' | 'lit';
}

export interface FeatureLoader {
  readonly source: string;
  readonly load: () => Promise<FeatureModuleNamespace>;
}

export class FeatureRegistryContractError extends TypeError {}

export class ClosedFeatureRegistry {
  constructor(definitions: readonly FeatureDefinition[], loaders: Readonly<Record<string, FeatureLoader>>);
  definitions(): readonly FeatureDefinition[];
  definition(featureId: string): FeatureDefinition;
  status(featureId: string): 'unloaded' | 'loading' | 'loaded';
  load(featureId: string): Promise<FeatureModuleNamespace>;
}
