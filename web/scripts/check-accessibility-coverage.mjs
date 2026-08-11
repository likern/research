import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { NATIVE_NAVIGATION_ROUTE_IDS } from '../navigation/contract.mjs';

const defaultWebRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_INTERACTIVE_STATES = [
  'HEADER-DESKTOP-NAVIGATION',
  'HEADER-MOBILE-CLOSED',
  'HEADER-MOBILE-OPEN',
  'HEADER-MOBILE-ESCAPE',
  'HEADER-MOBILE-COMMIT',
  'THEME-EN-LIGHT',
  'THEME-EN-DARK',
  'THEME-RU-LIGHT',
  'THEME-RU-DARK',
  'TRANSLATION-NOTICE-HIDDEN',
  'TRANSLATION-STATUS-ANNOUNCED',
  'DOC-FILTER-EN-INITIAL',
  'DOC-FILTER-EN-MATCH',
  'DOC-FILTER-EN-EMPTY',
  'DOC-FILTER-EN-CLEAR',
  'DOC-FILTER-RU-INITIAL',
  'DOC-FILTER-RU-MATCH',
  'DOC-FILTER-RU-EMPTY',
  'DOC-FILTER-RU-CLEAR',
  'LIT-INSPECTOR-NO-JS-FALLBACK',
  'LIT-INSPECTOR-COLLAPSED',
  'LIT-INSPECTOR-PENDING',
  'LIT-INSPECTOR-COMPLETE',
  'LIT-INSPECTOR-ERROR',
  'LIT-INSPECTOR-RETRY-PENDING',
  'LIT-INSPECTOR-RETRY-COMPLETE',
  'LIT-INSPECTOR-ESCAPE-COLLAPSED',
  'LIT-INSPECTOR-DISCONNECTED',
  'LIT-INSPECTOR-RECONNECTED',
  'LIT-INSPECTOR-CLONE-COLLAPSED',
  'LIT-INSPECTOR-CLONE-COMPLETE',
  'BENCHMARK-FALLBACK',
  'BENCHMARK-FALLBACK-TABLE-OPEN',
  'BENCHMARK-PRO',
  'BENCHMARK-PRO-TABLE-OPEN',
  'DIAGRAM-SVG',
  'DIAGRAM-TRANSCRIPT-CLOSED',
  'DIAGRAM-TRANSCRIPT-OPEN',
  'CODE-COPY-NATIVE-IDLE',
  'CODE-COPY-NATIVE-SUCCESS',
  'CODE-COPY-NATIVE-ERROR',
  'CODE-COPY-NATIVE-RESET',
  'CODE-COPY-WEBAWESOME-IDLE',
  'CODE-COPY-WEBAWESOME-SUCCESS',
  'CODE-COPY-WEBAWESOME-ERROR',
  'CODE-COPY-WEBAWESOME-RESET',
];

const EXPECTED_AXE_STATES = [
  'HEADER-MOBILE-OPEN',
  'THEME-EN-LIGHT',
  'THEME-EN-DARK',
  'THEME-RU-LIGHT',
  'THEME-RU-DARK',
  'TRANSLATION-STATUS-ANNOUNCED',
  'DOC-FILTER-EN-INITIAL',
  'DOC-FILTER-EN-MATCH',
  'DOC-FILTER-EN-EMPTY',
  'DOC-FILTER-EN-CLEAR',
  'DOC-FILTER-RU-INITIAL',
  'DOC-FILTER-RU-MATCH',
  'DOC-FILTER-RU-EMPTY',
  'DOC-FILTER-RU-CLEAR',
  'LIT-INSPECTOR-NO-JS-FALLBACK',
  'LIT-INSPECTOR-PENDING',
  'LIT-INSPECTOR-COMPLETE',
  'LIT-INSPECTOR-ERROR',
  'LIT-INSPECTOR-RETRY-PENDING',
  'LIT-INSPECTOR-RETRY-COMPLETE',
  'LIT-INSPECTOR-RECONNECTED',
  'LIT-INSPECTOR-CLONE-COMPLETE',
  'BENCHMARK-FALLBACK',
  'BENCHMARK-FALLBACK-TABLE-OPEN',
  'BENCHMARK-PRO',
  'BENCHMARK-PRO-TABLE-OPEN',
  'DIAGRAM-TRANSCRIPT-OPEN',
  'CODE-COPY-NATIVE-SUCCESS',
  'CODE-COPY-NATIVE-ERROR',
  'CODE-COPY-WEBAWESOME-SUCCESS',
  'CODE-COPY-WEBAWESOME-ERROR',
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}

