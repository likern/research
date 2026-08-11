import assert from 'node:assert/strict';
import test from 'node:test';

import { validateAccessibilityCoverage } from '../../scripts/check-accessibility-coverage.mjs';

test('accessibility-tree coverage is schema-valid, strict, and complete through temporal and navigation semantics', async () => {
  assert.deepEqual(await validateAccessibilityCoverage(), {
    schemaVersion: 2,
    serializerRequirements: 8,
    strictBaselines: 1,
    profiles: 4,
    mobileProfiles: 1,
    domOnlyProperties: 9,
    temporalRoutes: 6,
    registeredTransitions: 5,
    routeArchetypes: 13,
    enhancedRouteArchetypes: 11,
    nativeRouteExclusions: 2,
    transactionStates: 4,
  });
});
