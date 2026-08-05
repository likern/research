import { coreComponentTags } from './core-tags.js';

const projectMetaName = 'webawesome-project-url';
const eventReady = 'pinega:webawesome-ready';
const eventProReady = 'pinega:webawesome-pro-ready';

declare const __PINEGA_WEB_AWESOME_PROJECT_URL__: string;

export interface WebAwesomeRuntimeResult {
  source: 'npm' | 'project' | 'npm-fallback';
  projectUrl?: string;
  proLineChart: boolean;
}

export async function initializeWebAwesome(): Promise<WebAwesomeRuntimeResult> {
  document.documentElement.dataset.webawesome = 'loading';
  const configuredProjectUrl = readProjectUrl();
  let source: WebAwesomeRuntimeResult['source'] = 'npm';

  if (configuredProjectUrl) {
    try {
      await loadProject(configuredProjectUrl);
      source = 'project';
    } catch (error) {
      console.error('Pinega could not load the configured Web Awesome project. Falling back to the pinned Core package.', error);
      await import('./core.js');
      source = 'npm-fallback';
    }
  } else {
    await import('./core.js');
  }

  await Promise.all(coreComponentTags.map(tag => customElements.whenDefined(tag)));
  const proLineChart = customElements.get('wa-line-chart') !== undefined;
  document.documentElement.dataset.webawesome = source;

  const result: WebAwesomeRuntimeResult = {
    source,
    ...(configuredProjectUrl ? { projectUrl: configuredProjectUrl } : {}),
    proLineChart,
  };
  window.dispatchEvent(new CustomEvent(eventReady, { detail: result }));
  if (proLineChart) window.dispatchEvent(new CustomEvent(eventProReady, { detail: result }));
  return result;
}

export function onWebAwesomeProReady(callback: () => void, signal?: AbortSignal): void {
  if (customElements.get('wa-line-chart')) {
    queueMicrotask(callback);
    return;
  }
  const options: AddEventListenerOptions = { once: true };
  if (signal) options.signal = signal;
  window.addEventListener(eventProReady, callback, options);
}

function readProjectUrl(): string | undefined {
  const compileTime = typeof __PINEGA_WEB_AWESOME_PROJECT_URL__ === 'string'
    ? __PINEGA_WEB_AWESOME_PROJECT_URL__.trim()
    : '';
  const runtime = window.__PINEGA_WEB_AWESOME_PROJECT_URL__?.trim() ?? '';
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${projectMetaName}"]`)?.content.trim() ?? '';
  const candidate = runtime || meta || compileTime;
  if (!candidate) return undefined;

  const url = new URL(candidate, document.baseURI);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new TypeError('The Web Awesome project URL must use HTTPS outside local development.');
  }
  return url.href;
}

function loadProject(url: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>('script[data-pinega-webawesome-project]');
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = url;
    script.dataset.pinegaWebawesomeProject = '';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)), { once: true });
    document.head.append(script);
  });
}
