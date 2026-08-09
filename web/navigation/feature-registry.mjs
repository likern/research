const loadingClasses = new Set(['critical', 'deferred', 'viewport']);
const implementations = new Set(['native', 'lit']);

export class FeatureRegistryContractError extends TypeError {
  constructor(message, options) {
    super(message, options);
    this.name = 'FeatureRegistryContractError';
  }
}

/**
 * Closed application-level registry layered over the browser module map.
 *
 * The browser already reuses a successfully loaded module by URL. This Map
 * additionally coalesces concurrent feature requests, validates the evaluated
 * module against the build contract, and never records a rejected import as a
 * successful application state.
 */
export class ClosedFeatureRegistry {
  #definitions = new Map();
  #loaders = new Map();
  #preparations = new Map();
  #loaded = new Set();

  constructor(definitions, loaders) {
    if (!Array.isArray(definitions) || definitions.length === 0) {
      throw new FeatureRegistryContractError('Feature definitions must be a non-empty array.');
    }
    if (!loaders || typeof loaders !== 'object' || Array.isArray(loaders)) {
      throw new FeatureRegistryContractError('Feature loaders must be a closed object map.');
    }

    for (const definition of definitions) {
      validateDefinition(definition);
      if (this.#definitions.has(definition.id)) {
        throw new FeatureRegistryContractError(`Duplicate feature definition ${JSON.stringify(definition.id)}.`);
      }
      const loader = loaders[definition.id];
      if (!loader || typeof loader !== 'object' || typeof loader.load !== 'function') {
        throw new FeatureRegistryContractError(`Feature ${JSON.stringify(definition.id)} has no literal dynamic-import loader.`);
      }
      if (loader.source !== definition.module) {
        throw new FeatureRegistryContractError(
          `Feature ${JSON.stringify(definition.id)} loader source ${JSON.stringify(loader.source)} does not match ${JSON.stringify(definition.module)}.`,
        );
      }
      this.#definitions.set(definition.id, Object.freeze({ ...definition }));
      this.#loaders.set(definition.id, Object.freeze({ source: loader.source, load: loader.load }));
    }

    const extraLoaders = Object.keys(loaders).filter(id => !this.#definitions.has(id));
    if (extraLoaders.length > 0) {
      throw new FeatureRegistryContractError(`Unregistered feature loaders: ${extraLoaders.toSorted().join(', ')}.`);
    }
  }

  definitions() {
    return Object.freeze([...this.#definitions.values()]);
  }

  definition(featureId) {
    const definition = this.#definitions.get(featureId);
    if (!definition) throw new FeatureRegistryContractError(`Unknown route feature ${JSON.stringify(featureId)}.`);
    return definition;
  }

  status(featureId) {
    this.definition(featureId);
    if (this.#loaded.has(featureId)) return 'loaded';
    return this.#preparations.has(featureId) ? 'loading' : 'unloaded';
  }

  load(featureId) {
    const definition = this.definition(featureId);
    const existing = this.#preparations.get(featureId);
    if (existing) return existing;

    const loader = this.#loaders.get(featureId);
    const preparation = Promise.resolve()
      .then(() => loader.load())
      .then(module => validateLoadedModule(module, definition))
      .then(module => {
        this.#loaded.add(featureId);
        return module;
      });
    this.#preparations.set(featureId, preparation);
    void preparation.catch(() => {
      if (this.#preparations.get(featureId) === preparation) {
        this.#preparations.delete(featureId);
        this.#loaded.delete(featureId);
      }
    });
    return preparation;
  }
}

function validateDefinition(definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new FeatureRegistryContractError('Every feature definition must be an object.');
  }
  for (const field of ['id', 'element', 'loading', 'implementation', 'module']) {
    if (typeof definition[field] !== 'string' || definition[field] === '') {
      throw new FeatureRegistryContractError(`Feature definition requires a non-empty ${field}.`);
    }
  }
  if (!/^[a-z][a-z0-9-]*$/u.test(definition.id)) {
    throw new FeatureRegistryContractError(`Invalid feature ID ${JSON.stringify(definition.id)}.`);
  }
  if (!/^pinega-[a-z][a-z0-9-]*$/u.test(definition.element)) {
    throw new FeatureRegistryContractError(`Invalid feature element ${JSON.stringify(definition.element)}.`);
  }
  if (!loadingClasses.has(definition.loading)) {
    throw new FeatureRegistryContractError(`Invalid loading class ${JSON.stringify(definition.loading)}.`);
  }
  if (!implementations.has(definition.implementation)) {
    throw new FeatureRegistryContractError(`Invalid feature implementation ${JSON.stringify(definition.implementation)}.`);
  }
  if (!/^src\/features\/[a-z][a-z0-9-]*\.ts$/u.test(definition.module)) {
    throw new FeatureRegistryContractError(`Invalid feature module source ${JSON.stringify(definition.module)}.`);
  }
}

function validateLoadedModule(module, definition) {
  if (!module || typeof module !== 'object') {
    throw new FeatureRegistryContractError(`Feature ${JSON.stringify(definition.id)} did not evaluate to a module namespace.`);
  }
  const actual = {
    id: module.featureId,
    element: module.featureElement,
    implementation: module.featureImplementation,
  };
  const expected = {
    id: definition.id,
    element: definition.element,
    implementation: definition.implementation,
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new FeatureRegistryContractError(
      `Feature module ${JSON.stringify(definition.module)} exports ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}.`,
    );
  }
  return module;
}
