import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const defaultWebRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

  const domOnlySet = new Set(domOnlyIds);
  const sourceFiles = new Set(registry.dom_only_properties.map(property => property.test));
  const fixtureFiles = new Set();
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

  const [config, testSource, helperSource] = await Promise.all([
    readFile(resolve(webRoot, 'playwright.config.ts'), 'utf8'),
    readFile(resolve(webRoot, 'tests/browser/accessibility-tree.spec.ts'), 'utf8'),
    readFile(resolve(webRoot, 'tests/browser/support/accessibility-tree.ts'), 'utf8'),
  ]);
  assert.match(config, /children: 'deep-equal'/u, 'Playwright does not enforce strict ARIA children globally');
  assert.ok(config.includes(`pathTemplate: '${registry.policy.snapshot_path_template}'`), 'ARIA snapshot path differs from the registry');
  assert.doesNotMatch(registry.policy.snapshot_path_template, /\{projectName\}/u, 'Shared ARIA baselines must not fork by browser');
  assert.match(testSource, /tag: \['@aria-tree', '@accessibility'\]/u, 'ARIA-tree tests are not tagged for selection and reporting');
  for (const requirement of registry.requirements) assert.ok(testSource.includes(requirement.oracle.test_title), `${requirement.id}: registered test title is absent`);
  for (const property of registry.dom_only_properties) {
    assert.ok(testSource.includes(property.test_title), `${property.id}: registered DOM test title is absent`);
    assert.ok(testSource.includes(property.selector), `${property.id}: registered selector is absent from its test`);
  }
  assert.match(helperSource, /ariaSnapshot\(\{ boxes: false \}\)/u, 'Semantic snapshots must exclude geometry');
  assert.match(helperSource, /\.aria\\\.yml/u, 'The helper must reject non-ARIA baseline names');

  return {
    schemaVersion: registry.schema_version,
    requirements: registry.requirements.length,
    strictBaselines: baselineFiles.size,
    profiles: registry.profiles.length,
    mobileProfiles: registry.profiles.filter(profile => profile.form_factor === 'mobile').length,
    domOnlyProperties: registry.dom_only_properties.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = await validateAccessibilityCoverage();
  console.log(
    `Accessibility-tree coverage v${summary.schemaVersion}: `
    + `${summary.requirements} requirements, ${summary.strictBaselines} shared baseline, `
    + `${summary.profiles} profiles (${summary.mobileProfiles} mobile), `
    + `${summary.domOnlyProperties} DOM-only properties.`,
  );
}
