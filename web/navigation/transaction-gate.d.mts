export interface NavigationTransaction {
  readonly serial: number;
  readonly signal: AbortSignal;
}

export type NavigationCommitResult<T> =
  | { committed: false }
  | { committed: true; value: T };

export class NavigationTransactionGate {
  begin(signal: AbortSignal): NavigationTransaction;
  invalidate(): void;
  isCurrent(transaction: NavigationTransaction): boolean;
  commit<T>(transaction: NavigationTransaction, apply: () => T): NavigationCommitResult<T>;
}
