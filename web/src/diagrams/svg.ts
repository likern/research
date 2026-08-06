import type {
  AuthoringSvgOptions,
  DiagramDash,
  DiagramLayer,
  DiagramScene,
  DiagramTone,
  SceneElement,
  SceneGroup,
} from './types.js';
import { diagramLayerOrder } from './layout/profiles.js';

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
  const defs = tones.map(tone => marker(prefix, tone, false)).join('');
  const content = scene.elements.map(element => renderElement(element, prefix, false)).join('');
  return [
    `<svg class="pinega-diagram-svg pinega-diagram-svg-${escapeAttribute(scene.kind)}"`,
    ` viewBox="0 0 ${number(scene.width)} ${number(scene.height)}"`,
    ` width="${number(scene.width)}" height="${number(scene.height)}"`,
    ` role="img" aria-labelledby="${prefix}-title ${prefix}-desc"`,
    ` data-diagram-id="${escapeAttribute(scene.id)}" data-diagram-kind="${escapeAttribute(scene.kind)}"`,
    ` data-layout-profile="${escapeAttribute(scene.layoutProfile)}"`,
    ` style="--pinega-diagram-min-inline-size:${number(scene.minInlineSize)}px"`,
    ' preserveAspectRatio="xMidYMid meet" focusable="false">',
    `<title id="${prefix}-title">${escapeText(scene.title)}</title>`,
    `<desc id="${prefix}-desc">${escapeText(scene.description)}</desc>`,
    `<defs>${defs}</defs>`,
    `<g aria-hidden="true">${content}</g>`,
    '</svg>',
  ].join('');
}

export function renderSceneAuthoringSvg(scene: DiagramScene, options: AuthoringSvgOptions = {}): string {
  const prefix = sanitizeId(scene.id);
  const declaration = options.includeXmlDeclaration === false ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n';
  const systemVersion = options.systemVersion ?? 'development';
  const defs = tones.map(tone => marker(prefix, tone, true)).join('');
  const layers = diagramLayerOrder.map(layer => renderAuthoringLayer(scene, layer, prefix)).join('');
  return [
    declaration,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"`,
    ` xmlns:pinega="https://pinega.dev/ns/diagram/1"`,
    ` id="${prefix}-authoring" class="pinega-diagram-svg pinega-diagram-svg-${escapeAttribute(scene.kind)}"`,
    ` viewBox="0 0 ${number(scene.width)} ${number(scene.height)}"`,
    ` width="${number(scene.width)}" height="${number(scene.height)}"`,
    ` role="img" aria-labelledby="${prefix}-title ${prefix}-desc"`,
    ` data-diagram-id="${escapeAttribute(scene.id)}" data-diagram-kind="${escapeAttribute(scene.kind)}"`,
    ` data-layout-profile="${escapeAttribute(scene.layoutProfile)}" data-authoring-format="pinega-svg-v1"`,
    ' preserveAspectRatio="xMidYMid meet">',
    `<title id="${prefix}-title">${escapeText(scene.title)}</title>`,
    `<desc id="${prefix}-desc">${escapeText(scene.description)}</desc>`,
    `<metadata><pinega:diagram id="${escapeAttribute(scene.id)}" kind="${escapeAttribute(scene.kind)}"`,
    ` layout-profile="${escapeAttribute(scene.layoutProfile)}" system-version="${escapeAttribute(systemVersion)}"`,
    ' canonical="false" semantic-source="design/diagrams/models"/></metadata>',
    `<defs>${defs}<style>${authoringStyles()}</style></defs>`,
    layers,
    '</svg>',
  ].join('');
}

function renderAuthoringLayer(scene: DiagramScene, layer: DiagramLayer, prefix: string): string {
  const elements = scene.elements.filter(element => (element.layer ?? 'objects') === layer);
  const background = layer === 'background'
    ? `<rect id="${prefix}-canvas-background" data-diagram-role="canvas-background" x="0" y="0" width="${number(scene.width)}" height="${number(scene.height)}" fill="#fbf7ef" stroke="none"/>`
    : '';
  const content = elements.map(element => renderElement(element, prefix, true)).join('');
  return `<g id="${prefix}-layer-${layer}" inkscape:groupmode="layer" inkscape:label="${layerLabel(layer)}" data-diagram-layer="${layer}">${background}${content}</g>`;
}

