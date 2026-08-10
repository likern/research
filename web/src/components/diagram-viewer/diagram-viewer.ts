import { Task, TaskStatus } from '@lit/task';
import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { getMessages, type PinegaLocale } from '../../i18n/messages.js';
import { defineCustomElement } from '../../internal/define.js';
import {
  loadDiagramModelSummary,
  type DiagramModelItemKind,
  type DiagramModelSummary,
} from './model-inspector.js';

type ModelTaskArguments = readonly [
  href: string,
  baseUrl: string,
  siteOrigin: string,
  expectedId: string,
  locale: PinegaLocale,
];

let diagramViewerSequence = 0;

class PinegaDiagramViewer extends LitElement {
  #connectionController: AbortController | undefined;
  #expanded = false;
  #locale: PinegaLocale | undefined;
  #needsModelLoad = true;
  readonly #panelId = `pinega-diagram-model-${++diagramViewerSequence}`;
  #restartOnConnect = false;
  #transcript: HTMLDetailsElement | undefined;

  readonly #modelTask = new Task<ModelTaskArguments, DiagramModelSummary>(this, {
    autoRun: false,
    task: async ([href, baseUrl, siteOrigin, expectedId, locale], { signal }) => (
      loadDiagramModelSummary({ href, baseUrl, siteOrigin, expectedId, locale, signal })
    ),
    onComplete: () => {
      this.#needsModelLoad = false;
    },
    onError: () => {
      this.#needsModelLoad = true;
    },
  });

  protected override createRenderRoot(): HTMLElement {
    const roots = [...this.querySelectorAll<HTMLElement>('[data-pinega-island-root]')]
      .filter(root => root.closest('pinega-diagram-viewer') === this);
    if (roots.length !== 1) {
      throw new TypeError(`pinega-diagram-viewer requires one component-local render root; found ${roots.length}.`);
    }
    const root = roots[0];
    if (!root) throw new TypeError('pinega-diagram-viewer has no component-local render root.');
    // A live element may be cloned by a future prototype/cache implementation.
    // Never adopt Lit markers or stateful UI from another component instance.
    root.hidden = true;
    root.replaceChildren();
    delete this.dataset.pinegaIslandReady;
    return root;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const locale = this.dataset.pinegaLocale;
    if (locale !== 'en' && locale !== 'ru') {
      throw new TypeError(`pinega-diagram-viewer requires a supported data-pinega-locale; got ${JSON.stringify(locale)}.`);
    }
    if (this.#locale !== undefined && this.#locale !== locale) {
      throw new TypeError(`pinega-diagram-viewer cannot change locale from ${JSON.stringify(this.#locale)} to ${JSON.stringify(locale)}.`);
    }
    this.#locale = locale;
    this.#connectionController?.abort();
    this.#connectionController = new AbortController();
    this.#transcript = this.querySelector<HTMLDetailsElement>('.pinega-diagram-transcript') ?? undefined;
    const listenerOptions = { signal: this.#connectionController.signal };
    window.addEventListener('keydown', this.#handleWindowKeydown, listenerOptions);
    this.#transcript?.addEventListener('toggle', this.#handleTranscriptToggle, listenerOptions);
    this.dataset.renderer = 'lit';
    this.dataset.pinegaIslandState = 'connected';

    if (this.#restartOnConnect && this.#expanded) {
      this.#restartOnConnect = false;
      this.#runModelTask();
    }
  }

  override disconnectedCallback(): void {
    this.#restartOnConnect = this.#expanded && this.#modelTask.status === TaskStatus.PENDING;
    if (this.#modelTask.status === TaskStatus.PENDING) {
      this.#needsModelLoad = true;
      this.#modelTask.abort(new DOMException('The diagram island disconnected.', 'AbortError'));
    }
    this.#connectionController?.abort();
    this.#connectionController = undefined;
    this.#transcript = undefined;
    delete this.dataset.renderer;
    this.dataset.pinegaIslandState = 'disconnected';
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    const root = this.renderRoot as HTMLElement;
    root.hidden = false;
    this.dataset.pinegaIslandReady = 'true';
  }

  protected override render(): TemplateResult {
    const messages = getMessages(this.#locale ?? 'en').diagram;
    const panelTitleId = `${this.#panelId}-title`;
    const state = taskState(this.#modelTask.status);
    return html`
      <div class="pinega-diagram-model-inspector" data-pinega-task-state=${state}>
        <button
          class="pinega-diagram-model-toggle"
          type="button"
          aria-controls=${this.#panelId}
          aria-expanded=${String(this.#expanded)}
          @click=${this.#handleToggle}
        >${this.#expanded ? messages.inspector_close : messages.inspector_open}</button>
        ${this.#expanded ? html`
          <section
            class="pinega-diagram-model-panel"
            id=${this.#panelId}
            aria-labelledby=${panelTitleId}
            aria-busy=${String(this.#modelTask.status === TaskStatus.PENDING)}
            aria-live="polite"
            data-pinega-model-state=${state}
          >
            <h4 id=${panelTitleId}>${messages.inspector_title}</h4>
            ${this.#modelTask.render({
              initial: () => html`<p role="status">${messages.inspector_loading}</p>`,
              pending: () => html`<p role="status">${messages.inspector_loading}</p>`,
              complete: summary => this.#renderSummary(summary),
              error: () => html`
                <p role="alert">${messages.inspector_error}</p>
                <button class="pinega-diagram-model-retry" type="button" @click=${this.#handleRetry}>
                  ${messages.inspector_retry}
                </button>
              `,
            })}
          </section>
        ` : nothing}
      </div>
    `;
  }

  #renderSummary(summary: DiagramModelSummary): TemplateResult {
    const messages = getMessages(this.#locale ?? 'en').diagram;
    return html`
      <p class="pinega-diagram-model-name">${summary.title}</p>
      <dl>
        <div><dt>${messages.inspector_schema}</dt><dd>v${summary.schemaVersion}</dd></div>
        <div><dt>${messages.inspector_kind}</dt><dd>${kindLabel(summary.kind, messages)}</dd></div>
        <div><dt>${itemLabel(summary.itemKind, messages)}</dt><dd>${summary.itemCount}</dd></div>
      </dl>
      <p>${summary.description}</p>
    `;
  }

  #handleToggle = (): void => {
    if (this.#expanded) {
      this.#collapse(false);
      return;
    }
    this.#expanded = true;
    this.requestUpdate();
    if (this.#needsModelLoad || this.#modelTask.status !== TaskStatus.COMPLETE) this.#runModelTask();
  };

  #handleRetry = (): void => {
    this.#runModelTask();
  };

  #handleTranscriptToggle = (): void => {
    if (this.#transcript?.open === false && this.#expanded) this.#collapse(false);
  };

  #handleWindowKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.#expanded) return;
    event.preventDefault();
    this.#collapse(true);
  };

  #collapse(returnFocus: boolean): void {
    if (this.#modelTask.status === TaskStatus.PENDING) {
      this.#needsModelLoad = true;
      this.#modelTask.abort(new DOMException('The diagram model inspector closed.', 'AbortError'));
    }
    this.#expanded = false;
    this.requestUpdate();
    if (!returnFocus) return;
    void this.updateComplete.then(() => {
      if (!this.isConnected) return;
      this.renderRoot.querySelector<HTMLButtonElement>('.pinega-diagram-model-toggle')?.focus();
    });
  }

  #runModelTask(): void {
    const anchor = this.querySelector<HTMLAnchorElement>('.pinega-diagram-transcript a[download]');
    const arguments_ = [
      anchor?.getAttribute('href') ?? '',
      document.baseURI,
      window.location.origin,
      this.dataset.diagramId ?? '',
      this.#locale ?? 'en',
    ] as const;
    this.#needsModelLoad = false;
    void this.#modelTask.run(arguments_);
  }
}

function taskState(status: number): 'initial' | 'pending' | 'complete' | 'error' {
  if (status === TaskStatus.PENDING) return 'pending';
  if (status === TaskStatus.COMPLETE) return 'complete';
  if (status === TaskStatus.ERROR) return 'error';
  return 'initial';
}

function kindLabel(kind: DiagramModelSummary['kind'], messages: ReturnType<typeof getMessages>['diagram']): string {
  if (kind === 'history') return messages.inspector_kind_history;
  if (kind === 'lifecycle') return messages.inspector_kind_lifecycle;
  return messages.inspector_kind_version_chain;
}

function itemLabel(kind: DiagramModelItemKind, messages: ReturnType<typeof getMessages>['diagram']): string {
  if (kind === 'operations') return messages.inspector_items_operations;
  if (kind === 'states') return messages.inspector_items_states;
  return messages.inspector_items_versions;
}

defineCustomElement('pinega-diagram-viewer', PinegaDiagramViewer);
