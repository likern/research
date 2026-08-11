import { type Page, type TestInfo } from '@playwright/test';

import { interactiveAxePolicy, interactiveState } from './accessibility-contract.js';
import { expectNoBlockingAxeViolations } from './accessibility-audit.js';
import {
  captureSemanticTree,
  expectSemanticAbsent,
  expectSemanticBaseline,
  expectSemanticEquivalent,
} from './accessibility-tree.js';

interface InteractiveStateOptions {
  reference?: string;
}

export function interactiveStateApplies(stateId: string, testInfo: TestInfo): boolean {
  return interactiveState(stateId).profiles.includes(testInfo.project.name);
}

export async function expectInteractiveState(
  page: Page,
  stateId: string,
  testInfo: TestInfo,
  { reference }: InteractiveStateOptions = {},
): Promise<string | undefined> {
  const state = interactiveState(stateId);
  if (!state.profiles.includes(testInfo.project.name)) {
    throw new TypeError(`${stateId} is not registered for Playwright profile ${testInfo.project.name}.`);
  }

  const attachmentStem = state.id.toLocaleLowerCase().replaceAll('_', '-');
  let semantic: string | undefined;
  const target = page.locator(state.aria.target);

  if (state.aria.type === 'strict-baseline') {
    await expectSemanticBaseline(target, state.aria.snapshot, { attachmentStem, testInfo });
    semantic = await captureSemanticTree(target);
  } else if (state.aria.type === 'exact-equivalence') {
    if (reference === undefined) {
      throw new TypeError(`${stateId} requires the ${state.aria.reference_state} semantic reference.`);
    }
    semantic = await captureSemanticTree(target);
    await expectSemanticEquivalent(reference, semantic, {
      attachmentStem,
      message: `${stateId} differs from registered reference state ${state.aria.reference_state}`,
      testInfo,
    });
  } else if (state.aria.type === 'semantic-absence') {
    await expectSemanticAbsent(target, state.aria.text, {
      attachmentStem,
      message: `${stateId} unexpectedly exposes ${JSON.stringify(state.aria.text)}`,
      testInfo,
    });
    semantic = await captureSemanticTree(target);
  } else if (state.aria.type === 'dom-behaviour') {
    semantic = await captureSemanticTree(target);
  }

  if (state.axe.mode === 'required') {
    await expectNoBlockingAxeViolations(page, {
      attachmentStem,
      blockingImpacts: interactiveAxePolicy.blocking_impacts,
      context: state.axe.context,
      tags: interactiveAxePolicy.tags,
      testInfo,
    });
  }
  return semantic;
}
