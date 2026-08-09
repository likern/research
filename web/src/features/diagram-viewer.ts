import { ReactiveElement } from 'lit';

import { defineCustomElement } from '../internal/define.js';

class PinegaDiagramViewer extends ReactiveElement {
  protected override createRenderRoot(): HTMLElement {
    // The complete accessible SVG, caption, transcript, and download link are
    // canonical light DOM. Lit owns only this island's lifecycle and must not
    // replace the no-JavaScript representation.
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.dataset.renderer = 'lit';
  }

  override disconnectedCallback(): void {
    delete this.dataset.renderer;
    super.disconnectedCallback();
  }
}

defineCustomElement('pinega-diagram-viewer', PinegaDiagramViewer);

export const featureId = 'diagram-viewer';
export const featureElement = 'pinega-diagram-viewer';
export const featureImplementation = 'lit';
