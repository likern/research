export function defineCustomElement(name: string, constructor: CustomElementConstructor): void {
  if (customElements.get(name) === undefined) customElements.define(name, constructor);
}
