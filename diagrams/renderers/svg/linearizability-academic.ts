export type Operation = {
  id: string;
  label: string;
  start: number;
  end: number;
  linearizationPoint?: number;
};

export type LinearizabilityAcademicModel = {
  operations: Operation[];
  witness: string[];
};

/**
 * Academic Linearizability layout prototype.
 * LP is represented as a semantic marker, not as ordinary annotation text.
 */
export function renderLinearizabilityAcademicSvg(model: LinearizabilityAcademicModel): string {
  const operations = model.operations.map((operation, index) => {
    const y = 80 + index * 70;
    const x = 120 + operation.start * 30;
    const width = Math.max(40, (operation.end - operation.start) * 30);
    const marker = operation.linearizationPoint === undefined
      ? ""
      : `<circle class="linearization-point" cx="${x + operation.linearizationPoint * 30}" cy="${y}" r="6" />`;

    return `
      <g class="operation">
        <text x="20" y="${y + 5}">${escapeText(operation.label)}</text>
        <line x1="${x}" y1="${y}" x2="${x + width}" y2="${y}" />
        ${marker}
      </g>`;
  }).join("\n");

  const witness = model.witness.join(" → ");

  return `<svg role="img" aria-label="Linearizability history">
    <title>Linearizability history</title>
    <desc>Operations with explicit linearization points and sequential witness.</desc>
    ${operations}
    <text x="20" y="260">Witness: ${escapeText(witness)}</text>
  </svg>`;
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
