import type { DiagramScene, SceneElement, VersionChainDiagram } from '../types.js';
import { group, toneForVersionState, wrapText } from '../scene.js';

const nodeWidth = 190;
const nodeHeight = 118;
const gap = 92;
const left = 72;
const top = 104;

export function layoutVersionChain(model: VersionChainDiagram): DiagramScene {
  const width = left * 2 + model.versions.length * nodeWidth + Math.max(0, model.versions.length - 1) * gap;
  const evaluationY = top + nodeHeight + 72;
  const height = evaluationY + 102;
  const elements: SceneElement[] = [
    { kind: 'text', x: left, y: 32, text: model.title, role: 'title', anchor: 'start', tone: 'primary', className: 'pinega-diagram-academic-title' },
    { kind: 'text', x: left, y: 60, text: model.subject, role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-subject' },
  ];
  const positions = new Map<string, { x: number; y: number }>();

  for (const [index, version] of model.versions.entries()) {
    const x = left + index * (nodeWidth + gap);
    positions.set(version.id, { x, y: top });
    const tone = toneForVersionState(version.state);
    const selected = version.id === model.snapshot.visibleVersion;
    const transactionText = `xmin ${version.createdBy}  ·  xmax ${version.deletedBy ?? '—'}`;
    const generationText = `generation ${version.generation}`;
    const children: SceneElement[] = [
      {
        kind: 'rect',
        x,
        y: top,
        width: nodeWidth,
        height: nodeHeight,
        radius: 4,
        tone,
        fillTone: selected ? tone : null,
        strokeWidth: selected ? 2.2 : 1.25,
        dash: version.state === 'retired' ? 'dashed' : 'solid',
        className: `pinega-diagram-version-node state-${version.state}`,
      },
      {
        kind: 'line',
        x1: x + 12,
        y1: top + 38,
        x2: x + nodeWidth - 12,
        y2: top + 38,
        tone: 'muted',
        width: 0.8,
        className: 'pinega-diagram-node-divider',
      },
      {
        kind: 'text',
        x: x + 14,
        y: top + 22,
        text: version.label,
        role: 'label',
        anchor: 'start',
        tone: 'primary',
        className: 'pinega-diagram-version-id',
      },
      {
        kind: 'text',
        x: x + nodeWidth - 14,
        y: top + 22,
        text: version.state.toUpperCase(),
        role: 'chip',
        anchor: 'end',
        tone,
        className: `pinega-diagram-version-state state-${version.state}`,
      },
      {
        kind: 'text',
        x: x + 14,
        y: top + 59,
        text: version.payload,
        role: 'code',
        anchor: 'start',
        tone: 'neutral',
        className: 'pinega-diagram-version-payload',
      },
      {
        kind: 'text',
        x: x + 14,
        y: top + 84,
        text: transactionText,
        role: 'meta',
        anchor: 'start',
        tone: 'muted',
        className: 'pinega-diagram-version-metadata',
      },
      {
        kind: 'text',
        x: x + 14,
        y: top + 103,
        text: generationText,
        role: 'meta',
        anchor: 'start',
        tone: 'muted',
        className: 'pinega-diagram-version-metadata',
      },
    ];

    if (version.note) {
      children.push({
        kind: 'text',
        x: x + nodeWidth / 2,
        y: top + nodeHeight + 22,
        text: version.note,
        role: 'meta',
        anchor: 'middle',
        tone,
        className: 'pinega-diagram-version-note',
      });
    }

    elements.push(group(
      `${version.label}: ${version.payload}; created by ${version.createdBy}; deleted by ${version.deletedBy ?? 'none'}; generation ${version.generation}; state ${version.state}${version.note ? `; ${version.note}` : ''}`,
      'version',
      children,
      `pinega-diagram-version-group state-${version.state}`,
    ));

    if (index < model.versions.length - 1) {
      const arrowStart = x + nodeWidth + 12;
      const arrowEnd = x + nodeWidth + gap - 12;
      elements.push(group(
        `${version.id} links to older version ${model.versions[index + 1]?.id ?? ''}`,
        'temporal-relation',
        [
          {
            kind: 'line',
            x1: arrowStart,
            y1: top + nodeHeight / 2,
            x2: arrowEnd,
            y2: top + nodeHeight / 2,
            tone: 'primary',
            width: 1.4,
            arrowEnd: true,
            className: 'pinega-diagram-relation-temporal',
          },
          {
            kind: 'text',
            x: (arrowStart + arrowEnd) / 2,
            y: top + nodeHeight / 2 - 15,
            text: 'older',
            role: 'meta',
            anchor: 'middle',
            tone: 'muted',
            className: 'pinega-diagram-relation-label',
          },
        ],
      ));
    }
  }

  const head = positions.get(model.head);
  if (head) {
    const x = head.x + nodeWidth / 2;
    elements.push(group(
      `${model.headLabel} references ${model.head}`,
      'head-reference',
      [
        {
          kind: 'text',
          x,
          y: top - 48,
          text: model.headLabel,
          role: 'meta',
          anchor: 'middle',
          tone: 'primary',
          className: 'pinega-diagram-head-label',
        },
        {
          kind: 'line',
          x1: x,
          y1: top - 36,
          x2: x,
          y2: top - 8,
          tone: 'primary',
          width: 1.55,
          arrowEnd: true,
          className: 'pinega-diagram-relation-reference',
        },
      ],
    ));
  }

  elements.push(group(
    `${model.snapshot.label} evaluates version visibility and selects ${model.snapshot.visibleVersion}`,
    'visibility-evaluation',
    [
      {
        kind: 'text',
        x: left,
        y: evaluationY,
        text: `${model.snapshot.label} · visibility evaluation`,
        role: 'label',
        anchor: 'start',
        tone: 'inferred',
        className: 'pinega-diagram-evaluation-title',
      },
      {
        kind: 'line',
        x1: left,
        y1: evaluationY + 20,
        x2: width - left,
        y2: evaluationY + 20,
        tone: 'muted',
        width: 0.9,
        className: 'pinega-diagram-evaluation-rule',
      },
    ],
  ));

  for (const version of model.versions) {
    const position = positions.get(version.id);
    if (!position) continue;
    const selected = version.id === model.snapshot.visibleVersion;
    const x = position.x + nodeWidth / 2;
    elements.push(group(
      `${version.id} is ${selected ? 'selected' : 'not selected'} by ${model.snapshot.label}`,
      'visibility-result',
      [
        {
          kind: 'circle',
          cx: x,
          cy: evaluationY + 20,
          radius: selected ? 5.5 : 4,
          tone: selected ? 'inferred' : 'muted',
          fillTone: selected ? 'inferred' : null,
          strokeWidth: 1.2,
          className: `pinega-diagram-evaluation-marker ${selected ? 'is-selected' : 'is-rejected'}`,
        },
        {
          kind: 'text',
          x,
          y: evaluationY + 46,
          text: selected ? '✓ selected' : 'not selected',
          role: 'chip',
          anchor: 'middle',
          tone: selected ? 'inferred' : 'muted',
          className: `pinega-diagram-evaluation-result ${selected ? 'is-selected' : 'is-rejected'}`,
        },
      ],
    ));
  }

  const selectedPosition = positions.get(model.snapshot.visibleVersion);
  if (selectedPosition) {
    const noteLines = wrapText(model.snapshot.note, 42, 2);
    noteLines.forEach((line, index) => {
      elements.push({
        kind: 'text',
        x: selectedPosition.x + nodeWidth / 2,
        y: evaluationY + 70 + index * 17,
        text: line,
        role: 'meta',
        anchor: 'middle',
        tone: 'muted',
        className: 'pinega-diagram-evaluation-note',
      });
    });
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
