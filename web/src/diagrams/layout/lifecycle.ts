import type { DiagramScene, LifecycleDiagram, SceneElement } from '../types.js';
import { group, wrapText } from '../scene.js';

const maxColumns = 3;
const stateWidth = 180;
const stateHeight = 118;
const columnGap = 122;
const rowGap = 118;
const left = 64;
const top = 94;

interface PositionedState {
  readonly index: number;
  readonly row: number;
  readonly column: number;
  readonly x: number;
  readonly y: number;
}

export function layoutLifecycle(model: LifecycleDiagram): DiagramScene {
  const columns = Math.min(maxColumns, model.states.length);
  const rows = Math.ceil(model.states.length / columns);
  const width = left * 2 + columns * stateWidth + Math.max(0, columns - 1) * columnGap;
  const height = top + rows * stateHeight + Math.max(0, rows - 1) * rowGap + 96;
  const elements: SceneElement[] = [
    { kind: 'text', x: left, y: 34, text: model.title, role: 'title', anchor: 'start', tone: 'primary' },
    { kind: 'text', x: left, y: 62, text: model.subject, role: 'meta', anchor: 'start', tone: 'muted' },
  ];
  const positions = new Map<string, PositionedState>();

  for (const [index, state] of model.states.entries()) {
    const row = Math.floor(index / columns);
    const offset = index % columns;
    const column = row % 2 === 0 ? offset : columns - 1 - offset;
    const x = left + column * (stateWidth + columnGap);
    const y = top + row * (stateHeight + rowGap);
    positions.set(state.id, { index, row, column, x, y });

    const descriptionLines = wrapText(state.description, 24, 3);
    const children: SceneElement[] = [
      {
        kind: 'rect',
        x,
        y,
        width: stateWidth,
        height: stateHeight,
        radius: 13,
        tone: state.tone,
        fillTone: state.tone,
        strokeWidth: state.id === model.initial ? 2.5 : 1.5,
        dash: state.id === 'retired' ? 'dashed' : 'solid',
      },
      { kind: 'text', x: x + stateWidth / 2, y: y + 31, text: state.label, role: 'label', anchor: 'middle', tone: state.tone },
      ...descriptionLines.map((line, lineIndex): SceneElement => ({
        kind: 'text',
        x: x + stateWidth / 2,
        y: y + 62 + lineIndex * 17,
        text: line,
        role: 'body',
        anchor: 'middle',
        tone: 'muted',
      })),
    ];
    if (state.id === model.initial) {
      children.push({ kind: 'text', x: x + stateWidth / 2, y: y - 18, text: 'INITIAL', role: 'chip', anchor: 'middle', tone: state.tone });
    }
    elements.push(group(`${state.label}: ${state.description}`, 'state', children));
  }

  for (const transition of model.transitions) {
    const from = positions.get(transition.from);
    const to = positions.get(transition.to);
    if (!from || !to) continue;
    const sequential = to.index === from.index + 1;
    const children: SceneElement[] = [];

    if (sequential && from.row === to.row) {
      const rightward = to.x > from.x;
      const x1 = rightward ? from.x + stateWidth + 8 : from.x - 8;
      const x2 = rightward ? to.x - 8 : to.x + stateWidth + 8;
      const y = from.y + stateHeight / 2;
      children.push({ kind: 'line', x1, y1: y, x2, y2: y, tone: transition.tone, width: 1.8, arrowEnd: true });
      addHorizontalTransitionText(children, transition.label, transition.guard, (x1 + x2) / 2, y, transition.tone);
    } else if (sequential && from.column === to.column) {
      const x = from.x + stateWidth / 2;
      const y1 = from.y + stateHeight + 8;
      const y2 = to.y - 8;
      const midpoint = (y1 + y2) / 2;
      children.push({ kind: 'line', x1: x, y1, x2: x, y2, tone: transition.tone, width: 1.8, arrowEnd: true });
      children.push({ kind: 'text', x: x + 18, y: midpoint - 9, text: transition.label, role: 'meta', anchor: 'start', tone: transition.tone });
      if (transition.guard) children.push({ kind: 'text', x: x + 18, y: midpoint + 11, text: transition.guard, role: 'code', anchor: 'start', tone: 'muted' });
    } else if (to.row < from.row && to.column === from.column) {
      const routeX = Math.max(18, from.x - 38);
      const sourceY = from.y + stateHeight / 2;
      const targetY = to.y + stateHeight / 2;
      children.push(
        {
          kind: 'path',
          d: `M ${from.x - 8} ${sourceY} H ${routeX} V ${targetY} H ${to.x - 8}`,
          tone: transition.tone,
          width: 1.8,
          arrowEnd: true,
        },
        { kind: 'text', x: routeX + 10, y: (sourceY + targetY) / 2 - 10, text: transition.label, role: 'meta', anchor: 'start', tone: transition.tone },
      );
      if (transition.guard) children.push({ kind: 'text', x: routeX + 10, y: (sourceY + targetY) / 2 + 10, text: transition.guard, role: 'code', anchor: 'start', tone: 'muted' });
    } else {
      const routeY = height - 48;
      const sourceX = from.x + stateWidth / 2;
      const targetX = to.x + stateWidth / 2;
      children.push(
        {
          kind: 'path',
          d: `M ${sourceX} ${from.y + stateHeight + 8} V ${routeY} H ${targetX} V ${to.y + stateHeight + 8}`,
          tone: transition.tone,
          width: 1.8,
          arrowEnd: true,
        },
        { kind: 'text', x: (sourceX + targetX) / 2, y: routeY - 17, text: transition.label, role: 'meta', anchor: 'middle', tone: transition.tone },
      );
      if (transition.guard) children.push({ kind: 'text', x: (sourceX + targetX) / 2, y: routeY + 7, text: transition.guard, role: 'code', anchor: 'middle', tone: 'muted' });
    }

    elements.push(group(
      `${transition.label}: ${transition.from} to ${transition.to}${transition.guard ? ` when ${transition.guard}` : ''}`,
      'transition',
      children,
    ));
  }

  return {
    id: model.id,
    kind: model.kind,
    title: model.title,
    description: model.description,
    width,
    height,
    minInlineSize: width,
    elements,
  };
}

function addHorizontalTransitionText(
  elements: SceneElement[],
  label: string,
  guard: string | null,
  x: number,
  y: number,
  tone: LifecycleDiagram['transitions'][number]['tone'],
): void {
  const labelLines = wrapText(label, 16, 2);
  const guardLines = guard ? wrapText(guard, 16, 2) : [];
  labelLines.forEach((line, index) => elements.push({
    kind: 'text',
    x,
    y: y - 28 + index * 13,
    text: line,
    role: 'meta',
    anchor: 'middle',
    tone,
  }));
  guardLines.forEach((line, index) => elements.push({
    kind: 'text',
    x,
    y: y + 24 + index * 13,
    text: line,
    role: 'code',
    anchor: 'middle',
    tone: 'muted',
  }));
}
