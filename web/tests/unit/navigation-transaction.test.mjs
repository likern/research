import assert from 'node:assert/strict';
import test from 'node:test';

import { NavigationTransactionGate } from '../../navigation/transaction-gate.mjs';

test('only the latest live navigation transaction may enter the synchronous commit section', () => {
  const gate = new NavigationTransactionGate();
  const slow = gate.begin(new AbortController().signal);
  const fast = gate.begin(new AbortController().signal);
  const commits = [];

  assert.deepEqual(gate.commit(slow, () => commits.push('slow')), { committed: false });
  assert.deepEqual(gate.commit(fast, () => commits.push('fast')), { committed: true, value: 1 });
  assert.deepEqual(commits, ['fast']);
});

test('an aborted current transaction cannot commit', () => {
  const gate = new NavigationTransactionGate();
  const controller = new AbortController();
  const transaction = gate.begin(controller.signal);
  controller.abort();

  assert.equal(gate.isCurrent(transaction), false);
  assert.deepEqual(gate.commit(transaction, () => assert.fail('aborted transaction committed')), { committed: false });
});

test('a newer native or cancelled navigation explicitly invalidates pending enhanced work', () => {
  const gate = new NavigationTransactionGate();
  const pending = gate.begin(new AbortController().signal);
  gate.invalidate();

  assert.equal(gate.isCurrent(pending), false);
  assert.deepEqual(gate.commit(pending, () => assert.fail('invalidated transaction committed')), { committed: false });
});

test('the guarded commit section rejects asynchronous and reentrant writers', () => {
  const gate = new NavigationTransactionGate();
  const transaction = gate.begin(new AbortController().signal);

  assert.throws(
    () => gate.commit(transaction, () => Promise.resolve()),
    /must be synchronous/u,
  );
  assert.throws(
    () => gate.commit(transaction, () => gate.commit(transaction, () => undefined)),
    /not reentrant/u,
  );
});
