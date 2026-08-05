import { defineCustomElement } from '../../internal/define.js';
import { ensureId } from '../../internal/dom.js';

class PinegaSiteHeader extends HTMLElement {
  #controller: AbortController | undefined;
  #button?: HTMLElement;
  #navigation?: HTMLElement;

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();

    const button = this.querySelector<HTMLElement>('[data-navigation-toggle]');
    const navigation = this.querySelector<HTMLElement>('nav[data-primary-navigation]');
    if (!button || !navigation) return;

    this.#button = button;
    this.#navigation = navigation;
    const navigationId = ensureId(navigation, 'pinega-primary-navigation');
    button.setAttribute('aria-controls', navigationId);
    button.setAttribute('aria-expanded', 'false');
    this.dataset.enhanced = 'true';

    button.addEventListener('click', this.#handleToggle, { signal: this.#controller.signal });
    this.addEventListener('keydown', this.#handleKeyDown, { signal: this.#controller.signal });
    navigation.addEventListener('click', this.#handleNavigationClick, { signal: this.#controller.signal });
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
  }

  #handleToggle = (): void => {
    this.#setOpen(this.#button?.getAttribute('aria-expanded') !== 'true');
  };

  #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    this.#setOpen(false);
    this.#button?.focus();
  };

  #handleNavigationClick = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest('a')) this.#setOpen(false);
  };

  #setOpen(open: boolean): void {
    this.#button?.setAttribute('aria-expanded', String(open));
    this.toggleAttribute('data-open', open);
  }
}

defineCustomElement('pinega-site-header', PinegaSiteHeader);
