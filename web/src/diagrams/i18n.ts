import type { DiagramMessages } from './types.js';

export const defaultDiagramMessages: DiagramMessages = {
  viewport: '{title} diagram viewport',
  transcript_summary: 'Text representation and semantic model',
  download_model: 'Download semantic model',
  process_lane: '{label} process lane',
  marker_at_time: 'Marker {label} at time {time}',
  response_before_invocation: 'response before invocation',
  precedes: '{from} precedes {to}: {label}',
  witness_reason: 'Preserves process order and every real-time precedence constraint.',
  history_legend: '● invocation   ○ response   ● LP   ⇢ pending',
  pending_upper: 'PENDING',
  lp_interval: 'LP interval',
  pending: 'pending',
  response_at: 'response {result} at {time}',
  linearization_at: '; linearization at {time}',
  linearization_interval: '; linearization interval {from} to {to}',
  invocation_at: '{lane}: invocation {call} at {time}; {end}{linearization}',
  transcript_marker: 'marker @{time}: {label}',
  transcript_precedence: 'precedence: {from} → {to}{label}',
  transcript_invocation: 'inv {call} @{start} → {result} @{end}{linearization}',
  transcript_lp_at: '; LP @{time}',
  transcript_lp_interval: '; LP ∈ [{from}, {to}]',
  ok: 'ok',
  generation: 'generation {generation}',
  state_visible: 'VISIBLE',
  state_obsolete: 'OBSOLETE',
  state_retired: 'RETIRED',
  state_uncommitted: 'UNCOMMITTED',
  state_aborted: 'ABORTED',
  version_accessible: '{label}: {payload}; created by {created}; deleted by {deleted}; generation {generation}; state {state}{note}',
  none: 'none',
  links_older: '{from} links to older version {to}',
  older: 'older',
  references: '{label} references {target}',
  visibility_evaluation_accessible: '{snapshot} evaluates version visibility and selects {version}',
  visibility_evaluation: '{snapshot} · visibility evaluation',
  visibility_result: '{version} is {result} by {snapshot}',
  selected: 'selected',
  not_selected: 'not selected',
  selected_chip: '✓ selected',
  lifecycle_initial: 'INITIAL',
  transition_accessible: '{label}: {from} to {to}{guard}',
  transition_when: ' when {guard}',
  transcript_initial: 'initial: {state}',
};

export function diagramMessage(
  messages: DiagramMessages | undefined,
  key: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  const template = messages?.[key] ?? defaultDiagramMessages[key];
  if (!template) throw new TypeError(`Missing diagram message ${JSON.stringify(key)}`);
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
