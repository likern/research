import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RegisteredSemanticTransition } from './accessibility-tree.js';

type SemanticEquivalenceScope = 'navigation' | 'temporal';

interface CoverageRequirement {
  oracle: {
    snapshot: string;
  };
}

interface TemporalRoute {
  id: string;
  locale: 'en' | 'ru';
  route: string;
}

interface RegisteredTransition extends RegisteredSemanticTransition {
  applies_to: SemanticEquivalenceScope[];
}

interface NativeRouteExclusion {
  content_type: string;
  id: string;
  reason: string;
  route: string;
}

interface AccessibilityCoverageRegistry {
  policy: {
    required_profiles: string[];
  };
  requirements: CoverageRequirement[];
  semantic_equivalence: {
    registered_transitions: RegisteredTransition[];
    temporal: {
      routes: TemporalRoute[];
    };
    navigation: {
      native_route_exclusions: NativeRouteExclusion[];
    };
  };
}

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const accessibilityCoverage = JSON.parse(
  await readFile(resolve(webRoot, 'tests/accessibility/coverage.json'), 'utf8'),
) as AccessibilityCoverageRegistry;

export const temporalRoutes = accessibilityCoverage.semantic_equivalence.temporal.routes;
export const nativeRouteExclusions = accessibilityCoverage.semantic_equivalence.navigation.native_route_exclusions;

export function registeredTransitionsFor(scope: SemanticEquivalenceScope): RegisteredSemanticTransition[] {
  return accessibilityCoverage.semantic_equivalence.registered_transitions
    .filter(transition => transition.applies_to.includes(scope))
    .map(({ id, selector }) => ({ id, selector }));
}