function repositoryPath(webRoot, relativePath) {
  const absolute = resolve(webRoot, relativePath);
  assert.ok(absolute.startsWith(`${webRoot}${sep}`), `Path escapes the Web workspace: ${relativePath}`);
  return absolute;
}

function snapshotPath(webRoot, template, testFile, snapshotName) {
  const extension = extname(snapshotName);
  const argument = snapshotName.slice(0, -extension.length);
  const relative = template
    .replace('{testFilePath}', testFile)
    .replace('{arg}', argument)
    .replace('{ext}', extension);
  assert.doesNotMatch(relative, /\{[^}]+\}/u, `Unresolved snapshot-path token in ${relative}`);
  return repositoryPath(webRoot, relative);
}

export async function validateAccessibilityCoverage({ webRoot = defaultWebRoot } = {}) {
  const schemaPath = resolve(webRoot, 'tests/accessibility/coverage.schema.json');
  const registryPath = resolve(webRoot, 'tests/accessibility/coverage.json');
  const [schema, registry] = await Promise.all([readJson(schemaPath), readJson(registryPath)]);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  assert.equal(ajv.validateSchema(schema), true, ajv.errorsText(ajv.errors, { separator: '\n' }));
  const validate = ajv.compile(schema);
  assert.equal(validate(registry), true, ajv.errorsText(validate.errors, { separator: '\n' }));

  const profileIds = registry.profiles.map(profile => profile.id);
  const requirementIds = registry.requirements.map(requirement => requirement.id);
  const requirementCases = registry.requirements.map(requirement => requirement.case);
  const domOnlyIds = registry.dom_only_properties.map(property => property.id);
  unique(profileIds, 'Accessibility profile IDs');
  unique(requirementIds, 'Accessibility requirement IDs');
  unique(requirementCases, 'Serializer cases');
  unique(domOnlyIds, 'DOM-only property IDs');

  assert.deepEqual(profileIds, registry.policy.required_profiles, 'Profile order and coverage policy diverged');
  assert.deepEqual(requirementCases, registry.policy.required_serializer_cases, 'Required serializer cases are incomplete');
  assert.deepEqual(registry.profiles, [
    { id: 'chromium-desktop', engine: 'chromium', form_factor: 'desktop' },
    { id: 'chromium-mobile', engine: 'chromium', form_factor: 'mobile' },
    { id: 'firefox-desktop', engine: 'firefox', form_factor: 'desktop' },
    { id: 'webkit-desktop', engine: 'webkit', form_factor: 'desktop' },
  ], 'Browser engine or form-factor coverage changed without a contract update');

  const equivalence = registry.semantic_equivalence;
  assert.deepEqual(equivalence.temporal.profiles, registry.policy.required_profiles, 'Temporal profile matrix is incomplete');
  assert.deepEqual(equivalence.navigation.profiles, registry.policy.required_profiles, 'Navigation profile matrix is incomplete');

  const transitionIds = equivalence.registered_transitions.map(transition => transition.id);
  const transitionSelectors = equivalence.registered_transitions.map(transition => transition.selector);
  unique(transitionIds, 'Registered semantic transition IDs');
  unique(transitionSelectors, 'Registered semantic transition selectors');
  for (const transition of equivalence.registered_transitions) {
    assert.doesNotMatch(
      transition.selector,
      /(?:^|,\s*)(?:\*|body|html|main|pinega-site-header)(?:$|\s|,)/u,
      `${transition.id}: transition selector masks a broad document surface`,
    );
  }

  const temporalRouteIds = equivalence.temporal.routes.map(route => route.id);
  const temporalRoutes = equivalence.temporal.routes.map(route => route.route);
  unique(temporalRouteIds, 'Temporal route IDs');
  unique(temporalRoutes, 'Temporal routes');
  assert.deepEqual(equivalence.temporal.phases, [
    'initial-authored',
    'initial-shell',
    'initial-ready',
    'reload-authored',
    'reload-shell',
    'reload-ready',
  ], 'Temporal capture phases changed without a contract update');
  assert.deepEqual(equivalence.temporal.comparisons, [
    { reference: 'initial-authored', candidate: 'initial-shell' },
    { reference: 'initial-authored', candidate: 'initial-ready' },
    { reference: 'reload-authored', candidate: 'reload-shell' },
    { reference: 'reload-authored', candidate: 'reload-ready' },
    { reference: 'initial-ready', candidate: 'reload-authored' },
    { reference: 'initial-ready', candidate: 'reload-ready' },
  ], 'Temporal semantic equivalence comparisons are incomplete');

  const transactionStateIds = equivalence.navigation.transaction_states.map(state => state.id);
  unique(transactionStateIds, 'Navigation transaction semantic states');
  assert.deepEqual(
    transactionStateIds,
    ['pending', 'commit', 'cancel', 'supersession'],
    'Navigation transaction semantic states are incomplete',
  );

  const interactive = registry.interactive_components;
  const interactiveStateIds = interactive.states.map(state => state.id);
  const interactiveSurfaces = [...new Set(interactive.states.map(state => state.surface))].sort();
  unique(interactiveStateIds, 'Interactive accessibility state IDs');
  unique(
    interactive.states.map(state => `${state.surface}:${state.state}:${state.locale}`),
    'Interactive accessibility surface/state/locale tuples',
  );
  assert.deepEqual(interactiveStateIds, EXPECTED_INTERACTIVE_STATES, 'Interactive component state corpus is incomplete or reordered');
  assert.deepEqual(
    interactiveSurfaces,
    [...interactive.policy.required_surfaces].sort(),
    'Interactive component surfaces differ from the required policy',
  );
  const axeStateIds = interactive.states.filter(state => state.axe.mode === 'required').map(state => state.id);
  assert.deepEqual(axeStateIds, EXPECTED_AXE_STATES, 'Meaningfully revealed states do not have exact axe coverage');

  const interactiveStateSet = new Set(interactiveStateIds);
  const interactiveBaselineFiles = new Set();
  const interactiveSourceFiles = new Set();
  for (const state of interactive.states) {
    interactiveSourceFiles.add(state.owner_test);
    for (const profile of state.profiles) {
      assert.ok(profileIds.includes(profile), `${state.id}: unknown profile ${profile}`);
    }
    if (state.aria.type === 'strict-baseline') {
      interactiveBaselineFiles.add(snapshotPath(
        webRoot,
        registry.policy.snapshot_path_template,
        state.owner_test,
        state.aria.snapshot,
      ));
    } else if (state.aria.type === 'exact-equivalence') {
      assert.ok(interactiveStateSet.has(state.aria.reference_state), `${state.id}: unknown reference state ${state.aria.reference_state}`);
      const reference = interactive.states.find(candidate => candidate.id === state.aria.reference_state);
      assert.equal(reference?.aria.target, state.aria.target, `${state.id}: equivalence target differs from its reference state`);
      assert.notEqual(reference?.aria.type, 'exact-equivalence', `${state.id}: equivalence references must not form chains`);
    } else if (state.aria.type === 'dom-behaviour') {
      assert.ok(state.supplemental_oracles.includes('dom'), `${state.id}: DOM behaviour has no DOM supplemental oracle`);
    }
  }

  const domOnlySet = new Set(domOnlyIds);
  const sourceFiles = new Set([
    ...registry.dom_only_properties.map(property => property.test),
    equivalence.temporal.test,
    equivalence.navigation.test,
    'tests/browser/support/accessibility-contract.ts',
    'tests/browser/support/accessibility-tree.ts',
    'tests/browser/support/accessibility-audit.ts',
    'tests/browser/support/interactive-accessibility.ts',
    ...interactiveSourceFiles,
  ]);
  const fixtureFiles = new Set();
  fixtureFiles.add(equivalence.navigation.archetype_fixture);
  const baselineFiles = new Set();
  for (const requirement of registry.requirements) {
    assert.deepEqual(requirement.profiles, registry.policy.required_profiles, `${requirement.id}: profile matrix is incomplete`);
    assert.equal(requirement.oracle.children, registry.policy.default_children, `${requirement.id}: non-strict children policy`);
    assert.equal(requirement.oracle.baseline_scope, 'shared', `${requirement.id}: conformance baseline must be cross-browser`);
    for (const assertionId of requirement.supplemental_dom_assertions) {
      assert.ok(domOnlySet.has(assertionId), `${requirement.id}: unknown DOM assertion ${assertionId}`);
    }
    sourceFiles.add(requirement.oracle.test);
    fixtureFiles.add(requirement.fixture);
    baselineFiles.add(snapshotPath(
      webRoot,
      registry.policy.snapshot_path_template,
      requirement.oracle.test,
      requirement.oracle.snapshot,
    ));
  }
  assert.equal(baselineFiles.size, 1, 'PR 1 must use one shared serializer-conformance baseline');

  for (const path of [...sourceFiles, ...fixtureFiles].map(relative => repositoryPath(webRoot, relative))) await access(path);
  for (const path of baselineFiles) await access(path);
  for (const path of interactiveBaselineFiles) await access(path);

  const pageClasses = await readJson(repositoryPath(webRoot, equivalence.navigation.archetype_fixture));
  const archetypeIds = pageClasses.representatives.map(representative => representative.id);
  const archetypeContentTypes = pageClasses.representatives.map(representative => representative.contentType);
  unique(archetypeIds, 'Route archetype IDs');
  unique(archetypeContentTypes, 'Route archetype content types');
  assert.equal(pageClasses.representatives.length, 15, 'Route archetype corpus must account for all 15 page classes');

  const nativeExclusionIds = equivalence.navigation.native_route_exclusions.map(exclusion => exclusion.id);
  unique(nativeExclusionIds, 'Native route semantic exclusions');
  assert.deepEqual(nativeExclusionIds, NATIVE_NAVIGATION_ROUTE_IDS, 'Native semantic exclusions diverged from route policy');
  for (const exclusion of equivalence.navigation.native_route_exclusions) {
    const representative = pageClasses.representatives.find(candidate => candidate.id === exclusion.id);
    assert.deepEqual(
      representative && {
        id: representative.id,
        route: representative.route,
        content_type: representative.contentType,
      },
      { id: exclusion.id, route: exclusion.route, content_type: exclusion.content_type },
      `${exclusion.id}: native semantic exclusion diverged from the archetype fixture`,
    );
  }
  const enhancedArchetypes = pageClasses.representatives.filter(representative => !nativeExclusionIds.includes(representative.id));
  assert.equal(enhancedArchetypes.length, 13, 'Exactly 13 route archetypes must support direct/enhanced equivalence');

  const [
    config,
    serializerTestSource,
    helperSource,
    interactiveHelperSource,
    axeHelperSource,
    temporalTestSource,
    navigationTestSource,
    packageJson,
  ] = await Promise.all([
    readFile(resolve(webRoot, 'playwright.config.ts'), 'utf8'),
    readFile(resolve(webRoot, 'tests/browser/accessibility-tree.spec.ts'), 'utf8'),
    readFile(resolve(webRoot, 'tests/browser/support/accessibility-tree.ts'), 'utf8'),
    readFile(resolve(webRoot, 'tests/browser/support/interactive-accessibility.ts'), 'utf8'),
    readFile(resolve(webRoot, 'tests/browser/support/accessibility-audit.ts'), 'utf8'),
    readFile(repositoryPath(webRoot, equivalence.temporal.test), 'utf8'),
    readFile(repositoryPath(webRoot, equivalence.navigation.test), 'utf8'),
    readJson(resolve(webRoot, 'package.json')),
  ]);
  assert.match(config, /children: 'deep-equal'/u, 'Playwright does not enforce strict ARIA children globally');
  assert.ok(config.includes(`pathTemplate: '${registry.policy.snapshot_path_template}'`), 'ARIA snapshot path differs from the registry');
  assert.doesNotMatch(registry.policy.snapshot_path_template, /\{projectName\}/u, 'Shared ARIA baselines must not fork by browser');
  assert.match(serializerTestSource, /tag: \['@aria-tree', '@accessibility'\]/u, 'Serializer ARIA-tree test is not tagged');
  assert.match(temporalTestSource, /tag: \['@aria-tree', '@accessibility'\]/u, 'Temporal ARIA-tree tests are not tagged');
  assert.match(navigationTestSource, /tag: \['@aria-tree', '@accessibility'\]/u, 'Navigation ARIA-tree tests are not tagged');
  for (const requirement of registry.requirements) {
    assert.ok(serializerTestSource.includes(requirement.oracle.test_title), `${requirement.id}: registered test title is absent`);
  }
  for (const property of registry.dom_only_properties) {
    assert.ok(serializerTestSource.includes(property.test_title), `${property.id}: registered DOM test title is absent`);
    assert.ok(serializerTestSource.includes(property.selector), `${property.id}: registered selector is absent from its test`);
  }
  assert.ok(
    temporalTestSource.includes(equivalence.temporal.test_title_template.replace('{id}', '')),
    'Temporal test title template is absent',
  );
  assert.ok(
    navigationTestSource.includes(equivalence.navigation.test_title_template.replace('{id}', '')),
    'Direct/enhanced test title template is absent',
  );
  assert.ok(
    navigationTestSource.includes(equivalence.navigation.native_test_title_template.replace('{id}', '')),
    'Native-only test title template is absent',
  );
  for (const state of equivalence.navigation.transaction_states) {
    assert.ok(navigationTestSource.includes(state.test_title), `${state.id}: registered transaction test title is absent`);
  }
  const interactiveSources = new Map(await Promise.all(
    [...interactiveSourceFiles].map(async path => [path, await readFile(repositoryPath(webRoot, path), 'utf8')]),
  ));
  for (const state of interactive.states) {
    const source = interactiveSources.get(state.owner_test);
    assert.ok(source?.includes(state.owner_test_title), `${state.id}: registered owner test title is absent`);
    assert.ok(source?.includes(state.id), `${state.id}: owner test never exercises the registered state`);
  }
  for (const [path, source] of interactiveSources) {
    assert.match(source, /@aria-tree/u, `${path}: interactive owner tests are not included in test:aria`);
    assert.match(source, /@accessibility/u, `${path}: interactive owner tests are not tagged for accessibility evidence`);
  }
  assert.match(helperSource, /ariaSnapshot\(\{ boxes: false \}\)/u, 'Semantic snapshots must exclude geometry');
  assert.match(helperSource, /\.aria\\\.yml/u, 'The helper must reject non-ARIA baseline names');
  assert.match(helperSource, /testInfo\.attach/u, 'Semantic failures do not create Playwright attachments');
  assert.match(helperSource, /-actual\.aria\.yml/u, 'Semantic failures do not attach actual YAML');
  assert.match(helperSource, /application\/yaml/u, 'Semantic YAML attachments use the wrong media type');
  assert.match(helperSource, /data-pinega-test-semantic-mask/u, 'Registered transition roots are not explicitly masked');
  assert.match(interactiveHelperSource, /expectNoBlockingAxeViolations/u, 'Interactive state helper does not enforce registered axe scans');
  assert.match(interactiveHelperSource, /expectSemanticAbsent/u, 'Interactive hidden states do not assert semantic absence');
  assert.match(axeHelperSource, /testInfo\.attach/u, 'Axe failures do not create diagnostic attachments');
  assert.match(axeHelperSource, /-axe\.json/u, 'Axe diagnostic attachment naming is missing');
  assert.match(packageJson.scripts['test:aria'], /tests\/browser.*--grep @aria-tree/u, 'test:aria does not run the complete tagged semantic corpus');

  return {
    schemaVersion: registry.schema_version,
    serializerRequirements: registry.requirements.length,
    strictBaselines: baselineFiles.size,
    profiles: registry.profiles.length,
    mobileProfiles: registry.profiles.filter(profile => profile.form_factor === 'mobile').length,
    domOnlyProperties: registry.dom_only_properties.length,
    temporalRoutes: equivalence.temporal.routes.length,
    registeredTransitions: equivalence.registered_transitions.length,
    routeArchetypes: pageClasses.representatives.length,
    enhancedRouteArchetypes: enhancedArchetypes.length,
    nativeRouteExclusions: nativeExclusionIds.length,
    transactionStates: transactionStateIds.length,
    interactiveStates: interactiveStateIds.length,
    interactiveSurfaces: interactiveSurfaces.length,
    interactiveStrictBaselines: interactiveBaselineFiles.size,
    interactiveAxeStates: axeStateIds.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = await validateAccessibilityCoverage();
  console.log(
    `Accessibility-tree coverage v${summary.schemaVersion}: `
    + `${summary.serializerRequirements} serializer requirements, ${summary.strictBaselines} shared baseline, `
    + `${summary.profiles} profiles (${summary.mobileProfiles} mobile), `
    + `${summary.temporalRoutes} temporal routes, ${summary.routeArchetypes} route archetypes `
    + `(${summary.enhancedRouteArchetypes} enhanced, ${summary.nativeRouteExclusions} native-only), `
      + `${summary.transactionStates} transaction states, ${summary.registeredTransitions} registered transitions, `
      + `${summary.interactiveStates} interactive states across ${summary.interactiveSurfaces} surfaces `
      + `(${summary.interactiveStrictBaselines} strict baselines, ${summary.interactiveAxeStates} axe-audited), `
    + `${summary.domOnlyProperties} DOM-only properties.`,
  );
}
