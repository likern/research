import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyNavigationIntent, classifyPrefetchIntent } from '../../navigation/policy.mjs';

const ordinaryLink = Object.freeze({
  currentUrl: 'https://pinega.example/',
  activeDocumentUrl: 'https://pinega.example/',
  destinationUrl: 'https://pinega.example/technology/',
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
  assert.equal(classifyNavigationIntent({
    ...ordinaryLink,
    destinationUrl: 'https://pinega.example/ru/technology/',
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

test('a URL committed ahead of its handler is not mistaken for the active document', () => {
  assert.equal(classifyNavigationIntent({
    ...ordinaryLink,
    currentUrl: 'https://pinega.example/technology/',
    activeDocumentUrl: 'https://pinega.example/',
    destinationUrl: 'https://pinega.example/technology/',
  }).action, 'intercept');

  assert.equal(classifyNavigationIntent({
    ...ordinaryLink,
    currentUrl: 'https://pinega.example/technology/',
    activeDocumentUrl: 'https://pinega.example/',
    destinationUrl: 'https://pinega.example/technology/#optimisation',
    hashChange: true,
  }).action, 'intercept');

  assert.deepEqual(classifyNavigationIntent({
    ...ordinaryLink,
    currentUrl: 'https://pinega.example/research/',
    activeDocumentUrl: 'https://pinega.example/technology/',
    destinationUrl: 'https://pinega.example/technology/',
    navigationType: 'traverse',
    sourceKind: 'none',
  }), {
    action: 'native',
    reason: 'active-document-traverse',
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

const ordinaryPrefetch = Object.freeze({
  currentUrl: 'https://pinega.example/',
  activeDocumentUrl: 'https://pinega.example/',
  destinationUrl: 'https://pinega.example/technology/',
  sourceKind: 'anchor',
  downloadRequested: false,
  hasTarget: false,
  disabled: false,
});

test('prefetch eligibility is a strict subset of enhanced link navigation', () => {
  assert.deepEqual(classifyPrefetchIntent(ordinaryPrefetch), {
    action: 'prefetch',
    reason: 'eligible',
    url: ordinaryPrefetch.destinationUrl,
  });
  assert.deepEqual(classifyPrefetchIntent({
    ...ordinaryPrefetch,
    destinationUrl: 'https://pinega.example/technology/#optimisation',
  }), {
    action: 'prefetch',
    reason: 'eligible',
    url: 'https://pinega.example/technology/#optimisation',
  });

  const cases = [
    ['active-route', { destinationUrl: 'https://pinega.example/#ignored' }],
    ['download', { downloadRequested: true }],
    ['target', { hasTarget: true }],
    ['disabled', { disabled: true }],
    ['source', { sourceKind: 'none' }],
    ['cross-origin', { destinationUrl: 'https://example.com/technology/' }],
    ['non-http', { destinationUrl: 'mailto:research@pinega.example' }],
    ['url-credentials', { destinationUrl: 'https://user:secret@pinega.example/technology/' }],
  ];
  for (const [reason, override] of cases) {
    assert.deepEqual(classifyPrefetchIntent({ ...ordinaryPrefetch, ...override }), {
      action: 'skip',
      reason,
    });
  }
});

test('prefetch respects the same guarded hard-navigation destination boundary', () => {
  assert.deepEqual(classifyPrefetchIntent({
    ...ordinaryPrefetch,
    fallbackTarget: 'https://pinega.example/technology/#ignored',
  }), {
    action: 'skip',
    reason: 'fallback-guard',
  });
});
