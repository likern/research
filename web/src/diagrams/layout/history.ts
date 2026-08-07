import type {
  DiagramScene,
  HistoryDiagram,
  HistoryOperation,
  SceneElement,
} from '../types.js';
import { group, round } from '../scene.js';
import type { HistoryLayoutProfile } from './profiles.js';

export function layoutHistory(model: HistoryDiagram, profile: HistoryLayoutProfile): DiagramScene {
  const metrics = profile.web;
  const lanesHeight = Math.max(1, model.lanes.length - 1) * metrics.laneGap;
  const witnessHeight = model.witnesses.length > 0 ? model.witnesses.length * metrics.witnessStride : 24;
  const height = metrics.top + lanesHeight + witnessHeight + metrics.bottomPadding;
  const plotWidth = metrics.width - metrics.left - metrics.right;
  const start = Math.min(0, ...model.operations.map(operation => operation.start), ...model.markers.map(marker => marker.time));
  const duration = model.horizon - start;
  const xOf = (time: number) => round(metrics.left + ((time - start) / duration) * plotWidth);
  const laneY = new Map(model.lanes.map((lane, index) => [lane.id, metrics.top + index * metrics.laneGap]));
  const elements: SceneElement[] = [
    {
      kind: 'text', x: metrics.left, y: 31, text: model.title, role: 'title', anchor: 'start', tone: 'primary',
      className: 'pinega-diagram-academic-title', semanticId: 'diagram-title', layer: 'annotations',
    },
    {
      kind: 'line', x1: metrics.left, y1: metrics.axisY, x2: metrics.width - metrics.right, y2: metrics.axisY,
      tone: 'muted', width: 1, arrowEnd: true, className: 'pinega-diagram-time-axis', semanticId: 'time-axis', layer: 'background',
    },
    {
      kind: 'text', x: metrics.left, y: metrics.axisY - 14, text: String(start), role: 'meta', anchor: 'middle', tone: 'muted',
      className: 'pinega-diagram-axis-label', semanticId: 'time-axis-start', layer: 'annotations',
    },
    {
      kind: 'text', x: metrics.width - metrics.right, y: metrics.axisY - 14, text: `t = ${model.horizon}`,
      role: 'meta', anchor: 'end', tone: 'muted', className: 'pinega-diagram-axis-label', semanticId: 'time-axis-end', layer: 'annotations',
    },
  ];

  for (const lane of model.lanes) {
    const y = laneY.get(lane.id);
    if (y === undefined) continue;
    elements.push(group(
      `${lane.label} process lane`,
      'process-lane',
      [
        { kind: 'text', x: 22, y, text: lane.label, role: 'label', anchor: 'start', tone: 'primary', className: 'pinega-diagram-lane-label' },
        { kind: 'line', x1: metrics.left, y1: y, x2: metrics.width - metrics.right, y2: y, tone: 'muted', width: 0.85, className: 'pinega-diagram-lane-line' },
      ],
      { semanticId: `lane-${lane.id}`, layer: 'background' },
    ));
  }

  for (const [markerIndex, marker] of model.markers.entries()) {
    const x = xOf(marker.time);
    elements.push(group(
      `Marker ${marker.label} at time ${marker.time}`,
      'boundary',
      [
        { kind: 'line', x1: x, y1: metrics.axisY + 14, x2: x, y2: metrics.top + lanesHeight + 34, tone: marker.tone, width: 1.1, dash: marker.pattern, className: 'pinega-diagram-boundary' },
        { kind: 'text', x, y: metrics.axisY + 8, text: marker.label, role: 'meta', anchor: 'middle', tone: marker.tone, className: 'pinega-diagram-boundary-label' },
      ],
      { semanticId: `marker-${markerIndex}`, layer: 'annotations' },
    ));
  }

  for (const [index, edge] of model.precedence.entries()) {
    const from = model.operations.find(operation => operation.id === edge.from);
    const to = model.operations.find(operation => operation.id === edge.to);
    const sourceY = from ? laneY.get(from.lane) : undefined;
    const targetY = to ? laneY.get(to.lane) : undefined;
    if (!from || !to || sourceY === undefined || targetY === undefined) continue;

    const sourceX = xOf(from.end ?? from.start);
    const targetX = xOf(to.start);
    const accessibleLabel = edge.label ?? 'response before invocation';
    const children: SceneElement[] = [];

    if (profile.strategy === 'proof-timeline') {
      const routeY = metrics.top - metrics.precedenceBaseOffset - index * metrics.precedenceStep;
      children.push({
        kind: 'path',
        d: `M ${sourceX + 7} ${sourceY} V ${routeY} H ${targetX - 8 - index * 4} V ${targetY}`,
        tone: edge.tone,
        width: 1.25,
        arrowEnd: true,
        className: 'pinega-diagram-real-time-precedence',
      });
      if (edge.label) {
        children.push({
          kind: 'text', x: round((sourceX + targetX) / 2), y: routeY - 11, text: edge.label,
          role: 'meta', anchor: 'middle', tone: edge.tone, className: 'pinega-diagram-precedence-label',
        });
      }
    } else {
      const routeX = targetX - metrics.precedenceBaseOffset + index * metrics.precedenceStep;
      const approachY = targetY - 30 - index * 10;
      const targetOffset = 2 + index * 5;
      children.push({
        kind: 'path',
        d: `M ${sourceX + 7} ${sourceY} H ${routeX} V ${approachY} L ${targetX - targetOffset} ${targetY}`,
        tone: edge.tone,
        width: 1.35,
        arrowEnd: true,
        className: 'pinega-diagram-real-time-precedence',
      });
      if (edge.label) {
        children.push({
          kind: 'text', x: round((sourceX + routeX) / 2), y: sourceY - 13, text: edge.label,
          role: 'meta', anchor: 'middle', tone: edge.tone, className: 'pinega-diagram-precedence-label',
        });
      }
    }

    elements.push(group(
      `${edge.from} precedes ${edge.to}: ${accessibleLabel}`,
      'real-time-precedence',
      children,
      { semanticId: `precedence-${edge.from}-${edge.to}`, layer: 'relations' },
    ));
  }

  for (const operation of model.operations) {
    const y = laneY.get(operation.lane);
    if (y === undefined) continue;
    elements.push(layoutOperation(operation, model.horizon, xOf, y, profile));
  }

  let witnessY = metrics.top + lanesHeight + metrics.witnessTopGap;
  for (const [witnessIndex, witness] of model.witnesses.entries()) {
    const panelWidth = metrics.width - metrics.left - metrics.right;
    const children: SceneElement[] = [];
    if (metrics.witnessStyle === 'panel') {
      children.push(
        { kind: 'rect', x: metrics.left, y: witnessY, width: panelWidth, height: metrics.witnessPanelHeight, radius: 4, tone: 'muted', fillTone: 'muted', strokeWidth: 1, className: 'pinega-diagram-proof-panel' },
        { kind: 'text', x: metrics.left + 16, y: witnessY + 21, text: witness.label, role: 'label', anchor: 'start', tone: witness.tone, className: 'pinega-diagram-witness-title' },
      );
    } else {
      children.push(
        { kind: 'line', x1: metrics.left, y1: witnessY, x2: metrics.width - metrics.right, y2: witnessY, tone: 'muted', width: 0.9, className: 'pinega-diagram-proof-rule' },
        { kind: 'text', x: metrics.left, y: witnessY + 22, text: witness.label, role: 'label', anchor: 'start', tone: witness.tone, className: 'pinega-diagram-witness-title' },
      );
    }

    let x = metrics.left + (metrics.witnessStyle === 'panel' ? 24 : 8);
    const sequenceY = witnessY + (metrics.witnessStyle === 'panel' ? 54 : 50);
    for (const [operationIndex, operationId] of witness.operations.entries()) {
      const operation = model.operations.find(candidate => candidate.id === operationId);
      const label = operation ? operationLabel(operation) : operationId;
      const itemWidth = Math.max(126, label.length * 7 + 42);
      children.push(
        { kind: 'text', x, y: sequenceY, text: `${operationIndex + 1}`, role: 'chip', anchor: 'start', tone: operation?.tone ?? witness.tone, className: 'pinega-diagram-witness-number' },
        { kind: 'text', x: x + 24, y: sequenceY, text: label, role: 'code', anchor: 'start', tone: 'neutral', className: 'pinega-diagram-witness-operation' },
      );
      x += itemWidth;
      if (operationIndex < witness.operations.length - 1) {
        children.push({ kind: 'line', x1: x - 4, y1: sequenceY, x2: x + 24, y2: sequenceY, tone: witness.tone, width: 1.1, arrowEnd: true, className: 'pinega-diagram-witness-arrow' });
        x += 40;
      }
    }
    children.push({
      kind: 'text', x: metrics.left + (metrics.witnessStyle === 'panel' ? 16 : 0),
      y: witnessY + (metrics.witnessStyle === 'panel' ? 79 : 72),
      text: 'Preserves process order and every real-time precedence constraint.',
      role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-witness-reason',
    });
    elements.push(group(
      `${witness.label}: ${witness.operations.join(', ')}`,
      'sequential-witness',
      children,
      { className: 'pinega-diagram-witness-group', semanticId: `witness-${witnessIndex}`, layer: 'proof' },
    ));
    witnessY += metrics.witnessStride;
  }

  elements.push({
    kind: 'text', x: metrics.left, y: height - 22, text: '● invocation   ○ response   ● LP   ⇢ pending',
    role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-legend', semanticId: 'legend', layer: 'annotations',
  });

  return {
    id: model.id,
    kind: model.kind,
    title: model.title,
    description: model.description,
    layoutProfile: profile.id,
    width: metrics.width,
    height,
    minInlineSize: metrics.minInlineSize,
    elements,
  };
}

