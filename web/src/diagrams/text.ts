import type {
  DiagramModel,
  HistoryDiagram,
  HistoryOperation,
  LifecycleDiagram,
  VersionChainDiagram,
} from './types.js';

export function renderDiagramTranscript(model: DiagramModel): readonly string[] {
  if (model.kind === 'history') return historyTranscript(model);
  if (model.kind === 'version-chain') return versionChainTranscript(model);
  return lifecycleTranscript(model);
}

export function renderDiagramTranscriptText(model: DiagramModel): string {
  return renderDiagramTranscript(model).join('\n');
}

function historyTranscript(model: HistoryDiagram): string[] {
  const lines = [model.title];
  for (const lane of model.lanes) {
    const operations = model.operations
      .filter(operation => operation.lane === lane.id)
      .toSorted((left, right) => left.start - right.start)
      .map(operation => formatOperation(operation, model.horizon));
    lines.push(`${lane.label}: ${operations.join(' · ')}`);
  }
  for (const marker of model.markers) lines.push(`marker @${formatTime(marker.time)}: ${marker.label}`);
  for (const edge of model.precedence) {
    lines.push(`precedence: ${edge.from} → ${edge.to}${edge.label ? ` (${edge.label})` : ''}`);
  }
  for (const witness of model.witnesses) lines.push(`${witness.label}: ${witness.operations.join(' → ')}`);
  return lines;
}

function formatOperation(operation: HistoryOperation, horizon: number): string {
  const end = operation.end ?? horizon;
  const response = operation.end == null
    ? 'pending'
    : operation.result ?? 'ok';
  const linearization = operation.linearization == null
    ? ''
    : typeof operation.linearization === 'number'
      ? `; LP @${formatTime(operation.linearization)}`
      : `; LP ∈ [${formatTime(operation.linearization[0])}, ${formatTime(operation.linearization[1])}]`;
  return `inv ${operation.call} @${formatTime(operation.start)} → ${response} @${formatTime(end)}${linearization}`;
}

function versionChainTranscript(model: VersionChainDiagram): string[] {
  const lines = [
    model.title,
    `${model.headLabel}: ${model.versions.map(version => version.id).join(' → ')}`,
  ];
  for (const version of model.versions) {
    lines.push(
      `${version.label}: ${version.payload}; xmin=${version.createdBy}; xmax=${version.deletedBy ?? '—'}; generation=${version.generation}; state=${version.state}${version.note ? `; ${version.note}` : ''}`,
    );
  }
  lines.push(`${model.snapshot.label} → ${model.snapshot.visibleVersion}: ${model.snapshot.note}`);
  return lines;
}

function lifecycleTranscript(model: LifecycleDiagram): string[] {
  const stateById = new Map(model.states.map(state => [state.id, state]));
  const lines = [model.title, `initial: ${stateById.get(model.initial)?.label ?? model.initial}`];
  for (const transition of model.transitions) {
    const from = stateById.get(transition.from)?.label ?? transition.from;
    const to = stateById.get(transition.to)?.label ?? transition.to;
    lines.push(`${from} --${transition.label}${transition.guard ? ` [${transition.guard}]` : ''}--> ${to}`);
  }
  return lines;
}

function formatTime(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/u, '');
}
