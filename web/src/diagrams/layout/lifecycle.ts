import type { DiagramScene, LifecycleDiagram, SceneElement } from '../types.js';
import { group, wrapText } from '../scene.js';
import type { LifecycleLayoutProfile } from './profiles.js';

interface PositionedState {
  readonly index: number;
  readonly row: number;
  readonly column: number;
  readonly x: number;
  readonly y: number;
}

export function layoutLifecycle(model: LifecycleDiagram, profile: LifecycleLayoutProfile): DiagramScene {
  return profile.strategy === 'horizontal-return'
    ? layoutHorizontalReturn(model, profile)
    : layoutSnakeGrid(model, profile);
}

function layoutSnakeGrid(model: LifecycleDiagram, profile: LifecycleLayoutProfile): DiagramScene {
  const metrics = profile.web;
  const columns = Math.min(metrics.maxColumns, model.states.length);
  const rows = Math.ceil(model.states.length / columns);
  const width = metrics.left * 2 + columns * metrics.stateWidth + Math.max(0, columns - 1) * metrics.columnGap;
  const height = metrics.top + rows * metrics.stateHeight + Math.max(0, rows - 1) * metrics.rowGap + 96;
  const elements: SceneElement[] = [
    { kind: 'text', x: metrics.left, y: 34, text: model.title, role: 'title', anchor: 'start', tone: 'primary', semanticId: 'diagram-title', layer: 'annotations' },
    { kind: 'text', x: metrics.left, y: 62, text: model.subject, role: 'meta', anchor: 'start', tone: 'muted', semanticId: 'diagram-subject', layer: 'annotations' },
  ];
  const positions = new Map<string, PositionedState>();

  for (const [index, state] of model.states.entries()) {
    const row = Math.floor(index / columns);
    const offset = index % columns;
    const column = row % 2 === 0 ? offset : columns - 1 - offset;
    const x = metrics.left + column * (metrics.stateWidth + metrics.columnGap);
    const y = metrics.top + row * (metrics.stateHeight + metrics.rowGap);
    positions.set(state.id, { index, row, column, x, y });

    const descriptionLines = wrapText(state.description, 24, 3);
    const children: SceneElement[] = [
      {
        kind: 'rect', x, y, width: metrics.stateWidth, height: metrics.stateHeight, radius: 13,
        tone: state.tone, fillTone: state.tone, strokeWidth: state.id === model.initial ? 2.5 : 1.5,
        dash: state.id === 'retired' ? 'dashed' : 'solid', className: `pinega-diagram-lifecycle-state state-${state.id}`,
      },
      { kind: 'text', x: x + metrics.stateWidth / 2, y: y + 31, text: state.label, role: 'label', anchor: 'middle', tone: state.tone },
      ...descriptionLines.map((line, lineIndex): SceneElement => ({
        kind: 'text', x: x + metrics.stateWidth / 2, y: y + 62 + lineIndex * 17, text: line,
        role: 'body', anchor: 'middle', tone: 'muted',
      })),
    ];
    if (state.id === model.initial) children.push({ kind: 'text', x: x + metrics.stateWidth / 2, y: y - 18, text: 'INITIAL', role: 'chip', anchor: 'middle', tone: state.tone });
    elements.push(group(
      `${state.label}: ${state.description}`,
      'state', children,
      { semanticId: `state-${state.id}`, layer: 'objects' },
    ));
  }

  for (const transition of model.transitions) {
    const from = positions.get(transition.from);
    const to = positions.get(transition.to);
    if (!from || !to) continue;
    const sequential = to.index === from.index + 1;
    const children: SceneElement[] = [];

    if (sequential && from.row === to.row) {
      const rightward = to.x > from.x;
      const x1 = rightward ? from.x + metrics.stateWidth + 8 : from.x - 8;
      const x2 = rightward ? to.x - 8 : to.x + metrics.stateWidth + 8;
      const y = from.y + metrics.stateHeight / 2;
      children.push({ kind: 'line', x1, y1: y, x2, y2: y, tone: transition.tone, width: 1.8, arrowEnd: true });
      addHorizontalTransitionText(children, transition.label, transition.guard, (x1 + x2) / 2, y, transition.tone);
    } else if (sequential && from.column === to.column) {
      const x = from.x + metrics.stateWidth / 2;
      const y1 = from.y + metrics.stateHeight + 8;
      const y2 = to.y - 8;
      const midpoint = (y1 + y2) / 2;
      children.push({ kind: 'line', x1: x, y1, x2: x, y2, tone: transition.tone, width: 1.8, arrowEnd: true });
      children.push({ kind: 'text', x: x + 18, y: midpoint - 9, text: transition.label, role: 'meta', anchor: 'start', tone: transition.tone });
      if (transition.guard) children.push({ kind: 'text', x: x + 18, y: midpoint + 11, text: transition.guard, role: 'code', anchor: 'start', tone: 'muted' });
    } else if (to.row < from.row && to.column === from.column) {
      const routeX = Math.max(18, from.x - 38);
      const sourceY = from.y + metrics.stateHeight / 2;
      const targetY = to.y + metrics.stateHeight / 2;
      children.push(
        { kind: 'path', d: `M ${from.x - 8} ${sourceY} H ${routeX} V ${targetY} H ${to.x - 8}`, tone: transition.tone, width: 1.8, arrowEnd: true },
        { kind: 'text', x: routeX + 10, y: (sourceY + targetY) / 2 - 10, text: transition.label, role: 'meta', anchor: 'start', tone: transition.tone },
      );
      if (transition.guard) children.push({ kind: 'text', x: routeX + 10, y: (sourceY + targetY) / 2 + 10, text: transition.guard, role: 'code', anchor: 'start', tone: 'muted' });
    } else {
      const routeY = height - 48;
      const sourceX = from.x + metrics.stateWidth / 2;
      const targetX = to.x + metrics.stateWidth / 2;
      children.push(
        { kind: 'path', d: `M ${sourceX} ${from.y + metrics.stateHeight + 8} V ${routeY} H ${targetX} V ${to.y + metrics.stateHeight + 8}`, tone: transition.tone, width: 1.8, arrowEnd: true },
        { kind: 'text', x: (sourceX + targetX) / 2, y: routeY - 17, text: transition.label, role: 'meta', anchor: 'middle', tone: transition.tone },
      );
      if (transition.guard) children.push({ kind: 'text', x: (sourceX + targetX) / 2, y: routeY + 7, text: transition.guard, role: 'code', anchor: 'middle', tone: 'muted' });
    }

    elements.push(group(
      `${transition.label}: ${transition.from} to ${transition.to}${transition.guard ? ` when ${transition.guard}` : ''}`,
      'transition', children,
      { semanticId: `transition-${transition.id}`, layer: 'relations' },
    ));
  }

  return {
    id: model.id, kind: model.kind, title: model.title, description: model.description,
    layoutProfile: profile.id, width, height, minInlineSize: metrics.minInlineSize || width, elements,
  };
}

