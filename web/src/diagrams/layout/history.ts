import type {
  DiagramScene,
  HistoryDiagram,
  HistoryOperation,
  SceneElement,
} from '../types.js';
import { group, round } from '../scene.js';

const width = 980;
const left = 126;
const right = 42;
const laneGap = 98;
const axisY = 76;
const top = 154;

export function layoutHistory(model: HistoryDiagram): DiagramScene {
  const lanesHeight = Math.max(1, model.lanes.length - 1) * laneGap;
  const witnessHeight = model.witnesses.length > 0 ? model.witnesses.length * 112 : 24;
  const height = top + lanesHeight + witnessHeight + 96;
  const plotWidth = width - left - right;
  const start = Math.min(0, ...model.operations.map(operation => operation.start), ...model.markers.map(marker => marker.time));
  const duration = model.horizon - start;
  const xOf = (time: number) => round(left + ((time - start) / duration) * plotWidth);
  const laneY = new Map(model.lanes.map((lane, index) => [lane.id, top + index * laneGap]));
  const elements: SceneElement[] = [
    { kind: 'text', x: left, y: 31, text: model.title, role: 'title', anchor: 'start', tone: 'primary', className: 'pinega-diagram-academic-title' },
    { kind: 'line', x1: left, y1: axisY, x2: width - right, y2: axisY, tone: 'muted', width: 1, arrowEnd: true, className: 'pinega-diagram-time-axis' },
    { kind: 'text', x: left, y: axisY - 14, text: String(start), role: 'meta', anchor: 'middle', tone: 'muted', className: 'pinega-diagram-axis-label' },
    { kind: 'text', x: width - right, y: axisY - 14, text: `t = ${model.horizon}`, role: 'meta', anchor: 'end', tone: 'muted', className: 'pinega-diagram-axis-label' },
  ];

  for (const lane of model.lanes) {
    const y = laneY.get(lane.id);
    if (y === undefined) continue;
    elements.push(
      { kind: 'text', x: 22, y, text: lane.label, role: 'label', anchor: 'start', tone: 'primary', className: 'pinega-diagram-lane-label' },
      { kind: 'line', x1: left, y1: y, x2: width - right, y2: y, tone: 'muted', width: 0.85, className: 'pinega-diagram-lane-line' },
    );
  }

  for (const marker of model.markers) {
    const x = xOf(marker.time);
    elements.push(group(
      `Marker ${marker.label} at time ${marker.time}`,
      'boundary',
      [
        { kind: 'line', x1: x, y1: axisY + 14, x2: x, y2: top + lanesHeight + 34, tone: marker.tone, width: 1.1, dash: marker.pattern, className: 'pinega-diagram-boundary' },
        { kind: 'text', x, y: axisY + 8, text: marker.label, role: 'meta', anchor: 'middle', tone: marker.tone, className: 'pinega-diagram-boundary-label' },
      ],
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
    const routeX = targetX - 38 + index * 16;
    const approachY = targetY - 30 - index * 10;
    const targetOffset = 8 + index * 7;
    const label = edge.label ?? 'response < invocation';

    elements.push(group(
      `${edge.from} precedes ${edge.to}: ${label}`,
      'real-time-precedence',
      [
        {
          kind: 'path',
          d: `M ${sourceX + 7} ${sourceY} H ${routeX} V ${approachY} L ${targetX - targetOffset} ${targetY}`,
          tone: edge.tone,
          width: 1.35,
          arrowEnd: true,
          className: 'pinega-diagram-real-time-precedence',
        },
        {
          kind: 'text',
          x: round((sourceX + routeX) / 2),
          y: sourceY - 13,
          text: label,
          role: 'meta',
          anchor: 'middle',
          tone: edge.tone,
          className: 'pinega-diagram-precedence-label',
        },
      ],
    ));
  }

  for (const operation of model.operations) {
    const y = laneY.get(operation.lane);
    if (y === undefined) continue;
    elements.push(layoutOperation(operation, model.horizon, xOf, y));
  }

  let witnessY = top + lanesHeight + 54;
  for (const witness of model.witnesses) {
    const panelHeight = 96;
    const panelWidth = width - left - right;
    const children: SceneElement[] = [
      { kind: 'rect', x: left, y: witnessY, width: panelWidth, height: panelHeight, radius: 4, tone: 'muted', fillTone: 'muted', strokeWidth: 1, className: 'pinega-diagram-proof-panel' },
      { kind: 'text', x: left + 16, y: witnessY + 21, text: witness.label, role: 'label', anchor: 'start', tone: witness.tone, className: 'pinega-diagram-witness-title' },
    ];
    let x = left + 24;
    const sequenceY = witnessY + 54;
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
    children.push({ kind: 'text', x: left + 16, y: witnessY + 79, text: 'Preserves process order and every real-time precedence constraint.', role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-witness-reason' });
    elements.push(group(`${witness.label}: ${witness.operations.join(', ')}`, 'sequential-witness', children, 'pinega-diagram-witness-group'));
    witnessY += panelHeight + 16;
  }

  elements.push({ kind: 'text', x: left, y: height - 22, text: '● invocation   ○ response   ● LP   ⇢ pending', role: 'meta', anchor: 'start', tone: 'muted', className: 'pinega-diagram-legend' });

  return { id: model.id, kind: model.kind, title: model.title, description: model.description, width, height, minInlineSize: 780, elements };
}

function layoutOperation(operation: HistoryOperation, horizon: number, xOf: (time: number) => number, y: number) {
  const pending = operation.end == null;
  const x1 = xOf(operation.start);
  const x2 = xOf(operation.end ?? horizon);
  const midpoint = x1 + (x2 - x1) / 2;
  const children: SceneElement[] = [
    { kind: 'line', x1, y1: y, x2, y2: y, tone: operation.tone, width: pending ? 4.5 : 7, dash: pending ? 'dashed' : 'solid', arrowEnd: pending, className: `pinega-diagram-operation-interval ${pending ? 'is-pending' : 'is-complete'}` },
    { kind: 'circle', cx: x1, cy: y, radius: 5, tone: operation.tone, fillTone: operation.tone, strokeWidth: 0, className: 'pinega-diagram-operation-endpoint is-invocation' },
    pending
      ? { kind: 'text', x: x2 - 4, y: y - 22, text: 'PENDING', role: 'chip', anchor: 'end', tone: 'pending', className: 'pinega-diagram-operation-pending' }
      : { kind: 'circle', cx: x2, cy: y, radius: 5, tone: operation.tone, fillTone: null, strokeWidth: 1.5, className: 'pinega-diagram-operation-endpoint is-response' },
    { kind: 'text', x: midpoint, y: y - 21, text: operationLabel(operation), role: 'code', anchor: 'middle', tone: 'neutral', className: 'pinega-diagram-operation-label' },
  ];

  if (operation.linearization != null) {
    if (typeof operation.linearization === 'number') {
      const x = xOf(operation.linearization);
      children.push(
        { kind: 'circle', cx: x, cy: y, radius: 10, tone: 'event', fillTone: null, strokeWidth: 1.2, className: 'pinega-diagram-lp-halo' },
        { kind: 'circle', cx: x, cy: y, radius: 6, tone: 'event', fillTone: 'event', strokeWidth: 0, className: 'pinega-diagram-lp-marker' },
        { kind: 'line', x1: x, y1: y - 12, x2: x, y2: y - 34, tone: 'event', width: 1.4, className: 'pinega-diagram-lp-leader' },
        { kind: 'text', x, y: y - 45, text: 'LP', role: 'label', anchor: 'middle', tone: 'event', className: 'pinega-diagram-lp-label' },
      );
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
  return group(`${operation.lane}: invocation ${operation.call} at ${operation.start}; ${endDescription}${linearizationDescription}`, 'operation', children, `pinega-diagram-operation-group ${pending ? 'is-pending' : 'is-complete'}`);
}

function operationLabel(operation: HistoryOperation): string {
  return operation.result == null ? operation.call : `${operation.call} → ${operation.result}`;
}
