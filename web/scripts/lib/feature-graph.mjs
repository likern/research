const mainSource = 'src/main.ts';
const webAwesomeCoreSource = 'src/vendor/webawesome/core.ts';
const webAwesomeRussianSource = 'node_modules/@awesome.me/webawesome/dist/translations/ru.js';
const litRuntimeModuleSuffixes = [
  '/node_modules/@lit/reactive-element/reactive-element.js',
  '/node_modules/lit-element/lit-element.js',
  '/node_modules/lit-html/lit-html.js',
];
const litPackagePaths = [
  'node_modules/@lit/reactive-element',
  'node_modules/lit',
  'node_modules/lit-element',
  'node_modules/lit-html',
];

export function createVerifiedFeatureGraph({
  definitions,
  manifest,
  bundle,
  packageLock,
  viteVersion,
}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new TypeError('Vite manifest must be an object.');
  }
  const entry = requiredManifestEntry(manifest, mainSource);
  if (entry.isEntry !== true || entry.file !== 'main.js') {
    throw new TypeError('Vite main entry must remain the stable assets/main.js shell URL.');
  }

  const featureSources = definitions.map(definition => definition.module);
  const generatedFeatureSources = (entry.dynamicImports ?? [])
    .filter(source => source.startsWith('src/features/'))
    .toSorted();
  assertSameList(generatedFeatureSources, [...featureSources].toSorted(), 'Vite dynamic feature entries');

  const chunks = outputChunks(bundle);
  const moduleLocations = new Map();
  for (const chunk of chunks) {
    for (const moduleId of Object.keys(chunk.modules)) {
      const locations = moduleLocations.get(moduleId) ?? [];
      locations.push(chunk.fileName);
      moduleLocations.set(moduleId, locations);
    }
  }
  for (const [moduleId, locations] of moduleLocations) {
    if (isLitModule(moduleId) && locations.length !== 1) {
      throw new TypeError(`Lit module ${moduleId} was emitted into multiple chunks: ${locations.join(', ')}.`);
    }
  }

  const litRuntimeChunks = litRuntimeModuleSuffixes.map(suffix => {
    const matches = [...moduleLocations.entries()].filter(([moduleId]) => normalizePath(moduleId).endsWith(suffix));
    if (matches.length !== 1) throw new TypeError(`Expected one bundled Lit runtime module ${suffix}, found ${matches.length}.`);
    return matches[0][1][0];
  });
  if (new Set(litRuntimeChunks).size !== 1) {
    throw new TypeError(`Lit runtime primitives are split across unexpected chunks: ${litRuntimeChunks.join(', ')}.`);
  }
  const litRuntimeFile = litRuntimeChunks[0];
  const litManifestKey = Object.keys(manifest).find(key => manifest[key]?.file === litRuntimeFile);
  if (!litManifestKey) throw new TypeError(`Vite manifest does not expose Lit runtime chunk ${litRuntimeFile}.`);

  const coreClosure = manifestClosure(manifest, webAwesomeCoreSource);
  const diagramClosure = manifestClosure(manifest, requiredFeature(definitions, 'diagram-viewer').module);
  if (!coreClosure.has(litManifestKey) || !diagramClosure.has(litManifestKey)) {
    throw new TypeError('Web Awesome Core and the Lit diagram island must import one shared Lit runtime chunk.');
  }

  const lockPackages = packageLock?.packages;
  if (!lockPackages || typeof lockPackages !== 'object' || Array.isArray(lockPackages)) {
    throw new TypeError('package-lock.json must expose a packages graph.');
  }
  for (const packagePath of litPackagePaths) {
    const packageName = packagePath.slice('node_modules/'.length);
    const installations = Object.keys(lockPackages).filter(path => (
      path === packagePath || path.endsWith(`/node_modules/${packageName}`)
    ));
    if (installations.length !== 1 || installations[0] !== packagePath) {
      throw new TypeError(`Lit package ${packageName} is not deduplicated at the Web package root: ${installations.join(', ')}.`);
    }
  }

  const features = definitions.map(definition => {
    const dynamicEntry = requiredManifestEntry(manifest, definition.module);
    if (dynamicEntry.isDynamicEntry !== true || !/^chunks\/[a-z0-9][a-z0-9.-]*-[A-Za-z0-9_-]{8}\.js$/u.test(dynamicEntry.file)) {
      throw new TypeError(`Feature ${definition.id} is not a hashed Vite dynamic entry: ${JSON.stringify(dynamicEntry.file)}.`);
    }
    const closure = manifestClosure(manifest, definition.module);
    return Object.freeze({
      id: definition.id,
      element: definition.element,
      loading: definition.loading,
      implementation: definition.implementation,
      source: definition.module,
      chunk: assetUrl(dynamicEntry.file),
      imports: Object.freeze(
        [...closure]
          .filter(key => key !== definition.module)
          .map(key => assetUrl(requiredManifestEntry(manifest, key).file))
          .toSorted(),
      ),
    });
  });

  const featureGraph = {
    schemaVersion: 1,
    kind: 'pinega-dynamic-feature-graph',
    bundler: {
      name: 'vite',
      version: viteVersion,
      manifest: '/assets/vite-manifest.json',
    },
    entry: {
      source: mainSource,
      script: '/assets/main.js',
      stylesheet: '/assets/main.css',
    },
    shell: {
      webAwesomeCore: assetUrl(requiredManifestEntry(manifest, webAwesomeCoreSource).file),
      webAwesomeRussianTranslation: assetUrl(requiredManifestEntry(manifest, webAwesomeRussianSource).file),
    },
    features,
    lit: {
      deduplicated: true,
      runtimeChunk: assetUrl(litRuntimeFile),
      packages: Object.fromEntries(litPackagePaths.map(path => {
        const metadata = lockPackages[path];
        if (!metadata?.version) throw new TypeError(`Missing locked version for ${path}.`);
        return [path.slice('node_modules/'.length), metadata.version];
      })),
      consumers: [webAwesomeCoreSource, requiredFeature(definitions, 'diagram-viewer').module],
    },
  };

  return Object.freeze({
    graph: deepFreeze(featureGraph),
    routeRequests(locale, featureIds) {
      return createRouteRequestManifest(featureGraph, manifest, definitions, locale, featureIds);
    },
  });
}

