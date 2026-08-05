import { defineCustomElement } from '../../internal/define.js';
import { ensureId, requiredElement } from '../../internal/dom.js';

class PinegaCodeExample extends HTMLElement {
  #controller: AbortController | undefined;

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();

    const code = requiredElement<HTMLElement>(this, 'pre code', 'Pinega code example content');
    const codeId = ensureId(code, 'pinega-code');
    const copyButton = this.querySelector<HTMLElement>('wa-copy-button');
    if (copyButton) {
      copyButton.setAttribute('from', codeId);
      copyButton.setAttribute('copy-label', 'Copy code');
      copyButton.setAttribute('success-label', 'Copied');
      copyButton.setAttribute('error-label', 'Copy failed');
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
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = 'Copied';
      this.dispatchEvent(new CustomEvent('pinega-copy', { bubbles: true, composed: true }));
    } catch (error) {
      console.error('Pinega code copy failed.', error);
      button.textContent = 'Copy failed';
      this.dispatchEvent(new CustomEvent('pinega-copy-error', { bubbles: true, composed: true, detail: error }));
    } finally {
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = original;
      }, 1_000);
    }
  }
}

defineCustomElement('pinega-code-example', PinegaCodeExample);
