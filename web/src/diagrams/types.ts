export const diagramTones = [
  'primary',
  'event',
  'inferred',
  'warning',
  'danger',
  'pending',
  'muted',
  'neutral',
] as const;

export type DiagramTone = (typeof diagramTones)[number];

export interface DiagramBase {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly kind: DiagramKind;
  readonly title: string;
  readonly caption: string;
  readonly description: string;
}

export type DiagramKind = 'history' | 'version-chain' | 'lifecycle';

export interface HistoryLane {
  readonly id: string;
  readonly label: string;
}

export interface HistoryOperation {
  readonly id: string;
  readonly lane: string;
  readonly call: string;
  readonly start: number;
  readonly end?: number | null;
  readonly result?: string | null;
  readonly linearization?: number | readonly [number, number] | null;
  readonly tone: DiagramTone;
  readonly object?: string | null;
  readonly note?: string | null;
}

export interface HistoryMarker {
  readonly time: number;
  readonly label: string;
  readonly tone: DiagramTone;
  readonly pattern: 'solid' | 'dashed' | 'dotted';
}

export interface HistoryWitness {
  readonly label: string;
  readonly operations: readonly string[];
  readonly tone: DiagramTone;
}

export interface HistoryPrecedence {
  readonly from: string;
  readonly to: string;
  readonly label: string | null;
  readonly tone: DiagramTone;
}

export interface HistoryDiagram extends DiagramBase {
  readonly kind: 'history';
  readonly lanes: readonly HistoryLane[];
  readonly operations: readonly HistoryOperation[];
  readonly markers: readonly HistoryMarker[];
  readonly witnesses: readonly HistoryWitness[];
  readonly precedence: readonly HistoryPrecedence[];
  readonly horizon: number;
}

export type VersionState = 'visible' | 'obsolete' | 'retired' | 'uncommitted' | 'aborted';

export interface VersionNode {
  readonly id: string;
  readonly label: string;
  readonly payload: string;
  readonly createdBy: string;
  readonly deletedBy: string | null;
  readonly generation: number;
  readonly state: VersionState;
  readonly note: string | null;
}

export interface VersionSnapshot {
  readonly id: string;
  readonly label: string;
  readonly visibleVersion: string;
  readonly note: string;
}

export interface VersionChainDiagram extends DiagramBase {
  readonly kind: 'version-chain';
  readonly subject: string;
  readonly head: string;
  readonly headLabel: string;
  readonly snapshot: VersionSnapshot;
  readonly versions: readonly VersionNode[];
}

export interface LifecycleState {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tone: DiagramTone;
}

export interface LifecycleTransition {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly guard: string | null;
  readonly tone: DiagramTone;
}

export interface LifecycleDiagram extends DiagramBase {
  readonly kind: 'lifecycle';
  readonly subject: string;
  readonly initial: string;
  readonly states: readonly LifecycleState[];
  readonly transitions: readonly LifecycleTransition[];
}

export type DiagramModel = HistoryDiagram | VersionChainDiagram | LifecycleDiagram;

export type DiagramDash = 'solid' | 'dashed' | 'dotted';
export type DiagramTextAnchor = 'start' | 'middle' | 'end';
export type DiagramTextRole = 'title' | 'label' | 'body' | 'code' | 'meta' | 'chip';
export type DiagramLayer = 'background' | 'relations' | 'objects' | 'annotations' | 'proof';

export interface DiagramLayoutOptions {
  readonly profile?: string;
}

export interface AuthoringSvgOptions extends DiagramLayoutOptions {
  readonly systemVersion?: string;
  readonly includeXmlDeclaration?: boolean;
}

export interface SceneBase {
  readonly className?: string;
  readonly semanticId?: string;
  readonly layer?: DiagramLayer;
}

export interface SceneGroup extends SceneBase {
  readonly kind: 'group';
  readonly label?: string;
  readonly role?: string;
  readonly children: readonly SceneElement[];
}

export interface SceneLine extends SceneBase {
  readonly kind: 'line';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly tone: DiagramTone;
  readonly width?: number;
  readonly dash?: DiagramDash;
  readonly arrowEnd?: boolean;
}

export interface ScenePath extends SceneBase {
  readonly kind: 'path';
  readonly d: string;
  readonly tone: DiagramTone;
  readonly width?: number;
  readonly dash?: DiagramDash;
  readonly arrowEnd?: boolean;
  readonly fillTone?: DiagramTone | null;
}

export interface SceneRect extends SceneBase {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius?: number;
  readonly tone: DiagramTone;
  readonly fillTone?: DiagramTone | null;
  readonly dash?: DiagramDash;
  readonly strokeWidth?: number;
}

export interface SceneCircle extends SceneBase {
  readonly kind: 'circle';
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly tone: DiagramTone;
  readonly fillTone?: DiagramTone | null;
  readonly strokeWidth?: number;
  readonly dash?: DiagramDash;
}

export interface SceneText extends SceneBase {
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly role: DiagramTextRole;
  readonly anchor?: DiagramTextAnchor;
  readonly tone?: DiagramTone;
}

export type SceneElement = SceneGroup | SceneLine | ScenePath | SceneRect | SceneCircle | SceneText;

export interface DiagramScene {
  readonly id: string;
  readonly kind: DiagramKind;
  readonly title: string;
  readonly description: string;
  readonly layoutProfile: string;
  readonly width: number;
  readonly height: number;
  readonly minInlineSize: number;
  readonly elements: readonly SceneElement[];
}
