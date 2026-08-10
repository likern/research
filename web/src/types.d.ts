declare module '*.css';

interface Window {
  __PINEGA_WEB_AWESOME_PROJECT_URL__?: string;
  __PINEGA_DISABLE_NAVIGATION__?: boolean;
  __PINEGA_DISABLE_PREFETCH__?: boolean;
  __PINEGA_INITIAL_RESPONSE_NO_STORE__?: boolean;
  __PINEGA_PREFETCH_METRICS__?: import('./navigation/intent-prefetch.js').PrefetchMetricsDetail;
}

interface HTMLElementTagNameMap {
  'pinega-site-header': HTMLElement;
  'pinega-hero': HTMLElement;
  'pinega-evidence': HTMLElement;
  'pinega-code-example': HTMLElement;
  'pinega-benchmark': HTMLElement;
  'pinega-doc-search': HTMLElement;
  'pinega-diagram-viewer': HTMLElement;
}
