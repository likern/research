import type {
  DiagramDash,
  DiagramScene,
  DiagramTone,
  SceneElement,
  SceneGroup,
} from './types.js';

const tones: readonly DiagramTone[] = [
  'primary',
  'event',
  'inferred',
  'warning',
  'danger',
  'pending',
  'muted',
  'neutral',
];

export function renderSceneSvg(scene: DiagramScene): string {
  const prefix = sanitizeId(scene.id);
  const defs = tones.map(tone => marker(prefix, tone)).join('');
  const content = scene.elements.map(element => renderElement(element, prefix)).join('');
  return [
    `<svg class="pinega-diagram-svg pinega-diagram-svg-${escapeAttribute(scene.kind)}"`,
    ` viewBox="0 0 ${number(scene.width)} ${number(scene.height)}"`,
    ` width="${number(scene.width)}" height="${number(scene.height)}"`,
    ` role="img" aria-labelledby="${prefix}-title ${prefix}-desc"`,
    ` data-diagram-id="${escapeAttribute(scene.id)}" data-diagram-kind="${escapeAttribute(scene.kind)}"`,
    ` style="--pinega-diagram-min-inline-size:${number(scene.minInlineSize)}px"`,
    ' preserveAspectRatio="xMidYMid meet" focusable="false">',
    `<title id="${prefix}-title">${escapeText(scene.title)}</title>`,
    `<desc id="${prefix}-desc">${escapeText(scene.description)}</desc>`,
    `<defs>${defs}</defs>`,
    `<g aria-hidden="true">${content}</g>`,
    '</svg>',
  ].join('');
}

function renderElement(element: SceneElement, prefix: string): string {
  const extraClass = element.className ? ` ${escapeAttribute(element.className)}` : '';
  if (element.kind === 'group') return renderGroup(element, prefix, extraClass);
  if (element.kind === 'line') {
    return `<line class="pinega-diagram-edge tone-${element.tone}${extraClass}" x1="${number(element.x1)}" y1="${number(element.y1)}" x2="${number(element.x2)}" y2="${number(element.y2)}"${strokeAttributes(element.width, element.dash, element.arrowEnd, prefix, element.tone)}/>`;
  }
  if (element.kind === 'path') {
    const fill = element.fillTone ? ` tone-fill-${element.fillTone}` : ' pinega-diagram-no-fill';
    return `<path class="pinega-diagram-edge${fill} tone-${element.tone}${extraClass}" d="${escapeAttribute(element.d)}"${strokeAttributes(element.width, element.dash, element.arrowEnd, prefix, element.tone)}/>`;
  }
  if (element.kind === 'rect') {
    const fill = element.fillTone ? ` tone-fill-${element.fillTone}` : ' pinega-diagram-no-fill';
    return `<rect class="pinega-diagram-shape${fill} tone-${element.tone}${extraClass}" x="${number(element.x)}" y="${number(element.y)}" width="${number(element.width)}" height="${number(element.height)}" rx="${number(element.radius ?? 0)}"${strokeAttributes(element.strokeWidth, element.dash, false, prefix, element.tone)}/>`;
  }
  if (element.kind === 'circle') {
    const fill = element.fillTone ? ` tone-fill-${element.fillTone}` : ' pinega-diagram-no-fill';
    return `<circle class="pinega-diagram-shape${fill} tone-${element.tone}${extraClass}" cx="${number(element.cx)}" cy="${number(element.cy)}" r="${number(element.radius)}"${strokeAttributes(element.strokeWidth, 'solid', false, prefix, element.tone)}/>`;
  }
  const tone = element.tone ? ` tone-${element.tone}` : '';
  return `<text class="pinega-diagram-text pinega-diagram-text-${element.role}${tone}${extraClass}" x="${number(element.x)}" y="${number(element.y)}" text-anchor="${element.anchor ?? 'start'}" dominant-baseline="middle">${escapeText(element.text)}</text>`;
}

function renderGroup(element: SceneGroup, prefix: string, extraClass: string): string {
  const role = element.role ? ` data-diagram-role="${escapeAttribute(element.role)}"` : '';
  const title = element.label ? `<title>${escapeText(element.label)}</title>` : '';
  return `<g class="pinega-diagram-group${extraClass}"${role}>${title}${element.children.map(child => renderElement(child, prefix)).join('')}</g>`;
}

function strokeAttributes(
  width: number | undefined,
  dash: DiagramDash | undefined,
  arrowEnd: boolean | undefined,
  prefix: string,
  tone: DiagramTone,
): string {
  const attributes = [' vector-effect="non-scaling-stroke"'];
  if (width !== undefined) attributes.push(` stroke-width="${number(width)}"`);
  if (dash && dash !== 'solid') attributes.push(` stroke-dasharray="${dash === 'dashed' ? '8 6' : '2 5'}"`);
  if (arrowEnd) attributes.push(` marker-end="url(#${prefix}-arrow-${tone})"`);
  return attributes.join('');
}

function marker(prefix: string, tone: DiagramTone): string {
  return `<marker id="${prefix}-arrow-${tone}" class="tone-${tone}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="pinega-diagram-arrowhead" d="M 0 0 L 10 5 L 0 10 z"/></marker>`;
}

function sanitizeId(value: string): string {
  return `pinega-diagram-${value.replace(/[^a-z0-9-]+/giu, '-').replace(/^-+|-+$/gu, '').toLocaleLowerCase()}`;
}

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/u, '').replace(/\.$/u, '');
}

export function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function escapeAttribute(value: string): string {
  return escapeText(value)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
