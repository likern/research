import type { PinegaLocale } from '../../i18n/messages.js';
import type { DiagramKind, DiagramModel } from '../../diagrams/types.js';
import { validateDiagramModel } from '../../diagrams/validate.js';

export const MAX_DIAGRAM_MODEL_BYTES = 64 * 1024;

export type DiagramModelItemKind = 'operations' | 'states' | 'versions';

export interface DiagramModelSummary {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly kind: DiagramKind;
  readonly title: string;
  readonly description: string;
  readonly itemKind: DiagramModelItemKind;
  readonly itemCount: number;
}

interface DiagramModelRequest {
  readonly href: string;
  readonly baseUrl: string;
  readonly siteOrigin: string;
  readonly expectedId: string;
  readonly locale: PinegaLocale;
  readonly signal: AbortSignal;
  readonly fetcher?: typeof fetch;
}

export class DiagramModelRequestError extends TypeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DiagramModelRequestError';
  }
}

export function resolveDiagramModelUrl({
  href,
  baseUrl,
  siteOrigin,
  expectedId,
  locale,
}: Omit<DiagramModelRequest, 'fetcher' | 'signal'>): URL {
  if (!/^[a-z][a-z0-9-]*$/u.test(expectedId)) {
    throw new DiagramModelRequestError(`Invalid diagram ID ${JSON.stringify(expectedId)}.`);
  }
  const origin = new URL(siteOrigin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new DiagramModelRequestError(`Invalid site origin ${JSON.stringify(siteOrigin)}.`);
  }
  const url = new URL(href, baseUrl);
  if (url.origin !== origin.origin || url.username || url.password || url.search || url.hash) {
    throw new DiagramModelRequestError('Diagram models must use an uncredentialed, same-origin URL without query or fragment state.');
  }
  const expectedPath = locale === 'en'
    ? `/diagrams/models/${expectedId}.json`
    : `/content/diagrams/${locale}/${expectedId}.json`;
  if (url.pathname !== expectedPath) {
    throw new DiagramModelRequestError(`Diagram model URL ${JSON.stringify(url.pathname)} does not match ${JSON.stringify(expectedPath)}.`);
  }
  return url;
}

export async function loadDiagramModelSummary(request: DiagramModelRequest): Promise<DiagramModelSummary> {
  throwIfAborted(request.signal);
  const url = resolveDiagramModelUrl(request);
  const response = await (request.fetcher ?? globalThis.fetch)(url, {
    cache: 'default',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
    signal: request.signal,
  });
  throwIfAborted(request.signal);
  if (!response.ok) {
    throw new DiagramModelRequestError(`Diagram model returned HTTP ${response.status}.`);
  }
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLocaleLowerCase();
  if (mediaType !== 'application/json') {
    throw new DiagramModelRequestError(`Diagram model returned unsupported media type ${JSON.stringify(mediaType ?? '')}.`);
  }
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_DIAGRAM_MODEL_BYTES) {
      throw new DiagramModelRequestError(`Diagram model exceeds the ${MAX_DIAGRAM_MODEL_BYTES}-byte component limit.`);
    }
  }
  const source = await readBoundedText(response, request.signal);

  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch (error) {
    throw new DiagramModelRequestError('Diagram model is not valid JSON.', { cause: error });
  }
  const model = validateDiagramModel(value);
  if (model.id !== request.expectedId) {
    throw new DiagramModelRequestError(
      `Diagram model ID ${JSON.stringify(model.id)} does not match ${JSON.stringify(request.expectedId)}.`,
    );
  }
  return summarizeDiagramModel(model);
}

export function summarizeDiagramModel(model: DiagramModel): DiagramModelSummary {
  const items = modelItems(model);
  return Object.freeze({
    schemaVersion: model.schemaVersion,
    id: model.id,
    kind: model.kind,
    title: model.title,
    description: model.description,
    itemKind: items.kind,
    itemCount: items.count,
  });
}

function modelItems(model: DiagramModel): { readonly kind: DiagramModelItemKind; readonly count: number } {
  if (model.kind === 'history') return { kind: 'operations', count: model.operations.length };
  if (model.kind === 'lifecycle') return { kind: 'states', count: model.states.length };
  return { kind: 'versions', count: model.versions.length };
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  throw signal.reason ?? new DOMException('The diagram model request was aborted.', 'AbortError');
}

async function readBoundedText(response: Response, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const source = await response.text();
    throwIfAborted(signal);
    if (new TextEncoder().encode(source).byteLength > MAX_DIAGRAM_MODEL_BYTES) throwModelSizeError();
    return source;
  }

  const decoder = new TextDecoder();
  let bytes = 0;
  let source = '';
  const cancel = (): void => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      throwIfAborted(signal);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_DIAGRAM_MODEL_BYTES) {
        await reader.cancel().catch(() => undefined);
        throwModelSizeError();
      }
      source += decoder.decode(value, { stream: true });
    }
    return source + decoder.decode();
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

function throwModelSizeError(): never {
  throw new DiagramModelRequestError(`Diagram model exceeds the ${MAX_DIAGRAM_MODEL_BYTES}-byte component limit.`);
}
