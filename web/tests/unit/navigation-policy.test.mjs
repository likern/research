import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyNavigationIntent } from '../../navigation/policy.mjs';

const ordinaryLink = Object.freeze({
  currentUrl: 'https://pinega.example/',
  destinationUrl: 'https://pinega.example/technology/',
  currentLanguage: 'en',
  navigationType: 'push',
  sourceKind: 'anchor',
  canIntercept: true,
  cancelable: true,
  hashChange: false,
  downloadRequested: false,
  hasFormData: false,
  hasTarget: false,
});

test('ordinary same-origin HTTP links and same-document traversals are intercepted', () => {
  assert.deepEqual(classifyNavigationIntent(ordinaryLink), {
    action: 'intercept',
    reason: 'eligible',
    url: 'https://pinega.example/technology/',
  });
  assert.equal(classifyNavigationIntent({
    ...ordinaryLink,
    navigationType: 'traverse',
    sourceKind: 'none',
  }).action, 'intercept');
});

test('an active route is cancelled without fetch or visible commit', () => {
  assert.deepEqual(classifyNavigationIntent({
    ...ordinaryLink,
    destinationUrl: ordinaryLink.currentUrl,
  }), {
    action: 'cancel',
    reason: 'active-route',
    url: ordinaryLink.currentUrl,
  });
});

test('ineligible navigation classes remain native', () => {
  const cases = [
    ['cannot-intercept', { canIntercept: false }],
    ['reload', { navigationType: 'reload' }],
    ['fragment', { hashChange: true, destinationUrl: 'https://pinega.example/#target' }],
    ['download', { downloadRequested: true }],
    ['form', { hasFormData: true, sourceKind: 'form' }],
    ['target', { hasTarget: true }],
    ['source', { sourceKind: 'none' }],
    ['locale', { sourceLanguage: 'ru' }],
    ['cross-origin', { destinationUrl: 'https://example.com/technology/' }],
    ['non-http', { destinationUrl: 'mailto:research@pinega.example' }],
  ];
  for (const [reason, override] of cases) {
    assert.deepEqual(classifyNavigationIntent({ ...ordinaryLink, ...override }), {
      action: 'native',
      reason,
    });
  }
});

test('hard-fallback guard leaves the retried destination to native navigation', () => {
  assert.deepEqual(classifyNavigationIntent({
    ...ordinaryLink,
    fallbackTarget: 'https://pinega.example/technology/#ignored',
  }), {
    action: 'native',
    reason: 'fallback-guard',
  });
});
