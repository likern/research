import type { DiagramScene, SceneElement, VersionChainDiagram } from '../types.js';
import { group, toneForVersionState, wrapText } from '../scene.js';
import type { VersionChainLayoutProfile } from './profiles.js';

export function layoutVersionChain(model: VersionChainDiagram, profile: VersionChainLayoutProfile): DiagramScene {
  return profile.strategy === 'records'
    ? layoutRecordStrip(model, profile)
    : layoutCards(model, profile);
}

function layoutCards(model: VersionChainDiagram, profile: VersionChainLayoutProfile): DiagramScene {
  const metrics = profile.web;
  const width = metrics.left * 2 + model.versions.length * metrics.nodeWidth + Math.max(0, model.versions.length - 1) * metrics.gap;
  const evaluationY = metrics.top + metrics.nodeHeight + metrics.evaluationGap;
  const height = evaluationY + metrics.evaluationHeight;
  const elements: SceneElement[] = [
    { kind: 'text', x: metrics.left, y: 32, text: model.title, role: 'title', anchor: 'start', tone: 'primary', className: 'pinega-diagram-academic-title', semanticId: 'diagram-title', layer: 'annotations' },
    { kind: 'text', x: metrics.left, y: 58, text: model.subject, role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-subject', semanticId: 'diagram-subject', layer: 'annotations' },
  ];
  const positions = new Map<string, { x: number; y: number }>();

  for (const [index, version] of model.versions.entries()) {
    const x = metrics.left + index * (metrics.nodeWidth + metrics.gap);
    positions.set(version.id, { x, y: metrics.top });
    const tone = toneForVersionState(version.state);
    const selected = version.id === model.snapshot.visibleVersion;
    const transactionText = `xmin ${version.createdBy}  ·  xmax ${version.deletedBy ?? '—'}`;
    const generationText = `generation ${version.generation}`;
    const children: SceneElement[] = [
      {
        kind: 'rect', x, y: metrics.top, width: metrics.nodeWidth, height: metrics.nodeHeight, radius: metrics.radius,
        tone, fillTone: selected ? tone : null, strokeWidth: selected ? 2.2 : 1.25,
        dash: version.state === 'retired' ? 'dashed' : 'solid', className: `pinega-diagram-version-node state-${version.state}`,
      },
      { kind: 'line', x1: x + 12, y1: metrics.top + 38, x2: x + metrics.nodeWidth - 12, y2: metrics.top + 38, tone: 'muted', width: 0.8, className: 'pinega-diagram-node-divider' },
      { kind: 'text', x: x + 14, y: metrics.top + 22, text: version.label, role: 'label', anchor: 'start', tone: 'primary', className: 'pinega-diagram-version-id' },
      { kind: 'text', x: x + metrics.nodeWidth - 14, y: metrics.top + 22, text: version.state.toUpperCase(), role: 'chip', anchor: 'end', tone, className: `pinega-diagram-version-state state-${version.state}` },
      { kind: 'text', x: x + 14, y: metrics.top + 59, text: version.payload, role: 'code', anchor: 'start', tone: 'neutral', className: 'pinega-diagram-version-payload' },
      { kind: 'text', x: x + 14, y: metrics.top + 84, text: transactionText, role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-version-metadata' },
      { kind: 'text', x: x + 14, y: metrics.top + 103, text: generationText, role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-version-metadata' },
    ];

    if (version.note) children.push({ kind: 'text', x: x + metrics.nodeWidth / 2, y: metrics.top + metrics.nodeHeight + 22, text: version.note, role: 'meta', anchor: 'middle', tone, className: 'pinega-diagram-version-note' });

    elements.push(group(
      `${version.label}: ${version.payload}; created by ${version.createdBy}; deleted by ${version.deletedBy ?? 'none'}; generation ${version.generation}; state ${version.state}${version.note ? `; ${version.note}` : ''}`,
      'version', children,
      { className: `pinega-diagram-version-group state-${version.state}`, semanticId: `version-${version.id}`, layer: 'objects' },
    ));

    if (index < model.versions.length - 1) {
      const older = model.versions[index + 1];
      const arrowStart = x + metrics.nodeWidth + 12;
      const arrowEnd = x + metrics.nodeWidth + metrics.gap - 12;
      elements.push(group(
        `${version.id} links to older version ${older?.id ?? ''}`,
        'temporal-relation',
        [
          { kind: 'line', x1: arrowStart, y1: metrics.top + metrics.nodeHeight / 2, x2: arrowEnd, y2: metrics.top + metrics.nodeHeight / 2, tone: 'primary', width: 1.4, arrowEnd: true, className: 'pinega-diagram-relation-temporal' },
          { kind: 'text', x: (arrowStart + arrowEnd) / 2, y: metrics.top + metrics.nodeHeight / 2 - 15, text: 'older', role: 'meta', anchor: 'middle', tone: 'muted', className: 'pinega-diagram-relation-label' },
        ],
        { semanticId: `temporal-${version.id}-${older?.id ?? 'none'}`, layer: 'relations' },
      ));
    }
  }

  addHeadReference(model, elements, positions, metrics.nodeWidth, metrics.top);
  addVisibilityEvaluation(model, elements, positions, width, metrics.left, metrics.nodeWidth, evaluationY);

  return {
    id: model.id, kind: model.kind, title: model.title, description: model.description,
    layoutProfile: profile.id, width, height, minInlineSize: Math.min(width, metrics.minInlineSizeCap), elements,
  };
}

function layoutRecordStrip(model: VersionChainDiagram, profile: VersionChainLayoutProfile): DiagramScene {
  const metrics = profile.web;
  const versionsLeft = metrics.left + metrics.headSlotWidth + metrics.headGap;
  const width = metrics.left * 2 + metrics.headSlotWidth + metrics.headGap
    + model.versions.length * metrics.nodeWidth + Math.max(0, model.versions.length - 1) * metrics.gap;
  const evaluationY = metrics.top + metrics.nodeHeight + metrics.evaluationGap;
  const height = evaluationY + metrics.evaluationHeight;
  const elements: SceneElement[] = [
    { kind: 'text', x: metrics.left, y: 32, text: model.title, role: 'title', anchor: 'start', tone: 'primary', className: 'pinega-diagram-academic-title', semanticId: 'diagram-title', layer: 'annotations' },
    { kind: 'text', x: metrics.left, y: 58, text: model.subject, role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-subject', semanticId: 'diagram-subject', layer: 'annotations' },
  ];
  const positions = new Map<string, { x: number; y: number }>();
  const headY = metrics.top + 19;

  elements.push(group(
    `${model.headLabel} references ${model.head}`,
    'head-reference',
    [
      { kind: 'rect', x: metrics.left, y: headY, width: metrics.headSlotWidth, height: 56, radius: 2, tone: 'primary', fillTone: null, strokeWidth: 1.4, className: 'pinega-diagram-head-slot' },
      { kind: 'text', x: metrics.left + 12, y: headY + 20, text: model.headLabel, role: 'meta', anchor: 'start', tone: 'primary', className: 'pinega-diagram-head-label' },
      { kind: 'text', x: metrics.left + 12, y: headY + 40, text: model.head, role: 'code', anchor: 'start', tone: 'neutral', className: 'pinega-diagram-head-target' },
      { kind: 'line', x1: metrics.left + metrics.headSlotWidth + 8, y1: headY + 28, x2: versionsLeft - 10, y2: headY + 28, tone: 'primary', width: 1.5, arrowEnd: true, className: 'pinega-diagram-relation-reference' },
    ],
    { semanticId: `head-${model.head}`, layer: 'relations' },
  ));

  for (const [index, version] of model.versions.entries()) {
    const x = versionsLeft + index * (metrics.nodeWidth + metrics.gap);
    positions.set(version.id, { x, y: metrics.top });
    const tone = toneForVersionState(version.state);
    const selected = version.id === model.snapshot.visibleVersion;
    const children: SceneElement[] = [
      { kind: 'rect', x, y: metrics.top, width: metrics.nodeWidth, height: metrics.nodeHeight, radius: metrics.radius, tone, fillTone: selected ? tone : null, strokeWidth: selected ? 2.1 : 1.15, dash: version.state === 'retired' ? 'dashed' : 'solid', className: `pinega-diagram-version-node pinega-diagram-version-record state-${version.state}` },
      { kind: 'line', x1: x + 48, y1: metrics.top + 8, x2: x + 48, y2: metrics.top + metrics.nodeHeight - 8, tone: 'muted', width: 0.75, className: 'pinega-diagram-record-divider' },
      { kind: 'text', x: x + 14, y: metrics.top + 22, text: version.label, role: 'label', anchor: 'start', tone: 'primary', className: 'pinega-diagram-version-id' },
      { kind: 'text', x: x + 14, y: metrics.top + 47, text: `g${version.generation}`, role: 'chip', anchor: 'start', tone, className: 'pinega-diagram-version-generation' },
      { kind: 'text', x: x + 62, y: metrics.top + 20, text: version.payload, role: 'code', anchor: 'start', tone: 'neutral', className: 'pinega-diagram-version-payload' },
      { kind: 'text', x: x + 62, y: metrics.top + 44, text: `xmin ${version.createdBy}`, role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-version-metadata' },
      { kind: 'text', x: x + 62, y: metrics.top + 64, text: `xmax ${version.deletedBy ?? '—'}`, role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-version-metadata' },
      { kind: 'text', x: x + metrics.nodeWidth - 12, y: metrics.top + 82, text: version.state.toUpperCase(), role: 'chip', anchor: 'end', tone, className: `pinega-diagram-version-state state-${version.state}` },
    ];
    elements.push(group(
      `${version.label}: ${version.payload}; created by ${version.createdBy}; deleted by ${version.deletedBy ?? 'none'}; generation ${version.generation}; state ${version.state}`,
      'version', children,
      { className: `pinega-diagram-version-group state-${version.state}`, semanticId: `version-${version.id}`, layer: 'objects' },
    ));

    if (index < model.versions.length - 1) {
      const older = model.versions[index + 1];
      const y = metrics.top + metrics.nodeHeight / 2;
      elements.push(group(
        `${version.id} links to older version ${older?.id ?? ''}`,
        'temporal-relation',
        [
          { kind: 'line', x1: x + metrics.nodeWidth + 8, y1: y, x2: x + metrics.nodeWidth + metrics.gap - 8, y2: y, tone: 'primary', width: 1.35, arrowEnd: true, className: 'pinega-diagram-relation-temporal' },
          { kind: 'text', x: x + metrics.nodeWidth + metrics.gap / 2, y: y - 14, text: 'older', role: 'meta', anchor: 'middle', tone: 'muted', className: 'pinega-diagram-relation-label' },
        ],
        { semanticId: `temporal-${version.id}-${older?.id ?? 'none'}`, layer: 'relations' },
      ));
    }
  }

  addVisibilityEvaluation(model, elements, positions, width, metrics.left, metrics.nodeWidth, evaluationY);
  return {
    id: model.id, kind: model.kind, title: model.title, description: model.description,
    layoutProfile: profile.id, width, height, minInlineSize: Math.min(width, metrics.minInlineSizeCap), elements,
  };
}

function addHeadReference(
  model: VersionChainDiagram,
  elements: SceneElement[],
  positions: ReadonlyMap<string, { x: number; y: number }>,
  nodeWidth: number,
  top: number,
): void {
  const head = positions.get(model.head);
  if (!head) return;
  const x = head.x + nodeWidth / 2;
  elements.push(group(
    `${model.headLabel} references ${model.head}`,
    'head-reference',
    [
      { kind: 'text', x, y: top - 26, text: model.headLabel, role: 'meta', anchor: 'middle', tone: 'primary', className: 'pinega-diagram-head-label' },
      { kind: 'line', x1: x, y1: top - 18, x2: x, y2: top - 8, tone: 'primary', width: 1.55, arrowEnd: true, className: 'pinega-diagram-relation-reference' },
    ],
    { semanticId: `head-${model.head}`, layer: 'relations' },
  ));
}

function addVisibilityEvaluation(
  model: VersionChainDiagram,
  elements: SceneElement[],
  positions: ReadonlyMap<string, { x: number; y: number }>,
  width: number,
  left: number,
  nodeWidth: number,
  evaluationY: number,
): void {
  elements.push(group(
    `${model.snapshot.label} evaluates version visibility and selects ${model.snapshot.visibleVersion}`,
    'visibility-evaluation',
    [
      { kind: 'text', x: left, y: evaluationY, text: `${model.snapshot.label} · visibility evaluation`, role: 'label', anchor: 'start', tone: 'inferred', className: 'pinega-diagram-evaluation-title' },
      { kind: 'line', x1: left, y1: evaluationY + 20, x2: width - left, y2: evaluationY + 20, tone: 'muted', width: 0.9, className: 'pinega-diagram-evaluation-rule' },
    ],
    { semanticId: `evaluation-${model.snapshot.id}`, layer: 'background' },
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
        { kind: 'circle', cx: x, cy: evaluationY + 20, radius: selected ? 5.5 : 4, tone: selected ? 'inferred' : 'muted', fillTone: selected ? 'inferred' : null, strokeWidth: 1.2, className: `pinega-diagram-evaluation-marker ${selected ? 'is-selected' : 'is-rejected'}` },
        { kind: 'text', x, y: evaluationY + 46, text: selected ? '✓ selected' : 'not selected', role: 'chip', anchor: 'middle', tone: selected ? 'inferred' : 'muted', className: `pinega-diagram-evaluation-result ${selected ? 'is-selected' : 'is-rejected'}` },
      ],
      { semanticId: `visibility-${model.snapshot.id}-${version.id}`, layer: 'annotations' },
    ));
  }

  const selectedPosition = positions.get(model.snapshot.visibleVersion);
  if (!selectedPosition) return;
  const noteLines = wrapText(model.snapshot.note, 42, 2);
  noteLines.forEach((line, index) => {
    elements.push({
      kind: 'text', x: selectedPosition.x + nodeWidth / 2, y: evaluationY + 70 + index * 17, text: line,
      role: 'meta', anchor: 'middle', tone: 'muted', className: 'pinega-diagram-evaluation-note',
      semanticId: `evaluation-note-${index}`, layer: 'annotations',
    });
  });
}
