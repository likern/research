import type {
  DiagramScene,
  HistoryDiagram,
  HistoryOperation,
  SceneElement,
} from '../types.js';
import { group, round } from '../scene.js';

const width = 980;
const left = 132;
const right = 42;
const laneGap = 92;
const operationHeight = 40;

export function layoutHistory(model: HistoryDiagram): DiagramScene {
  const precedenceHeight = model.precedence.length * 24;
  const top = 92 + precedenceHeight;
  const lanesHeight = Math.max(1, model.lanes.length - 1) * laneGap;
  const witnessHeight = model.witnesses.length > 0 ? 82 : 30;
  const height = top + lanesHeight + witnessHeight + 74;
  const plotWidth = width - left - right;
  const start = Math.min(0, ...model.operations.map(operation => operation.start), ...model.markers.map(marker => marker.time));
  const duration = model.horizon - start;
  const xOf = (time: number) => round(left + ((time - start) / duration) * plotWidth);
  const laneY = new Map(model.lanes.map((lane, index) => [lane.id, top + index * laneGap]));
  const elements: SceneElement[] = [
    { kind: 'text', x: left, y: 34, text: model.title, role: 'title', anchor: 'start', tone: 'primary' },
  ];

  for (const lane of model.lanes) {
    const y = laneY.get(lane.id);
    if (y === undefined) continue;
    elements.push(
      { kind: 'text', x: 22, y, text: lane.label, role: 'label', anchor: 'start', tone: 'primary' },
      { kind: 'line', x1: left, y1: y, x2: width - right, y2: y, tone: 'muted', width: 1, arrowEnd: true },
    );
  }

  for (const [index, edge] of model.precedence.entries()) {
    const from = model.operations.find(operation => operation.id === edge.from);
    const to = model.operations.find(operation => operation.id === edge.to);
    if (!from || !to) continue;
    const sourceTime = from.end ?? from.start;
    const y = 66 + index * 24;
    const sourceX = xOf(sourceTime);
    const targetX = xOf(to.start);
    elements.push(group(
      `${edge.from} precedes ${edge.to}${edge.label ? `: ${edge.label}` : ''}`,
      'precedence',
      [
        {
          kind: 'path',
          d: `M ${sourceX} ${top - 28} V ${y} H ${targetX} V ${top - 12}`,
          tone: edge.tone,
          width: 1.2,
          arrowEnd: true,
        },
        ...(edge.label
          ? [{ kind: 'text', x: round((sourceX + targetX) / 2), y: y - 7, text: edge.label, role: 'meta', anchor: 'middle', tone: edge.tone } as const]
          : []),
      ],
    ));
  }

  for (const marker of model.markers) {
    const x = xOf(marker.time);
    elements.push(group(
      `Marker ${marker.label} at time ${marker.time}`,
      'marker',
      [
        { kind: 'line', x1: x, y1: top - 18, x2: x, y2: top + lanesHeight + 30, tone: marker.tone, width: 1.2, dash: marker.pattern },
        { kind: 'text', x, y: top - 32, text: marker.label, role: 'meta', anchor: 'middle', tone: marker.tone },
      ],
    ));
  }

  for (const operation of model.operations) {
    const y = laneY.get(operation.lane);
    if (y === undefined) continue;
    elements.push(layoutOperation(operation, model.horizon, xOf, y));
  }

  const witnessY = top + lanesHeight + 60;
  for (const [index, witness] of model.witnesses.entries()) {
    const y = witnessY + index * 34;
    elements.push({ kind: 'text', x: left, y, text: witness.label, role: 'meta', anchor: 'start', tone: witness.tone });
    let x = left + 132;
    for (const [operationIndex, operationId] of witness.operations.entries()) {
      const operation = model.operations.find(candidate => candidate.id === operationId);
      const label = operation ? operationLabel(operation) : operationId;
      const chipWidth = Math.max(84, label.length * 7 + 22);
      elements.push(
        {
          kind: 'rect',
          x,
          y: y - 17,
          width: chipWidth,
          height: 30,
          radius: 8,
          tone: operation?.tone ?? witness.tone,
          fillTone: operation?.tone ?? witness.tone,
          strokeWidth: 1,
        },
        { kind: 'text', x: x + chipWidth / 2, y: y - 1, text: label, role: 'code', anchor: 'middle', tone: 'neutral' },
      );
      x += chipWidth;
      if (operationIndex < witness.operations.length - 1) {
        elements.push({ kind: 'line', x1: x + 5, y1: y - 2, x2: x + 31, y2: y - 2, tone: witness.tone, width: 1.2, arrowEnd: true });
        x += 42;
      }
    }
  }

  elements.push({
    kind: 'text',
    x: left,
    y: height - 22,
    text: '● invocation   ○ response   │ linearization   ⇢ pending',
    role: 'meta',
    anchor: 'start',
    tone: 'muted',
  });

  return {
    id: model.id,
    kind: model.kind,
    title: model.title,
    description: model.description,
    width,
    height,
    minInlineSize: 760,
    elements,
  };
}

