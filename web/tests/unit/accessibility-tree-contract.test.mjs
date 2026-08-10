import assert from 'node:assert/strict';
import test from 'node:test';

import { validateAccessibilityCoverage } from '../../scripts/check-accessibility-coverage.mjs';

test('accessibility-tree coverage is schema-valid, strict, shared, and complete for PR 1', async () => {
  assert.deepEqual(await validateAccessibilityCoverage(), {
    schemaVersion: 1,
    requirements: 8,
    strictBaselines: 1,
    profiles: 4,
    mobileProfiles: 1,
    domOnlyProperties: 9,
  });
});
