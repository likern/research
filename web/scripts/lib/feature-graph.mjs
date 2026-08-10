const outputRoot = 'dist/assets/';
const mainSource = 'src/main.ts';
const webAwesomeCoreSource = 'src/vendor/webawesome/core.ts';
const webAwesomeRussianSource = 'node_modules/@awesome.me/webawesome/dist/translations/ru.js';
const litRuntimeModuleSuffixes = [
  'node_modules/@lit/reactive-element/reactive-element.js',
  'node_modules/lit-element/lit-element.js',
  'node_modules/lit-html/lit-html.js',
];
const litPackagePaths = [
  'node_modules/@lit/reactive-element',
  'node_modules/@lit/task',
  'node_modules/lit',
  'node_modules/lit-element',
  'node_modules/lit-html',
];

export function createVerifiedFeatureGraph({
  definitions,
  metafile,
  packageLock,
  esbuildVersion,
}) {
  const outputs = metafileOutputs(metafile);
  validateOutputGraph(outputs);

  const entryOutputs = indexEntryOutputs(outputs);
  const mainOutputPath = requiredEntryOutput(entryOutputs, mainSource);
  const mainOutput = requiredOutput(outputs, mainOutputPath);
  if (outputAssetPath(mainOutputPath) !== 'main.js') {
    throw new TypeError('esbuild main entry must remain the stable assets/main.js shell URL.');
  }
  if (typeof mainOutput.cssBundle !== 'string' || outputAssetPath(mainOutput.cssBundle) !== 'main.css') {
    throw new TypeError('esbuild main entry must expose the stable assets/main.css stylesheet URL.');
  }

  const featureSources = definitions.map(definition => definition.module);
  const generatedFeatureSources = [...entryOutputs.keys()]
    .filter(source => source.startsWith('src/features/'))
    .toSorted();
  assertSameList(generatedFeatureSources, [...featureSources].toSorted(), 'esbuild dynamic feature entries');

  const expectedDynamicSources = [
    ...featureSources,
    webAwesomeCoreSource,
    webAwesomeRussianSource,
  ].toSorted();
  const generatedDynamicSources = [...entryOutputs.keys()]
    .filter(source => source !== mainSource)
    .toSorted();
  assertSameList(generatedDynamicSources, expectedDynamicSources, 'esbuild dynamic entries');
  const reachableFromMain = outputClosure(outputs, mainOutputPath, { includeDynamic: true });
  for (const source of expectedDynamicSources) {
    const entryPath = requiredEntryOutput(entryOutputs, source);
    if (!reachableFromMain.has(entryPath)) {
      throw new TypeError(`esbuild entry ${JSON.stringify(source)} is not reachable from the main output graph.`);
    }
    assertNativeDynamicEntry(outputs, entryPath, source);
  }

  const moduleLocations = indexInputLocations(outputs);
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

  const coreOutputPath = requiredEntryOutput(entryOutputs, webAwesomeCoreSource);
  const diagramSource = requiredFeature(definitions, 'diagram-viewer').module;
  const diagramOutputPath = requiredEntryOutput(entryOutputs, diagramSource);
  const coreClosure = outputClosure(outputs, coreOutputPath);
  const diagramClosure = outputClosure(outputs, diagramOutputPath);
  if (!coreClosure.has(litRuntimeFile) || !diagramClosure.has(litRuntimeFile)) {
    throw new TypeError('Web Awesome Core and the Lit diagram island must import one shared Lit runtime chunk.');
  }
  const taskModuleLocations = [...moduleLocations.entries()]
    .filter(([moduleId]) => /(?:^|\/)node_modules\/@lit\/task\//u.test(normalizePath(moduleId)));
  if (taskModuleLocations.length === 0) {
    throw new TypeError('The Lit diagram island must bundle @lit/task for component-local async work.');
  }
  const taskChunks = new Set(taskModuleLocations.flatMap(([, locations]) => locations));
  const shellClosure = outputClosure(outputs, mainOutputPath);
  for (const taskChunk of taskChunks) {
    if (!diagramClosure.has(taskChunk) || shellClosure.has(taskChunk) || coreClosure.has(taskChunk)) {
      throw new TypeError('@lit/task must remain reachable only through the component-local diagram island.');
    }
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
    const dynamicEntryPath = requiredEntryOutput(entryOutputs, definition.module);
    const dynamicEntryFile = outputAssetPath(dynamicEntryPath);
    if (!/^chunks\/[a-z0-9][a-z0-9.-]*-[A-Z0-9]{8}\.js$/u.test(dynamicEntryFile)) {
      throw new TypeError(`Feature ${definition.id} is not a hashed esbuild dynamic entry: ${JSON.stringify(dynamicEntryFile)}.`);
    }
    const closure = outputClosure(outputs, dynamicEntryPath);
    return Object.freeze({
      id: definition.id,
      element: definition.element,
      loading: definition.loading,
      implementation: definition.implementation,
      source: definition.module,
      chunk: assetUrl(dynamicEntryPath),
      imports: Object.freeze(
        [...closure]
          .filter(path => path !== dynamicEntryPath)
          .map(assetUrl)
          .toSorted(),
      ),
    });
  });

  const featureGraph = {
    schemaVersion: 1,
    kind: 'pinega-dynamic-feature-graph',
    bundler: {
      name: 'esbuild',
      version: esbuildVersion,
      metafile: '/assets/bundle-manifest.json',
      format: 'esm',
      splitting: true,
      minified: true,
      dynamicImports: 'native',
    },
    entry: {
      source: mainSource,
      script: assetUrl(mainOutputPath),
      stylesheet: assetUrl(mainOutput.cssBundle),
    },
    shell: {
      webAwesomeCore: assetUrl(coreOutputPath),
      webAwesomeRussianTranslation: assetUrl(requiredEntryOutput(entryOutputs, webAwesomeRussianSource)),
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
      consumers: [webAwesomeCoreSource, diagramSource],
      task: {
        package: '@lit/task',
        version: lockPackages['node_modules/@lit/task'].version,
        scope: 'component-local',
        consumers: [diagramSource],
      },
    },
  };

  return Object.freeze({
    graph: deepFreeze(featureGraph),
    routeRequests(locale, featureIds) {
      return createRouteRequestManifest(featureGraph, metafile, definitions, locale, featureIds);
    },
  });
}