function layoutOperation(
  operation: HistoryOperation,
  horizon: number,
  xOf: (time: number) => number,
  y: number,
  profile: HistoryLayoutProfile,
) {
  const metrics = profile.web;
  const pending = operation.end == null;
  const x1 = xOf(operation.start);
  const x2 = xOf(operation.end ?? horizon);
  const midpoint = x1 + (x2 - x1) / 2;
  const children: SceneElement[] = [
    { kind: 'line', x1, y1: y, x2, y2: y, tone: operation.tone, width: pending ? metrics.operationPendingWidth : metrics.operationCompleteWidth, dash: pending ? 'dashed' : 'solid', arrowEnd: pending, className: `pinega-diagram-operation-interval ${pending ? 'is-pending' : 'is-complete'}` },
    { kind: 'circle', cx: x1, cy: y, radius: 5, tone: operation.tone, fillTone: operation.tone, strokeWidth: 0, className: 'pinega-diagram-operation-endpoint is-invocation' },
    pending
      ? { kind: 'text', x: x2 - 4, y: y - 22, text: 'PENDING', role: 'chip', anchor: 'end', tone: 'pending', className: 'pinega-diagram-operation-pending' }
      : { kind: 'circle', cx: x2, cy: y, radius: 5, tone: operation.tone, fillTone: null, strokeWidth: 1.5, className: 'pinega-diagram-operation-endpoint is-response' },
    { kind: 'text', x: midpoint, y: y - 21, text: operationLabel(operation), role: 'code', anchor: 'middle', tone: 'neutral', className: 'pinega-diagram-operation-label' },
  ];

  if (operation.linearization != null) {
    if (typeof operation.linearization === 'number') {
      const x = xOf(operation.linearization);
      if (metrics.linearizationStyle === 'halo') {
        children.push(
          { kind: 'circle', cx: x, cy: y, radius: 10, tone: 'event', fillTone: null, strokeWidth: 1.2, className: 'pinega-diagram-lp-halo' },
          { kind: 'circle', cx: x, cy: y, radius: 6, tone: 'event', fillTone: 'event', strokeWidth: 0, className: 'pinega-diagram-lp-marker' },
          { kind: 'line', x1: x, y1: y - 12, x2: x, y2: y - 34, tone: 'event', width: 1.4, className: 'pinega-diagram-lp-leader' },
          { kind: 'text', x, y: y - 45, text: 'LP', role: 'label', anchor: 'middle', tone: 'event', className: 'pinega-diagram-lp-label' },
        );
      } else {
        children.push(
          { kind: 'line', x1: x, y1: y - 16, x2: x, y2: y + 16, tone: 'event', width: 2.1, className: 'pinega-diagram-lp-tick' },
          { kind: 'circle', cx: x, cy: y, radius: 4.5, tone: 'event', fillTone: 'event', strokeWidth: 0, className: 'pinega-diagram-lp-marker' },
          { kind: 'text', x, y: y - 31, text: 'LP', role: 'chip', anchor: 'middle', tone: 'event', className: 'pinega-diagram-lp-label' },
        );
      }
    } else {
      const linearizationStart = xOf(operation.linearization[0]);
      const linearizationEnd = xOf(operation.linearization[1]);
      children.push(
        { kind: 'rect', x: linearizationStart, y: y - 16, width: Math.max(4, linearizationEnd - linearizationStart), height: 32, radius: 3, tone: 'event', fillTone: null, dash: 'dotted', strokeWidth: 1.5, className: 'pinega-diagram-lp-interval' },
        { kind: 'text', x: (linearizationStart + linearizationEnd) / 2, y: y - 28, text: 'LP interval', role: 'chip', anchor: 'middle', tone: 'event', className: 'pinega-diagram-lp-label' },
      );
    }
  }

  if (operation.note) children.push({ kind: 'text', x: midpoint, y: y + 24, text: operation.note, role: 'meta', anchor: 'middle', tone: 'muted', className: 'pinega-diagram-operation-note' });

  const endDescription = pending ? 'pending' : `response ${operation.result ?? 'ok'} at ${operation.end}`;
  const linearizationDescription = operation.linearization == null
    ? ''
    : typeof operation.linearization === 'number'
      ? `; linearization at ${operation.linearization}`
      : `; linearization interval ${operation.linearization[0]} to ${operation.linearization[1]}`;
  return group(
    `${operation.lane}: invocation ${operation.call} at ${operation.start}; ${endDescription}${linearizationDescription}`,
    'operation',
    children,
    {
      className: `pinega-diagram-operation-group ${pending ? 'is-pending' : 'is-complete'}`,
      semanticId: `operation-${operation.id}`,
      layer: 'objects',
    },
  );
}

function operationLabel(operation: HistoryOperation): string {
  return operation.result == null ? operation.call : `${operation.call} → ${operation.result}`;
}
