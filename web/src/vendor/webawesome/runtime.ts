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

type RuntimeLocale = 'en' | 'ru';
type RuntimeDescriptor = Pick<WebAwesomeRuntimeResult, 'source' | 'projectUrl'>;

let initialization: Promise<WebAwesomeRuntimeResult> | undefined;
const localePreparations = new Map<string, Promise<void>>();

export function initializeWebAwesome(): Promise<WebAwesomeRuntimeResult> {
  initialization ??= initializeRuntime();
  return initialization;
}

export async function prepareWebAwesomeLocale(locale: string): Promise<void> {
  const normalized = runtimeLocale(locale);
  const runtime = await initializeWebAwesome();
  await prepareRuntimeLocale(runtime, normalized);
}

async function initializeRuntime(): Promise<WebAwesomeRuntimeResult> {
  document.documentElement.dataset.webawesome = 'loading';
  const configuredProjectUrl = readProjectUrl();
  const locale = runtimeLocale(document.documentElement.lang);
  let source: WebAwesomeRuntimeResult['source'] = 'npm';

  if (configuredProjectUrl) {
    try {
      await loadProject(configuredProjectUrl);
      source = 'project';
    } catch (error) {
      console.error('Pinega could not load the configured Web Awesome project. Falling back to the pinned Core package.', error);
      await loadCore();
      source = 'npm-fallback';
    }
  } else {
    await loadCore();
  }

  const descriptor: RuntimeDescriptor = {
    source,
    ...(configuredProjectUrl ? { projectUrl: configuredProjectUrl } : {}),
  };
  await prepareRuntimeLocale(descriptor, locale);

  await Promise.all(coreComponentTags.map(tag => customElements.whenDefined(tag)));
  const proLineChart = customElements.get('wa-line-chart') !== undefined;
  document.documentElement.dataset.webawesome = source;
  document.documentElement.dataset.webawesomeLocale = locale;

  const result: WebAwesomeRuntimeResult = {
    source,
    ...(configuredProjectUrl ? { projectUrl: configuredProjectUrl } : {}),
    proLineChart,
  };
  window.dispatchEvent(new CustomEvent(eventReady, { detail: result }));
  if (proLineChart) window.dispatchEvent(new CustomEvent(eventProReady, { detail: result }));
  return result;
}

function prepareRuntimeLocale(runtime: RuntimeDescriptor, locale: RuntimeLocale): Promise<void> {
  const key = `${runtime.source}\u0000${runtime.projectUrl ?? ''}\u0000${locale}`;
  const existing = localePreparations.get(key);
  if (existing) return existing;
  const preparation = runtime.source === 'project'
    ? loadProjectTranslation(requiredProjectUrl(runtime), locale)
    : loadCoreTranslation(locale);
  localePreparations.set(key, preparation);
  return preparation;
}

function requiredProjectUrl(runtime: RuntimeDescriptor): string {
  if (!runtime.projectUrl) throw new TypeError('Web Awesome project runtime is missing its project URL.');
  return runtime.projectUrl;
}

function runtimeLocale(value: string): RuntimeLocale {
  const locale = value.toLocaleLowerCase().split('-', 1)[0];
  if (locale === 'en' || locale === 'ru') return locale;
  throw new TypeError(`Unsupported Web Awesome locale ${JSON.stringify(value)}.`);
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

async function loadCore(): Promise<void> {
  await import('./core.js');
}

async function loadCoreTranslation(locale: RuntimeLocale): Promise<void> {
  if (locale === 'ru') await import('@awesome.me/webawesome/dist/translations/ru.js');
}

async function loadProjectTranslation(projectUrl: string, locale: RuntimeLocale): Promise<void> {
  if (locale === 'en') return;
  const translationUrl = new URL(`translations/${locale}.js`, projectUrl).href;
  await loadExternalModule(translationUrl, 'data-pinega-webawesome-translation');
}

function loadExternalModule(url: string, marker: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[${marker}]`);
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
    script.setAttribute(marker, '');
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)), { once: true });
    document.head.append(script);
  });
}