export function createRouteRequestManifest(featureGraph, metafile, definitions, locale, featureIds) {
  const outputs = metafileOutputs(metafile);
  const entryOutputs = indexEntryOutputs(outputs);
  const shellOutputs = new Set([
    ...outputClosure(outputs, requiredEntryOutput(entryOutputs, mainSource)),
    ...outputClosure(outputs, requiredEntryOutput(entryOutputs, webAwesomeCoreSource)),
    ...(locale === 'ru'
      ? outputClosure(outputs, requiredEntryOutput(entryOutputs, webAwesomeRussianSource))
      : []),
  ]);
  const shell = new Set([featureGraph.entry.stylesheet]);
  for (const path of shellOutputs) shell.add(assetUrl(path));

  const phaseAssets = { critical: new Set(), deferred: new Set(), viewport: new Set() };
  const reused = new Set();
  for (const featureId of featureIds) {
    const definition = requiredFeature(definitions, featureId);
    const featureOutputPath = requiredEntryOutput(entryOutputs, definition.module);
    for (const path of outputClosure(outputs, featureOutputPath)) {
      const url = assetUrl(path);
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

function metafileOutputs(metafile) {
  if (!metafile || typeof metafile !== 'object' || Array.isArray(metafile)) {
    throw new TypeError('esbuild metafile must be an object.');
  }
  const outputs = metafile.outputs;
  if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs)) {
    throw new TypeError('esbuild metafile must expose an outputs graph.');
  }
  return outputs;
}

function validateOutputGraph(outputs) {
  for (const [outputPath, output] of Object.entries(outputs)) {
    outputAssetPath(outputPath);
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      throw new TypeError(`Invalid esbuild output record ${JSON.stringify(outputPath)}.`);
    }
    for (const imported of output.imports ?? []) {
      if (imported.external === true) {
        throw new TypeError(`esbuild production output must be self-contained, found external import ${JSON.stringify(imported.path)}.`);
      }
      requiredOutput(outputs, imported.path);
    }
  }
}

