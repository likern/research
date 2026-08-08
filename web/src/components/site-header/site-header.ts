import { defineCustomElement } from '../../internal/define.js';
import { ensureId } from '../../internal/dom.js';

class PinegaSiteHeader extends HTMLElement {
  #controller: AbortController | undefined;
  #button?: HTMLElement;
  #navigation?: HTMLElement;

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();
    this.addEventListener('click', this.#handleLanguageSelection, { signal: this.#controller.signal });

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

  #handleLanguageSelection = (event: Event): void => {
    const control = event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>('[data-translation-unavailable]')
      : null;
    if (!control || !this.contains(control)) return;

    const noticeId = control.getAttribute('aria-controls');
    const notice = noticeId ? document.getElementById(noticeId) : null;
    if (!(notice instanceof HTMLElement) || !this.contains(notice)) return;
    const message = notice.querySelector<HTMLElement>('[data-translation-notice-message]');
    if (!message) return;

    event.preventDefault();
    this.querySelectorAll<HTMLElement>('[data-translation-notice][data-visible]').forEach(element => {
      element.removeAttribute('data-visible');
    });
    message.textContent = '';
    requestAnimationFrame(() => {
      message.textContent = message.dataset.message ?? '';
      notice.setAttribute('data-visible', '');
    });
  };

  #setOpen(open: boolean): void {
    this.#button?.setAttribute('aria-expanded', String(open));
    this.toggleAttribute('data-open', open);
  }
}

defineCustomElement('pinega-site-header', PinegaSiteHeader);
