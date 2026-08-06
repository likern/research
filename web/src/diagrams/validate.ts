import {
  diagramTones,
  type DiagramModel,
  type DiagramTone,
  type HistoryDiagram,
  type HistoryOperation,
  type LifecycleDiagram,
  type VersionChainDiagram,
} from './types.js';

const idPattern = /^[a-z][a-z0-9-]*$/u;
const toneSet = new Set<string>(diagramTones);
const versionStates = new Set(['visible', 'obsolete', 'retired', 'uncommitted', 'aborted']);
const markerPatterns = new Set(['solid', 'dashed', 'dotted']);

export class DiagramValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'DiagramValidationError';
  }
}

export function validateDiagramModel(value: unknown): DiagramModel {
  const record = asRecord(value, 'diagram');
  requireEqual(record.schemaVersion, 1, 'diagram.schemaVersion must be 1');
  const kind = readString(record, 'kind', 'diagram');
  validateBase(record);

  if (kind === 'history') return validateHistory(record);
  if (kind === 'version-chain') return validateVersionChain(record);
  if (kind === 'lifecycle') return validateLifecycle(record);
  fail(`diagram.kind must be history, version-chain, or lifecycle; got ${JSON.stringify(kind)}`);
}

function validateBase(record: Record<string, unknown>): void {
  readId(record, 'id', 'diagram');
  readNonEmptyString(record, 'title', 'diagram');
  readNonEmptyString(record, 'caption', 'diagram');
  readNonEmptyString(record, 'description', 'diagram');
}

function validateHistory(record: Record<string, unknown>): HistoryDiagram {
  const lanes = readArray(record, 'lanes', 'history');
  require(lanes.length > 0, 'history.lanes must not be empty');
  const laneIds = lanes.map((lane, index) => readId(asRecord(lane, `history.lanes[${index}]`), 'id', `history.lanes[${index}]`));
  ensureUnique(laneIds, 'history lane ids');
  lanes.forEach((lane, index) => {
    const item = asRecord(lane, `history.lanes[${index}]`);
    readNonEmptyString(item, 'label', `history.lanes[${index}]`);
  });

  const operations = readArray(record, 'operations', 'history');
  require(operations.length > 0, 'history.operations must not be empty');
  const operationIds: string[] = [];
  const typedOperations: HistoryOperation[] = [];
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const [index, operationValue] of operations.entries()) {
    const path = `history.operations[${index}]`;
    const operation = asRecord(operationValue, path);
    const id = readId(operation, 'id', path);
    operationIds.push(id);
    const lane = readId(operation, 'lane', path);
    require(laneIds.includes(lane), `${path}.lane references unknown lane ${JSON.stringify(lane)}`);
    readNonEmptyString(operation, 'call', path);
    const start = readFiniteNumber(operation, 'start', path);
    const end = readOptionalFiniteNumber(operation, 'end', path);
    if (end !== null && end !== undefined) require(end > start, `${path}.end must follow start`);
    readOptionalString(operation, 'result', path);
    readTone(operation, 'tone', path);
    readOptionalString(operation, 'object', path);
    readOptionalString(operation, 'note', path);
    const linearization = readLinearization(operation.linearization, `${path}.linearization`);
    if (typeof linearization === 'number') {
      require(linearization >= start, `${path}.linearization precedes invocation`);
      if (end !== null && end !== undefined) require(linearization <= end, `${path}.linearization follows response`);
    } else if (linearization !== null && linearization !== undefined) {
      require(linearization[0] >= start, `${path}.linearization interval precedes invocation`);
      if (end !== null && end !== undefined) require(linearization[1] <= end, `${path}.linearization interval follows response`);
    }
    latestTime = Math.max(latestTime, start, end ?? start, ...linearizationNumbers(linearization));
    typedOperations.push(operation as unknown as HistoryOperation);
  }
  ensureUnique(operationIds, 'history operation ids');
  validateLaneWellFormedness(typedOperations);

  const markers = readArray(record, 'markers', 'history');
  markers.forEach((markerValue, index) => {
    const path = `history.markers[${index}]`;
    const marker = asRecord(markerValue, path);
    latestTime = Math.max(latestTime, readFiniteNumber(marker, 'time', path));
    readNonEmptyString(marker, 'label', path);
    readTone(marker, 'tone', path);
    const pattern = readString(marker, 'pattern', path);
    require(markerPatterns.has(pattern), `${path}.pattern must be solid, dashed, or dotted`);
  });

  const witnesses = readArray(record, 'witnesses', 'history');
  witnesses.forEach((witnessValue, index) => {
    const path = `history.witnesses[${index}]`;
    const witness = asRecord(witnessValue, path);
    readNonEmptyString(witness, 'label', path);
    readTone(witness, 'tone', path);
    const ids = readStringArray(witness, 'operations', path);
    require(ids.length > 0, `${path}.operations must not be empty`);
    ensureUnique(ids, `${path}.operations`);
    for (const id of ids) require(operationIds.includes(id), `${path} references unknown operation ${JSON.stringify(id)}`);
  });

  const precedence = readArray(record, 'precedence', 'history');
  precedence.forEach((edgeValue, index) => {
    const path = `history.precedence[${index}]`;
    const edge = asRecord(edgeValue, path);
    const from = readId(edge, 'from', path);
    const to = readId(edge, 'to', path);
    require(from !== to, `${path} cannot be reflexive`);
    require(operationIds.includes(from), `${path}.from references unknown operation ${JSON.stringify(from)}`);
    require(operationIds.includes(to), `${path}.to references unknown operation ${JSON.stringify(to)}`);
    readOptionalString(edge, 'label', path);
    readTone(edge, 'tone', path);
  });

  const horizon = readFiniteNumber(record, 'horizon', 'history');
  require(horizon >= latestTime, `history.horizon ${horizon} does not cover the latest event ${latestTime}`);
  return record as unknown as HistoryDiagram;
}