function indexEntryOutputs(outputs) {
  const entries = new Map();
  for (const [outputPath, output] of Object.entries(outputs)) {
    if (typeof output.entryPoint !== 'string') continue;
    const source = normalizePath(output.entryPoint);
    if (entries.has(source)) {
      throw new TypeError(`esbuild entry ${JSON.stringify(source)} has multiple outputs.`);
    }
    entries.set(source, normalizePath(outputPath));
  }
  if (!entries.has(mainSource)) throw new TypeError(`esbuild metafile is missing ${JSON.stringify(mainSource)}.`);
  return entries;
}

function indexInputLocations(outputs) {
  const locations = new Map();
  for (const [outputPath, output] of Object.entries(outputs)) {
    if (!outputPath.endsWith('.js')) continue;
    for (const moduleId of Object.keys(output.inputs ?? {})) {
      const normalizedModuleId = normalizePath(moduleId);
      const moduleOutputs = locations.get(normalizedModuleId) ?? [];
      moduleOutputs.push(normalizePath(outputPath));
      locations.set(normalizedModuleId, moduleOutputs);
    }
  }
  return locations;
}

function assertNativeDynamicEntry(outputs, entryPath, source) {
  const incoming = [];
  for (const [importerPath, output] of Object.entries(outputs)) {
    for (const imported of output.imports ?? []) {
      if (normalizePath(imported.path) === entryPath) {
        incoming.push({ importerPath: normalizePath(importerPath), kind: imported.kind });
      }
    }
  }
  if (incoming.length === 0 || incoming.some(edge => edge.kind !== 'dynamic-import')) {
    throw new TypeError(`esbuild entry ${JSON.stringify(source)} must be reachable only through native dynamic-import edges.`);
  }
}

function outputClosure(outputs, sourcePath, { includeDynamic = false } = {}) {
  const visited = new Set();
  const pending = [sourcePath];
  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path)) continue;
    visited.add(path);
    const output = requiredOutput(outputs, path);
    for (const imported of output.imports ?? []) {
      if (!includeDynamic && imported.kind === 'dynamic-import') continue;
      pending.push(normalizePath(imported.path));
    }
  }
  return visited;
}

function requiredOutput(outputs, path) {
  const normalized = normalizePath(path);
  const output = outputs[normalized];
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new TypeError(`esbuild metafile is missing output ${JSON.stringify(normalized)}.`);
  }
  return output;
}

function requiredEntryOutput(entryOutputs, source) {
  const path = entryOutputs.get(source);
  if (!path) throw new TypeError(`esbuild metafile is missing entry ${JSON.stringify(source)}.`);
  return path;
}

function requiredFeature(definitions, featureId) {
  const definition = definitions.find(candidate => candidate.id === featureId);
  if (!definition) throw new TypeError(`Unknown feature ${JSON.stringify(featureId)}.`);
  return definition;
}

function assetUrl(outputPath) {
  return `/assets/${outputAssetPath(outputPath)}`;
}

function outputAssetPath(outputPath) {
  const path = normalizePath(outputPath);
  if (!path.startsWith(outputRoot) || path.includes('/../') || path.endsWith('/..')) {
    throw new TypeError(`Invalid esbuild asset path ${JSON.stringify(outputPath)}.`);
  }
  const relative = path.slice(outputRoot.length);
  const segments = relative.split('/');
  if (!relative || relative.startsWith('/') || segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new TypeError(`Invalid esbuild asset path ${JSON.stringify(outputPath)}.`);
  }
  return relative;
}

function isLitModule(moduleId) {
  const path = normalizePath(moduleId);
  return /(?:^|\/)node_modules\/(?:@lit\/(?:reactive-element|task)|lit|lit-element|lit-html)(?:\/|$)/u.test(path);
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
