import { defineCustomElement } from '../../internal/define.js';

const evidenceKinds = ['confirmed', 'inferred', 'hypothesis', 'external', 'contradicted'] as const;
type EvidenceKind = typeof evidenceKinds[number];

const labels: Record<EvidenceKind, string> = {
  confirmed: 'Confirmed',
  inferred: 'Inferred',
  hypothesis: 'Hypothesis',
  external: 'External evidence',
  contradicted: 'Contradicted',
};

class PinegaEvidence extends HTMLElement {
  static observedAttributes = ['kind'];

  #internals?: ElementInternals;

  constructor() {
    super();
    if ('attachInternals' in this) this.#internals = this.attachInternals();
  }

  connectedCallback(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'note');
    this.#synchronizeKind();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'kind' && oldValue !== newValue && this.isConnected) this.#synchronizeKind();
  }

  get kind(): EvidenceKind {
    const value = this.getAttribute('kind') ?? 'confirmed';
    return isEvidenceKind(value) ? value : 'confirmed';
  }

  set kind(value: EvidenceKind) {
    if (!isEvidenceKind(value)) throw new TypeError(`Unknown Pinega evidence kind: ${value}`);
    this.setAttribute('kind', value);
  }

  #synchronizeKind(): void {
    const raw = this.getAttribute('kind') ?? 'confirmed';
    if (!isEvidenceKind(raw)) {
      console.warn(`Unknown Pinega evidence kind ${JSON.stringify(raw)}; falling back to "confirmed".`, this);
      this.setAttribute('kind', 'confirmed');
      return;
    }

    for (const kind of evidenceKinds) this.#internals?.states?.delete(kind);
    this.#internals?.states?.add(raw);
    this.dataset.kind = raw;

    let label = this.querySelector<HTMLElement>('[data-evidence-label]');
    if (!label) {
      label = document.createElement('strong');
      label.dataset.evidenceLabel = '';
      this.prepend(label);
    }
    label.textContent = labels[raw];
  }
}

function isEvidenceKind(value: string): value is EvidenceKind {
  return (evidenceKinds as readonly string[]).includes(value);
}

defineCustomElement('pinega-evidence', PinegaEvidence);