function renderElement(element: SceneElement, prefix: string, authoring: boolean): string {
  const extraClass = element.className ? ` ${escapeAttribute(element.className)}` : '';
  const semantic = semanticAttributes(element, prefix);
  if (element.kind === 'group') return renderGroup(element, prefix, extraClass, authoring);
  if (element.kind === 'line') {
    return `<line class="pinega-diagram-edge tone-${element.tone}${extraClass}"${semantic}${authoringPaint(element.tone, null, authoring)} x1="${number(element.x1)}" y1="${number(element.y1)}" x2="${number(element.x2)}" y2="${number(element.y2)}"${strokeAttributes(element.width, element.dash, element.arrowEnd, prefix, element.tone)}/>`;
  }
  if (element.kind === 'path') {
    const fill = element.fillTone ? ` tone-fill-${element.fillTone}` : ' pinega-diagram-no-fill';
    return `<path class="pinega-diagram-edge${fill} tone-${element.tone}${extraClass}"${semantic}${authoringPaint(element.tone, element.fillTone ?? null, authoring)} d="${escapeAttribute(element.d)}"${strokeAttributes(element.width, element.dash, element.arrowEnd, prefix, element.tone)}/>`;
  }
  if (element.kind === 'rect') {
    const fill = element.fillTone ? ` tone-fill-${element.fillTone}` : ' pinega-diagram-no-fill';
    return `<rect class="pinega-diagram-shape${fill} tone-${element.tone}${extraClass}"${semantic}${authoringPaint(element.tone, element.fillTone ?? null, authoring)} x="${number(element.x)}" y="${number(element.y)}" width="${number(element.width)}" height="${number(element.height)}" rx="${number(element.radius ?? 0)}"${strokeAttributes(element.strokeWidth, element.dash, false, prefix, element.tone)}/>`;
  }
  if (element.kind === 'circle') {
    const fill = element.fillTone ? ` tone-fill-${element.fillTone}` : ' pinega-diagram-no-fill';
    return `<circle class="pinega-diagram-shape${fill} tone-${element.tone}${extraClass}"${semantic}${authoringPaint(element.tone, element.fillTone ?? null, authoring)} cx="${number(element.cx)}" cy="${number(element.cy)}" r="${number(element.radius)}"${strokeAttributes(element.strokeWidth, element.dash ?? 'solid', false, prefix, element.tone)}/>`;
  }
  const tone = element.tone ? ` tone-${element.tone}` : '';
  const preserve = authoring ? ' xml:space="preserve"' : '';
  return `<text class="pinega-diagram-text pinega-diagram-text-${element.role}${tone}${extraClass}"${semantic}${authoring ? ` fill="${toneColor(element.tone ?? 'neutral')}"` : ''} x="${number(element.x)}" y="${number(element.y)}" text-anchor="${element.anchor ?? 'start'}" dominant-baseline="middle"${preserve}>${escapeText(element.text)}</text>`;
}

function renderGroup(element: SceneGroup, prefix: string, extraClass: string, authoring: boolean): string {
  const role = element.role ? ` data-diagram-role="${escapeAttribute(element.role)}"` : '';
  const title = element.label ? `<title>${escapeText(element.label)}</title>` : '';
  const semantic = semanticAttributes(element, prefix);
  return `<g class="pinega-diagram-group${extraClass}"${semantic}${role}>${title}${element.children.map(child => renderElement(child, prefix, authoring)).join('')}</g>`;
}

