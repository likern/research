let idCounter = 0;

export function ensureId(element: HTMLElement, prefix: string): string {
  if (element.id) return element.id;
  idCounter += 1;
  element.id = `${prefix}-${idCounter}`;
  return element.id;
}

export function requiredElement<T extends Element>(root: ParentNode, selector: string, description: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`${description} is required (${selector}).`);
  return element;
}