function validateVersionChain(record: Record<string, unknown>): VersionChainDiagram {
  readNonEmptyString(record, 'subject', 'version-chain');
  const head = readId(record, 'head', 'version-chain');
  readNonEmptyString(record, 'headLabel', 'version-chain');
  const snapshot = asRecord(record.snapshot, 'version-chain.snapshot');
  readId(snapshot, 'id', 'version-chain.snapshot');
  readNonEmptyString(snapshot, 'label', 'version-chain.snapshot');
  const visibleVersion = readId(snapshot, 'visibleVersion', 'version-chain.snapshot');
  readNonEmptyString(snapshot, 'note', 'version-chain.snapshot');

  const versions = readArray(record, 'versions', 'version-chain');
  require(versions.length > 0, 'version-chain.versions must not be empty');
  const ids: string[] = [];
  let visibleCount = 0;
  versions.forEach((versionValue, index) => {
    const path = `version-chain.versions[${index}]`;
    const version = asRecord(versionValue, path);
    ids.push(readId(version, 'id', path));
    readNonEmptyString(version, 'label', path);
    readNonEmptyString(version, 'payload', path);
    readNonEmptyString(version, 'createdBy', path);
    readOptionalString(version, 'deletedBy', path);
    const generation = readFiniteNumber(version, 'generation', path);
    require(Number.isInteger(generation) && generation >= 0, `${path}.generation must be a non-negative integer`);
    const state = readString(version, 'state', path);
    require(versionStates.has(state), `${path}.state is invalid`);
    if (state === 'visible') visibleCount += 1;
    readOptionalString(version, 'note', path);
  });
  ensureUnique(ids, 'version ids');
  require(ids.includes(head), `version-chain.head references unknown version ${JSON.stringify(head)}`);
  require(ids[0] === head, 'version-chain.head must identify the first newest-to-oldest version');
  require(ids.includes(visibleVersion), `version-chain.snapshot.visibleVersion references unknown version ${JSON.stringify(visibleVersion)}`);
  require(visibleCount === 1, `version-chain must contain exactly one visible version; found ${visibleCount}`);
  const visible = versions.find(version => asRecord(version, 'version').id === visibleVersion) as Record<string, unknown> | undefined;
  require(visible?.state === 'visible', 'version-chain.snapshot.visibleVersion must identify the visible version');
  return record as unknown as VersionChainDiagram;
}

function validateLifecycle(record: Record<string, unknown>): LifecycleDiagram {
  readNonEmptyString(record, 'subject', 'lifecycle');
  const initial = readId(record, 'initial', 'lifecycle');
  const states = readArray(record, 'states', 'lifecycle');
  require(states.length > 0, 'lifecycle.states must not be empty');
  const stateIds: string[] = [];
  states.forEach((stateValue, index) => {
    const path = `lifecycle.states[${index}]`;
    const state = asRecord(stateValue, path);
    stateIds.push(readId(state, 'id', path));
    readNonEmptyString(state, 'label', path);
    readNonEmptyString(state, 'description', path);
    readTone(state, 'tone', path);
  });
  ensureUnique(stateIds, 'lifecycle state ids');
  require(stateIds.includes(initial), `lifecycle.initial references unknown state ${JSON.stringify(initial)}`);

  const transitions = readArray(record, 'transitions', 'lifecycle');
  require(transitions.length > 0, 'lifecycle.transitions must not be empty');
  const transitionIds: string[] = [];
  transitions.forEach((transitionValue, index) => {
    const path = `lifecycle.transitions[${index}]`;
    const transition = asRecord(transitionValue, path);
    transitionIds.push(readId(transition, 'id', path));
    const from = readId(transition, 'from', path);
    const to = readId(transition, 'to', path);
    require(stateIds.includes(from), `${path}.from references unknown state ${JSON.stringify(from)}`);
    require(stateIds.includes(to), `${path}.to references unknown state ${JSON.stringify(to)}`);
    require(from !== to, `${path} must change state`);
    readNonEmptyString(transition, 'label', path);
    readOptionalString(transition, 'guard', path);
    readTone(transition, 'tone', path);
  });
  ensureUnique(transitionIds, 'lifecycle transition ids');
  ensureReachableStates(initial, stateIds, transitions.map(value => value as { from: string; to: string }));
  return record as unknown as LifecycleDiagram;
}