function layoutHorizontalReturn(model: LifecycleDiagram, profile: LifecycleLayoutProfile): DiagramScene {
  const metrics = profile.web;
  const stateSpacing = metrics.stateSpacing || metrics.stateWidth + metrics.columnGap;
  const width = metrics.left * 2 + Math.max(0, model.states.length - 1) * stateSpacing + metrics.stateWidth;
  const stateCenterY = metrics.top + 34;
  const returnY = metrics.top + metrics.stateHeight + metrics.returnGap;
  const height = returnY + 72;
  const elements: SceneElement[] = [
    { kind: 'text', x: metrics.left, y: 34, text: model.title, role: 'title', anchor: 'start', tone: 'primary', semanticId: 'diagram-title', layer: 'annotations' },
    { kind: 'text', x: metrics.left, y: 62, text: model.subject, role: 'meta', anchor: 'start', tone: 'muted', semanticId: 'diagram-subject', layer: 'annotations' },
    { kind: 'line', x1: metrics.left, y1: stateCenterY, x2: width - metrics.left, y2: stateCenterY, tone: 'muted', width: 0.8, semanticId: 'lifecycle-spine', layer: 'background' },
  ];
  const positions = new Map<string, { index: number; x: number; y: number }>();

  for (const [index, state] of model.states.entries()) {
    const x = metrics.left + metrics.stateWidth / 2 + index * stateSpacing;
    positions.set(state.id, { index, x, y: stateCenterY });
    const descriptionLines = wrapText(state.description, 22, 2);
    const selected = state.id === model.initial;
    const children: SceneElement[] = [
      { kind: 'circle', cx: x, cy: stateCenterY, radius: selected ? 14 : 12, tone: state.tone, fillTone: selected ? state.tone : null, strokeWidth: selected ? 2.3 : 1.6, className: `pinega-diagram-lifecycle-stop state-${state.id}` },
      { kind: 'text', x, y: stateCenterY - 31, text: state.label, role: 'label', anchor: 'middle', tone: state.tone, className: 'pinega-diagram-lifecycle-label' },
      ...descriptionLines.map((line, lineIndex): SceneElement => ({
        kind: 'text', x, y: stateCenterY + 33 + lineIndex * 16, text: line,
        role: 'body', anchor: 'middle', tone: 'muted', className: 'pinega-diagram-lifecycle-description',
      })),
    ];
    if (selected) children.push({ kind: 'text', x, y: stateCenterY - 52, text: 'INITIAL', role: 'chip', anchor: 'middle', tone: state.tone });
    if (state.id === 'retired') children.push({ kind: 'circle', cx: x, cy: stateCenterY, radius: 18, tone: state.tone, fillTone: null, dash: 'dashed', strokeWidth: 1, className: 'pinega-diagram-retired-halo' });
    elements.push(group(
      `${state.label}: ${state.description}`,
      'state', children,
      { semanticId: `state-${state.id}`, layer: 'objects' },
    ));
  }

  for (const transition of model.transitions) {
    const from = positions.get(transition.from);
    const to = positions.get(transition.to);
    if (!from || !to) continue;
    const children: SceneElement[] = [];
    const returns = to.index <= from.index;
    if (returns) {
      children.push(
        { kind: 'path', d: `M ${from.x} ${stateCenterY + 18} V ${returnY} H ${to.x} V ${stateCenterY + 18}`, tone: transition.tone, width: 1.8, arrowEnd: true, className: 'pinega-diagram-lifecycle-return' },
        { kind: 'text', x: (from.x + to.x) / 2, y: returnY - 19, text: transition.label, role: 'meta', anchor: 'middle', tone: transition.tone },
      );
      if (transition.guard) children.push({ kind: 'text', x: (from.x + to.x) / 2, y: returnY + 9, text: transition.guard, role: 'code', anchor: 'middle', tone: 'muted' });
    } else {
      const x1 = from.x + 18;
      const x2 = to.x - 18;
      const midpoint = (x1 + x2) / 2;
      const safetyBoundary = transition.id === 'quiesce';
      children.push({ kind: 'line', x1, y1: stateCenterY, x2, y2: stateCenterY, tone: transition.tone, width: safetyBoundary ? 2.6 : 1.7, arrowEnd: true, className: safetyBoundary ? 'pinega-diagram-safety-transition' : 'pinega-diagram-lifecycle-transition' });
      children.push({ kind: 'text', x: midpoint, y: stateCenterY - 28, text: transition.label, role: 'meta', anchor: 'middle', tone: transition.tone });
      if (transition.guard) children.push({ kind: 'text', x: midpoint, y: stateCenterY + 25, text: transition.guard, role: 'code', anchor: 'middle', tone: 'muted' });
    }
    elements.push(group(
      `${transition.label}: ${transition.from} to ${transition.to}${transition.guard ? ` when ${transition.guard}` : ''}`,
      'transition', children,
      { semanticId: `transition-${transition.id}`, layer: 'relations' },
    ));
  }

  return {
    id: model.id, kind: model.kind, title: model.title, description: model.description,
    layoutProfile: profile.id, width, height, minInlineSize: metrics.minInlineSize || width, elements,
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
    kind: 'text', x, y: y - 28 + index * 13, text: line, role: 'meta', anchor: 'middle', tone,
  }));
  guardLines.forEach((line, index) => elements.push({
    kind: 'text', x, y: y + 24 + index * 13, text: line, role: 'code', anchor: 'middle', tone: 'muted',
  }));
}