function semanticAttributes(element: SceneElement, prefix: string): string {
  if (!element.semanticId) return '';
  const semanticId = sanitizeFragment(element.semanticId);
  return ` id="${prefix}-${semanticId}" data-semantic-id="${escapeAttribute(element.semanticId)}"`;
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

function marker(prefix: string, tone: DiagramTone, authoring: boolean): string {
  const paint = authoring ? ` fill="${toneColor(tone)}"` : '';
  return `<marker id="${prefix}-arrow-${tone}" class="tone-${tone}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="pinega-diagram-arrowhead"${paint} d="M 0 0 L 10 5 L 0 10 z"/></marker>`;
}

function authoringPaint(tone: DiagramTone, fillTone: DiagramTone | null, authoring: boolean): string {
  if (!authoring) return '';
  const fill = fillTone === null ? 'none' : toneFill(fillTone);
  return ` stroke="${toneColor(tone)}" fill="${fill}"`;
}

function toneColor(tone: DiagramTone): string {
  const colors: Readonly<Record<DiagramTone, string>> = {
    primary: '#365e72', event: '#b45c3f', inferred: '#687b59', warning: '#a77824',
    danger: '#963c36', pending: '#756b84', muted: '#67625b', neutral: '#272827',
  };
  return colors[tone];
}

function toneFill(tone: DiagramTone): string {
  const fills: Readonly<Record<DiagramTone, string>> = {
    primary: '#e4eaeb', event: '#f3e5df', inferred: '#e8ece3', warning: '#f2ead8',
    danger: '#f1dfdc', pending: '#e9e5ed', muted: '#efe8dc', neutral: '#fbf7ef',
  };
  return fills[tone];
}

function authoringStyles(): string {
  return `
    .pinega-diagram-edge,.pinega-diagram-shape{stroke:var(--tone);stroke-linecap:round;stroke-linejoin:round}
    .pinega-diagram-edge{fill:none}.pinega-diagram-shape{fill:var(--fill)}.pinega-diagram-no-fill{fill:none}
    .pinega-diagram-arrowhead{fill:var(--tone);stroke:none}
    .pinega-diagram-text{fill:var(--tone,#272827);font-family:"DejaVu Sans",sans-serif;font-size:14px}
    .pinega-diagram-text-title{font-size:22px;font-weight:700;letter-spacing:-.02em}
    .pinega-diagram-text-label{font-size:15px;font-weight:700}
    .pinega-diagram-text-body{font-size:12px}.pinega-diagram-text-code{font-family:"DejaVu Sans Mono",monospace;font-size:12px;font-weight:500}
    .pinega-diagram-text-meta{font-size:11px}.pinega-diagram-text-chip{font-family:"DejaVu Sans Mono",monospace;font-size:10px;font-weight:700;letter-spacing:.06em}
    .tone-primary{--tone:#365e72;--fill:#e4eaeb}.tone-event{--tone:#b45c3f;--fill:#f3e5df}
    .tone-inferred{--tone:#687b59;--fill:#e8ece3}.tone-warning{--tone:#a77824;--fill:#f2ead8}
    .tone-danger{--tone:#963c36;--fill:#f1dfdc}.tone-pending{--tone:#756b84;--fill:#e9e5ed}
    .tone-muted{--tone:#67625b;--fill:#efe8dc}.tone-neutral{--tone:#272827;--fill:#fbf7ef}
    .tone-fill-primary{fill:#e4eaeb}.tone-fill-event{fill:#f3e5df}.tone-fill-inferred{fill:#e8ece3}
    .tone-fill-warning{fill:#f2ead8}.tone-fill-danger{fill:#f1dfdc}.tone-fill-pending{fill:#e9e5ed}
    .tone-fill-muted{fill:#efe8dc}.tone-fill-neutral{fill:#fbf7ef}
    .pinega-diagram-academic-title{font-size:20px;letter-spacing:-.015em}
    .pinega-diagram-subject,.pinega-diagram-axis-label,.pinega-diagram-relation-label,.pinega-diagram-boundary-label{font-family:"DejaVu Sans Mono",monospace}
    .pinega-diagram-version-node{fill:#fbf7ef;stroke-linejoin:miter}.pinega-diagram-version-node.state-visible{fill:#edf0e9}
    .pinega-diagram-version-id{font-family:"DejaVu Sans Mono",monospace;font-size:16px}.pinega-diagram-version-state{font-size:9px;letter-spacing:.085em}
    .pinega-diagram-version-payload{font-size:13px;font-weight:700}.pinega-diagram-version-metadata,.pinega-diagram-version-note,.pinega-diagram-evaluation-note{font-size:10px}
    .pinega-diagram-version-note{font-style:italic}.pinega-diagram-node-divider,.pinega-diagram-evaluation-rule,.pinega-diagram-record-divider{stroke:#c9bead}
    .pinega-diagram-evaluation-title{font-size:13px}.pinega-diagram-evaluation-result{font-size:9px;letter-spacing:.05em}
    .pinega-diagram-time-axis,.pinega-diagram-lane-line{stroke:#c9bead}.pinega-diagram-lane-label{font-family:"DejaVu Sans Mono",monospace;font-size:13px}
    .pinega-diagram-operation-label{font-size:12px;font-weight:700}.pinega-diagram-operation-note{font-family:"Libertinus Serif",serif;font-size:10px;font-style:italic}
    .pinega-diagram-lp-label{font-family:"DejaVu Sans Mono",monospace;font-size:12px;font-weight:700;letter-spacing:.08em}
    .pinega-diagram-real-time-precedence{stroke-linecap:square;stroke-linejoin:miter}.pinega-diagram-precedence-label{font-size:10px;font-weight:700}
    .pinega-diagram-proof-panel{fill:#f2ece2;stroke:#c9bead;stroke-linejoin:miter}.pinega-diagram-witness-title{font-size:13px}
    .pinega-diagram-witness-number{font-size:10px}.pinega-diagram-witness-operation{font-size:12px;font-weight:700}.pinega-diagram-witness-reason,.pinega-diagram-legend{font-size:10px}
  `.replace(/\s+/gu, ' ').trim();
}

function layerLabel(layer: DiagramLayer): string {
  return layer.slice(0, 1).toUpperCase() + layer.slice(1);
}

function sanitizeId(value: string): string {
  return `pinega-diagram-${sanitizeFragment(value)}`;
}

function sanitizeFragment(value: string): string {
  return value.replace(/[^a-z0-9-]+/giu, '-').replace(/^-+|-+$/gu, '').toLocaleLowerCase();
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