function layoutOperation(
  operation: HistoryOperation,
  horizon: number,
  xOf: (time: number) => number,
  y: number,
) {
  const pending = operation.end == null;
  const x1 = xOf(operation.start);
  const x2 = xOf(operation.end ?? horizon);
  const rectWidth = Math.max(54, x2 - x1);
  const label = operationLabel(operation);
  const children: SceneElement[] = [
    {
      kind: 'rect',
      x: x1,
      y: y - operationHeight / 2,
      width: rectWidth,
      height: operationHeight,
      radius: 10,
      tone: operation.tone,
      fillTone: pending ? null : operation.tone,
      dash: pending ? 'dashed' : 'solid',
      strokeWidth: operation.tone === 'danger' ? 2 : 1.4,
    },
    { kind: 'circle', cx: x1, cy: y, radius: 5, tone: operation.tone, fillTone: operation.tone, strokeWidth: 0 },
    pending
      ? { kind: 'line', x1: x2 - 18, y1: y, x2: x2 + 6, y2: y, tone: operation.tone, width: 1.4, dash: 'dashed', arrowEnd: true }
      : { kind: 'circle', cx: x2, cy: y, radius: 5, tone: operation.tone, fillTone: null, strokeWidth: 1.4 },
    { kind: 'text', x: x1 + rectWidth / 2, y: y + 1, text: label, role: 'code', anchor: 'middle', tone: 'neutral' },
  ];

  if (operation.linearization != null) {
    if (typeof operation.linearization === 'number') {
      const x = xOf(operation.linearization);
      children.push(
        { kind: 'line', x1: x, y1: y - 29, x2: x, y2: y + 29, tone: 'event', width: 2 },
        { kind: 'text', x, y: y - 38, text: 'LP', role: 'chip', anchor: 'middle', tone: 'event' },
      );
    } else {
      const start = xOf(operation.linearization[0]);
      const end = xOf(operation.linearization[1]);
      children.push(
        { kind: 'rect', x: start, y: y - 28, width: Math.max(4, end - start), height: 56, radius: 7, tone: 'event', fillTone: null, dash: 'dotted', strokeWidth: 1.6 },
        { kind: 'text', x: (start + end) / 2, y: y - 38, text: 'LP?', role: 'chip', anchor: 'middle', tone: 'event' },
      );
    }
  }

  if (operation.note) {
    children.push({ kind: 'text', x: x1 + rectWidth / 2, y: y + 34, text: operation.note, role: 'meta', anchor: 'middle', tone: 'muted' });
  }
  if (pending) children.push({ kind: 'text', x: x2 - 4, y: y - 32, text: 'PENDING', role: 'chip', anchor: 'end', tone: 'pending' });

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
  );
}

function operationLabel(operation: HistoryOperation): string {
  return operation.result == null ? operation.call : `${operation.call} → ${operation.result}`;
}