export function createRouteRequestManifest(featureGraph, manifest, definitions, locale, featureIds) {
  const shellKeys = new Set([
    ...manifestClosure(manifest, mainSource),
    ...manifestClosure(manifest, webAwesomeCoreSource),
    ...(locale === 'ru' ? manifestClosure(manifest, webAwesomeRussianSource) : []),
  ]);
  const shell = new Set(['/assets/main.css']);
  for (const key of shellKeys) shell.add(assetUrl(requiredManifestEntry(manifest, key).file));

  const phaseAssets = { critical: new Set(), deferred: new Set(), viewport: new Set() };
  const reused = new Set();
  for (const featureId of featureIds) {
    const definition = requiredFeature(definitions, featureId);
    for (const key of manifestClosure(manifest, definition.module)) {
      const url = assetUrl(requiredManifestEntry(manifest, key).file);
      if (shell.has(url)) reused.add(url);
      else phaseAssets[definition.loading].add(url);
    }
  }

  return deepFreeze({
    schemaVersion: 1,
    shell: [...shell].toSorted(),
    critical: [...phaseAssets.critical].toSorted(),
    deferred: [...phaseAssets.deferred].toSorted(),
    viewport: [...phaseAssets.viewport].toSorted(),
    moduleMapReuse: [...reused].toSorted(),
  });
}

function outputChunks(bundle) {
  const outputs = Array.isArray(bundle) ? bundle : [bundle];
  const chunks = outputs.flatMap(output => output?.output ?? []).filter(item => item.type === 'chunk');
  if (chunks.length === 0) throw new TypeError('Vite build returned no output chunks for verification.');
  return chunks;
}

function manifestClosure(manifest, source) {
  const visited = new Set();
  const pending = [source];
  while (pending.length > 0) {
    const key = pending.pop();
    if (!key || visited.has(key)) continue;
    visited.add(key);
    const entry = requiredManifestEntry(manifest, key);
    pending.push(...(entry.imports ?? []));
  }
  return visited;
}

function requiredManifestEntry(manifest, source) {
  const entry = manifest[source];
  if (!entry || typeof entry !== 'object' || typeof entry.file !== 'string') {
    throw new TypeError(`Vite manifest is missing ${JSON.stringify(source)}.`);
  }
  return entry;
}

function requiredFeature(definitions, featureId) {
  const definition = definitions.find(candidate => candidate.id === featureId);
  if (!definition) throw new TypeError(`Unknown feature ${JSON.stringify(featureId)}.`);
  return definition;
}

function assetUrl(file) {
  if (typeof file !== 'string' || file.startsWith('/') || file.includes('..')) {
    throw new TypeError(`Invalid Vite asset path ${JSON.stringify(file)}.`);
  }
  return `/assets/${file}`;
}

function isLitModule(moduleId) {
  const path = normalizePath(moduleId);
  return /\/node_modules\/(?:@lit\/reactive-element|lit|lit-element|lit-html)(?:\/|$)/u.test(path);
}

function normalizePath(value) {
  return String(value).replaceAll('\\', '/').split('?', 1)[0];
}

function assertSameList(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new TypeError(`${label} mismatch: ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}.`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
