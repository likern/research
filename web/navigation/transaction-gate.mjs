export class NavigationTransactionGate {
  #serial = 0;
  #committing = false;

  begin(signal) {
    if (!(signal instanceof AbortSignal)) throw new TypeError('Navigation transaction requires an AbortSignal.');
    return Object.freeze({ serial: ++this.#serial, signal });
  }

  invalidate() {
    this.#serial += 1;
  }

  isCurrent(transaction) {
    return transaction?.serial === this.#serial && transaction.signal?.aborted === false;
  }

  commit(transaction, apply) {
    if (typeof apply !== 'function') throw new TypeError('Navigation transaction commit requires a function.');
    if (!this.isCurrent(transaction)) return { committed: false };
    if (this.#committing) throw new TypeError('Navigation transaction commit is not reentrant.');

    this.#committing = true;
    try {
      const value = apply();
      if (value && typeof value.then === 'function') {
        throw new TypeError('Navigation transaction commit must be synchronous.');
      }
      return { committed: true, value };
    } finally {
      this.#committing = false;
    }
  }
}
