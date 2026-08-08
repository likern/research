import { defineCustomElement } from '../../internal/define.js';
import { ensureId, requiredElement } from '../../internal/dom.js';
import { getMessages } from '../../i18n/messages.js';

class PinegaCodeExample extends HTMLElement {
  #controller: AbortController | undefined;

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();

    const code = requiredElement<HTMLElement>(this, 'pre code', 'Pinega code example content');
    const codeId = ensureId(code, 'pinega-code');
    const messages = getMessages();
    const copyButton = this.querySelector<HTMLElement>('wa-copy-button');
    if (copyButton) {
      copyButton.setAttribute('from', codeId);
      copyButton.setAttribute('copy-label', messages.code.copy);
      copyButton.setAttribute('success-label', messages.code.success);
      copyButton.setAttribute('error-label', messages.code.error);
      customElements.whenDefined('wa-copy-button').then(() => {
        if (this.isConnected) this.dataset.copyRenderer = 'webawesome';
      });
    }

    const nativeButton = this.querySelector<HTMLButtonElement>('[data-native-copy]');
    nativeButton?.addEventListener('click', () => this.#copy(code.textContent ?? '', nativeButton), {
      signal: this.#controller.signal,
    });
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
  }

  async #copy(value: string, button: HTMLButtonElement): Promise<void> {
    const messages = getMessages();
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = messages.code.success;
      this.dispatchEvent(new CustomEvent('pinega-copy', { bubbles: true, composed: true }));
    } catch (error) {
      console.error('Pinega code copy failed.', error);
      button.textContent = messages.code.error;
      this.dispatchEvent(new CustomEvent('pinega-copy-error', { bubbles: true, composed: true, detail: error }));
    } finally {
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = original;
      }, 1_000);
    }
  }
}

defineCustomElement('pinega-code-example', PinegaCodeExample);
