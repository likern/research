export type VersionNode = {
  id: string;
  state: "visible" | "obsolete" | "retired";
  payload?: string;
  xmin?: string;
  xmax?: string;
};

export type MvccAcademicModel = {
  rowHead: string;
  versions: VersionNode[];
};

/**
 * Academic MVCC layout prototype.
 *
 * This renderer intentionally owns only presentation decisions. The input
 * model contains semantic entities and does not contain coordinates.
 */
export function renderMvccAcademicSvg(model: MvccAcademicModel): string {
  const nodes = model.versions.map((version, index) => {
    const y = 90 + index * 130;
    return `
      <g class="version version-${version.state}">
        <rect x="180" y="${y}" width="240" height="90" rx="8" />
        <text x="200" y="${y + 28}">${escapeText(version.id)} ${escapeText(version.state)}</text>
        <text x="200" y="${y + 52}">${escapeText(version.payload ?? "")}</text>
        <text x="200" y="${y + 74}">${escapeText(version.xmin ?? "")} ${escapeText(version.xmax ?? "")}</text>
      </g>`;
  }).join("\n");

  return `<svg role="img" aria-label="MVCC version chain" viewBox="0 0 640 560">
    <title>MVCC version chain</title>
    <desc>Row head references versions ordered from newest to oldest.</desc>
    <text x="180" y="40">${escapeText(model.rowHead)}</text>
    <line x1="300" y1="55" x2="300" y2="90" />
    ${nodes}
  </svg>`;
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