function validateLaneWellFormedness(operations: readonly HistoryOperation[]): void {
  const lanes = new Map<string, HistoryOperation[]>();
  for (const operation of operations) {
    const list = lanes.get(operation.lane) ?? [];
    list.push(operation);
    lanes.set(operation.lane, list);
  }
  for (const [lane, list] of lanes) {
    list.sort((left, right) => left.start - right.start);
    for (let index = 1; index < list.length; index += 1) {
      const previous = list[index - 1];
      const current = list[index];
      require(previous !== undefined && current !== undefined, 'internal lane ordering failure');
      require(previous.end !== null && previous.end !== undefined && previous.end <= current.start, `history lane ${lane} contains overlapping operations ${previous.id} and ${current.id}`);
    }
  }
}

function ensureReachableStates(initial: string, states: readonly string[], transitions: readonly { from: string; to: string }[]): void {
  const visited = new Set([initial]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const transition of transitions) {
      if (visited.has(transition.from) && !visited.has(transition.to)) {
        visited.add(transition.to);
        changed = true;
      }
    }
  }
  const unreachable = states.filter(state => !visited.has(state));
  require(unreachable.length === 0, `lifecycle contains unreachable states: ${unreachable.join(', ')}`);
}

function readLinearization(value: unknown, path: string): number | readonly [number, number] | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number') {
    require(Number.isFinite(value), `${path} must be finite`);
    return value;
  }
  require(Array.isArray(value) && value.length === 2, `${path} must be a number, two-number interval, null, or omitted`);
  const start = value[0];
  const end = value[1];
  require(typeof start === 'number' && Number.isFinite(start), `${path}[0] must be finite`);
  require(typeof end === 'number' && Number.isFinite(end), `${path}[1] must be finite`);
  require(start <= end, `${path} interval is reversed`);
  return [start, end];
}

function linearizationNumbers(value: number | readonly [number, number] | null | undefined): number[] {
  if (typeof value === 'number') return [value];
  return value == null ? [] : [...value];
}

function readTone(record: Record<string, unknown>, key: string, path: string): DiagramTone {
  const value = readString(record, key, path);
  require(toneSet.has(value), `${path}.${key} is not a supported tone`);
  return value as DiagramTone;
}

function readId(record: Record<string, unknown>, key: string, path: string): string {
  const value = readNonEmptyString(record, key, path);
  require(idPattern.test(value), `${path}.${key} must be a kebab-case identifier`);
  return value;
}

function readStringArray(record: Record<string, unknown>, key: string, path: string): string[] {
  return readArray(record, key, path).map((value, index) => {
    require(typeof value === 'string' && value.length > 0, `${path}.${key}[${index}] must be a non-empty string`);
    return value;
  });
}

function readArray(record: Record<string, unknown>, key: string, path: string): unknown[] {
  const value = record[key];
  require(Array.isArray(value), `${path}.${key} must be an array`);
  return value;
}

function readFiniteNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  require(typeof value === 'number' && Number.isFinite(value), `${path}.${key} must be a finite number`);
  return value;
}

function readOptionalFiniteNumber(record: Record<string, unknown>, key: string, path: string): number | null | undefined {
  const value = record[key];
  if (value === undefined || value === null) return value;
  require(typeof value === 'number' && Number.isFinite(value), `${path}.${key} must be a finite number, null, or omitted`);
  return value;
}

function readNonEmptyString(record: Record<string, unknown>, key: string, path: string): string {
  const value = readString(record, key, path);
  require(value.trim().length > 0, `${path}.${key} must not be empty`);
  return value;
}

function readString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  require(typeof value === 'string', `${path}.${key} must be a string`);
  return value;
}

function readOptionalString(record: Record<string, unknown>, key: string, path: string): string | null | undefined {
  const value = record[key];
  if (value === undefined || value === null) return value;
  require(typeof value === 'string', `${path}.${key} must be a string, null, or omitted`);
  return value;
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  require(value !== null && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`);
  return value as Record<string, unknown>;
}

function ensureUnique(values: readonly string[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    require(!seen.has(value), `${path} contains duplicate ${JSON.stringify(value)}`);
    seen.add(value);
  }
}

function requireEqual(actual: unknown, expected: unknown, message: string): void {
  require(Object.is(actual, expected), message);
}

function require(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function fail(message: string): never {
  throw new DiagramValidationError(message);
}
