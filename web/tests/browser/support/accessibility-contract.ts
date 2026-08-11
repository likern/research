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

interface StrictInteractiveAriaOracle {
  snapshot: string;
  target: string;
  type: 'strict-baseline';
}

interface EquivalentInteractiveAriaOracle {
  reference_state: string;
  target: string;
  type: 'exact-equivalence';
}

interface AbsentInteractiveAriaOracle {
  target: string;
  text: string;
  type: 'semantic-absence';
}

interface DomInteractiveOracle {
  assertion: string;
  target: string;
  type: 'dom-behaviour';
}

interface RequiredAxeOracle {
  context: string;
  mode: 'required';
}

interface ExemptAxeOracle {
  mode: 'not-applicable';
  reason: string;
}

export interface InteractiveAccessibilityState {
  aria: StrictInteractiveAriaOracle | EquivalentInteractiveAriaOracle | AbsentInteractiveAriaOracle | DomInteractiveOracle;
  axe: RequiredAxeOracle | ExemptAxeOracle;
  fixture: string;
  id: string;
  locale: 'en' | 'ru' | 'not-applicable';
  owner_test: string;
  owner_test_title: string;
  profiles: string[];
  state: string;
  supplemental_oracles: string[];
  surface: string;
}

interface AccessibilityCoverageRegistry {
  policy: {
    required_profiles: string[];
  };
  requirements: CoverageRequirement[];
  interactive_components: {
    policy: {
      axe: {
        blocking_impacts: string[];
        tags: string[];
      };
    };
    states: InteractiveAccessibilityState[];
  };
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
export const interactiveStates = accessibilityCoverage.interactive_components.states;
export const interactiveAxePolicy = accessibilityCoverage.interactive_components.policy.axe;

export function interactiveState(id: string): InteractiveAccessibilityState {
  const state = interactiveStates.find(candidate => candidate.id === id);
  if (!state) throw new TypeError(`Unknown interactive accessibility state ${JSON.stringify(id)}.`);
  return state;
}

export function registeredTransitionsFor(scope: SemanticEquivalenceScope): RegisteredSemanticTransition[] {
  return accessibilityCoverage.semantic_equivalence.registered_transitions
    .filter(transition => transition.applies_to.includes(scope))
    .map(({ id, selector }) => ({ id, selector }));
}
