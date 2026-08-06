import type { DiagramScene, SceneElement, VersionChainDiagram } from '../types.js';
import { group, toneForVersionState, wrapText } from '../scene.js';

const nodeWidth = 178;
const nodeHeight = 154;
const gap = 74;
const left = 88;
const top = 102;

export function layoutVersionChain(model: VersionChainDiagram): DiagramScene {
  const width = left * 2 + model.versions.length * nodeWidth + Math.max(0, model.versions.length - 1) * gap;
  const height = 410;
  const elements: SceneElement[] = [
    { kind: 'text', x: left, y: 34, text: model.title, role: 'title', anchor: 'start', tone: 'primary' },
    { kind: 'text', x: left, y: 62, text: model.subject, role: 'meta', anchor: 'start', tone: 'muted' },
  ];
  const positions = new Map<string, { x: number; y: number }>();

  for (const [index, version] of model.versions.entries()) {
    const x = left + index * (nodeWidth + gap);
    positions.set(version.id, { x, y: top });
    const tone = toneForVersionState(version.state);
    const metadata = [
      `xmin  ${version.createdBy}`,
      `xmax  ${version.deletedBy ?? '—'}`,
      `gen   ${version.generation}`,
    ];
    const children: SceneElement[] = [
      { kind: 'rect', x, y: top, width: nodeWidth, height: nodeHeight, radius: 12, tone, fillTone: tone, strokeWidth: version.id === model.snapshot.visibleVersion ? 2.4 : 1.4 },
      { kind: 'text', x: x + 16, y: top + 24, text: version.label, role: 'label', anchor: 'start', tone },
      { kind: 'text', x: x + nodeWidth - 16, y: top + 24, text: version.state.toUpperCase(), role: 'chip', anchor: 'end', tone },
      { kind: 'text', x: x + 16, y: top + 54, text: version.payload, role: 'code', anchor: 'start', tone: 'neutral' },
      ...metadata.map((text, metaIndex): SceneElement => ({
        kind: 'text',
        x: x + 16,
        y: top + 84 + metaIndex * 20,
        text,
        role: 'meta',
        anchor: 'start',
        tone: 'muted',
      })),
    ];
    if (version.note) {
      children.push({ kind: 'text', x: x + nodeWidth / 2, y: top + nodeHeight + 22, text: version.note, role: 'meta', anchor: 'middle', tone });
    }
    elements.push(group(
      `${version.label}: ${version.payload}; created by ${version.createdBy}; deleted by ${version.deletedBy ?? 'none'}; generation ${version.generation}; state ${version.state}${version.note ? `; ${version.note}` : ''}`,
      'version',
      children,
    ));

    if (index < model.versions.length - 1) {
      const arrowStart = x + nodeWidth + 10;
      const arrowEnd = x + nodeWidth + gap - 10;
      elements.push(group(
        `${version.id} links to older version ${model.versions[index + 1]?.id ?? ''}`,
        'version-link',
        [
          { kind: 'line', x1: arrowStart, y1: top + nodeHeight / 2, x2: arrowEnd, y2: top + nodeHeight / 2, tone: 'primary', width: 1.6, arrowEnd: true },
          { kind: 'text', x: (arrowStart + arrowEnd) / 2, y: top + nodeHeight / 2 - 17, text: 'older', role: 'meta', anchor: 'middle', tone: 'muted' },
        ],
      ));
    }
  }

  const head = positions.get(model.head);
  if (head) {
    elements.push(group(
      `${model.headLabel} points to ${model.head}`,
      'head-pointer',
      [
        { kind: 'text', x: head.x + nodeWidth / 2, y: top - 48, text: model.headLabel, role: 'chip', anchor: 'middle', tone: 'primary' },
        { kind: 'line', x1: head.x + nodeWidth / 2, y1: top - 34, x2: head.x + nodeWidth / 2, y2: top - 6, tone: 'primary', width: 1.8, arrowEnd: true },
      ],
    ));
  }

  const visible = positions.get(model.snapshot.visibleVersion);
  if (visible) {
    const snapshotX = Math.max(left, visible.x + nodeWidth / 2 - 110);
    const snapshotY = top + nodeHeight + 78;
    const noteLines = wrapText(model.snapshot.note, 33, 2);
    elements.push(group(
      `${model.snapshot.label} selects ${model.snapshot.visibleVersion}: ${model.snapshot.note}`,
      'snapshot',
      [
        { kind: 'rect', x: snapshotX, y: snapshotY, width: 220, height: 78, radius: 11, tone: 'inferred', fillTone: 'inferred', strokeWidth: 1.6 },
        { kind: 'text', x: snapshotX + 16, y: snapshotY + 23, text: model.snapshot.label, role: 'label', anchor: 'start', tone: 'inferred' },
        ...noteLines.map((line, index): SceneElement => ({
          kind: 'text',
          x: snapshotX + 16,
          y: snapshotY + 47 + index * 17,
          text: line,
          role: 'meta',
          anchor: 'start',
          tone: 'muted',
        })),
        {
          kind: 'path',
          d: `M ${snapshotX + 110} ${snapshotY} V ${top + nodeHeight + 45} H ${visible.x + nodeWidth / 2} V ${top + nodeHeight + 6}`,
          tone: 'inferred',
          width: 1.8,
          arrowEnd: true,
        },
      ],
    ));
  }

  return {
    id: model.id,
    kind: model.kind,
    title: model.title,
    description: model.description,
    width,
    height,
    minInlineSize: Math.min(width, 820),
    elements,
  };
}
