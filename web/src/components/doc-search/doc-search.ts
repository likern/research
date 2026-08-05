import { defineCustomElement } from '../../internal/define.js';

type SearchControl = HTMLElement & { value?: string };

class PinegaDocSearch extends HTMLElement {
  #controller: AbortController | undefined;
  #control: SearchControl | undefined;
  #cards: HTMLElement[] = [];
  #status: HTMLElement | undefined;
  #empty: HTMLElement | undefined;

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();

    this.#control = this.querySelector<SearchControl>('[data-doc-search-input]') ?? undefined;
    this.#cards = [...this.querySelectorAll<HTMLElement>('[data-doc-card]')];
    this.#status = this.querySelector<HTMLElement>('[data-doc-search-status]') ?? undefined;
    this.#empty = this.querySelector<HTMLElement>('[data-doc-search-empty]') ?? undefined;

    if (!this.#control || this.#cards.length === 0) return;

    this.#control.addEventListener('input', this.#handleInput, { signal: this.#controller.signal });
    this.#control.addEventListener('change', this.#handleInput, { signal: this.#controller.signal });
    this.dataset.enhanced = 'true';
    this.#filter();
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
  }

  #handleInput = (): void => {
    this.#filter();
  };

  #filter(): void {
    const query = normalize(this.#control?.value ?? this.#control?.getAttribute('value') ?? '');
    let visible = 0;

    for (const card of this.#cards) {
      const haystack = normalize(`${card.dataset.search ?? ''} ${card.textContent ?? ''}`);
      const matches = query.length === 0 || query.split(/\s+/u).every(term => haystack.includes(term));
      card.hidden = !matches;
      if (matches) visible += 1;
    }

    if (this.#status) {
      this.#status.textContent = query
        ? `${visible} of ${this.#cards.length} topics`
        : `${this.#cards.length} topics`;
    }
    if (this.#empty) this.#empty.hidden = visible !== 0;
  }
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

defineCustomElement('pinega-doc-search', PinegaDocSearch);
