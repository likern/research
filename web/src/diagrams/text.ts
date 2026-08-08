import type {
  DiagramModel,
  HistoryDiagram,
  HistoryOperation,
  LifecycleDiagram,
  VersionChainDiagram,
  DiagramMessages,
} from './types.js';
import { diagramMessage } from './i18n.js';

export function renderDiagramTranscript(model: DiagramModel, messages?: DiagramMessages): readonly string[] {
  if (model.kind === 'history') return historyTranscript(model, messages);
  if (model.kind === 'version-chain') return versionChainTranscript(model, messages);
  return lifecycleTranscript(model, messages);
}

export function renderDiagramTranscriptText(model: DiagramModel, messages?: DiagramMessages): string {
  return renderDiagramTranscript(model, messages).join('\n');
}

function historyTranscript(model: HistoryDiagram, messages?: DiagramMessages): string[] {
  const lines = [model.title];
  for (const lane of model.lanes) {
    const operations = model.operations
      .filter(operation => operation.lane === lane.id)
      .toSorted((left, right) => left.start - right.start)
      .map(operation => formatOperation(operation, model.horizon, messages));
    lines.push(`${lane.label}: ${operations.join(' · ')}`);
  }
  for (const marker of model.markers) lines.push(diagramMessage(messages, 'transcript_marker', { time: formatTime(marker.time), label: marker.label }));
  for (const edge of model.precedence) {
    lines.push(diagramMessage(messages, 'transcript_precedence', { from: edge.from, to: edge.to, label: edge.label ? ` (${edge.label})` : '' }));
  }
  for (const witness of model.witnesses) lines.push(`${witness.label}: ${witness.operations.join(' → ')}`);
  return lines;
}

function formatOperation(operation: HistoryOperation, horizon: number, messages?: DiagramMessages): string {
  const end = operation.end ?? horizon;
  const response = operation.end == null
    ? diagramMessage(messages, 'pending')
    : operation.result ?? diagramMessage(messages, 'ok');
  const linearization = operation.linearization == null
    ? ''
    : typeof operation.linearization === 'number'
      ? diagramMessage(messages, 'transcript_lp_at', { time: formatTime(operation.linearization) })
      : diagramMessage(messages, 'transcript_lp_interval', { from: formatTime(operation.linearization[0]), to: formatTime(operation.linearization[1]) });
  return diagramMessage(messages, 'transcript_invocation', { call: operation.call, start: formatTime(operation.start), result: response, end: formatTime(end), linearization });
}

function versionChainTranscript(model: VersionChainDiagram, messages?: DiagramMessages): string[] {
  const lines = [
    model.title,
    `${model.headLabel}: ${model.versions.map(version => version.id).join(' → ')}`,
  ];
  for (const version of model.versions) {
    lines.push(
      `${version.label}: ${version.payload}; xmin=${version.createdBy}; xmax=${version.deletedBy ?? '—'}; ${diagramMessage(messages, 'generation', { generation: version.generation })}; ${diagramMessage(messages, `state_${version.state}`).toLocaleLowerCase()}${version.note ? `; ${version.note}` : ''}`,
    );
  }
  lines.push(`${model.snapshot.label} → ${model.snapshot.visibleVersion}: ${model.snapshot.note}`);
  return lines;
}

function lifecycleTranscript(model: LifecycleDiagram, messages?: DiagramMessages): string[] {
  const stateById = new Map(model.states.map(state => [state.id, state]));
  const lines = [model.title, diagramMessage(messages, 'transcript_initial', { state: stateById.get(model.initial)?.label ?? model.initial })];
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
