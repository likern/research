export type NavigationSourceKind = 'anchor' | 'area' | 'form' | 'other' | 'none';

export interface NavigationIntent {
  currentUrl: string;
  destinationUrl: string;
  currentLanguage: string;
  navigationType: string;
  sourceKind: NavigationSourceKind;
  sourceLanguage?: string;
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
