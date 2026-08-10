export type NavigationSourceKind = 'anchor' | 'area' | 'form' | 'other' | 'none';

export interface NavigationIntent {
  currentUrl: string;
  activeDocumentUrl: string;
  destinationUrl: string;
  navigationType: string;
  sourceKind: NavigationSourceKind;
  fallbackTarget?: string;
  canIntercept: boolean;
  cancelable: boolean;
  hashChange: boolean;
  downloadRequested: boolean;
  hasFormData: boolean;
  hasTarget: boolean;
}

export type NavigationIntentDecision =
  | { action: 'native'; reason: string }
  | { action: 'cancel'; reason: 'active-route'; url: string }
  | { action: 'intercept'; reason: 'eligible'; url: string };

export function classifyNavigationIntent(intent: NavigationIntent): NavigationIntentDecision;

export interface PrefetchIntent {
  currentUrl: string;
  activeDocumentUrl: string;
  destinationUrl: string;
  sourceKind: Extract<NavigationSourceKind, 'anchor' | 'area' | 'other' | 'none'>;
  fallbackTarget?: string;
  downloadRequested: boolean;
  hasTarget: boolean;
  disabled: boolean;
}

export type PrefetchIntentDecision =
  | { action: 'skip'; reason: string }
  | { action: 'prefetch'; reason: 'eligible'; url: string };

export function classifyPrefetchIntent(intent: PrefetchIntent): PrefetchIntentDecision;
