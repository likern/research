import rawCatalogue from '../../../../design/diagrams/layouts/profiles.json';
import type { DiagramKind, DiagramLayer } from '../types.js';

export type LayoutProfileStatus = 'production' | 'candidate';
export type HistoryLayoutStrategy = 'timeline-panel' | 'proof-timeline';
export type VersionChainLayoutStrategy = 'cards' | 'records';
export type LifecycleLayoutStrategy = 'snake-grid' | 'horizontal-return';

export interface HistoryWebLayoutMetrics {
  readonly width: number;
  readonly left: number;
  readonly right: number;
  readonly laneGap: number;
  readonly axisY: number;
  readonly top: number;
  readonly witnessPanelHeight: number;
  readonly witnessStride: number;
  readonly witnessTopGap: number;
  readonly bottomPadding: number;
  readonly operationCompleteWidth: number;
  readonly operationPendingWidth: number;
  readonly precedenceBaseOffset: number;
  readonly precedenceStep: number;
  readonly minInlineSize: number;
  readonly witnessStyle: 'panel' | 'sequence';
  readonly linearizationStyle: 'halo' | 'tick';
}

export interface VersionChainWebLayoutMetrics {
  readonly nodeWidth: number;
  readonly nodeHeight: number;
  readonly gap: number;
  readonly left: number;
  readonly top: number;
  readonly evaluationGap: number;
  readonly evaluationHeight: number;
  readonly radius: number;
  readonly minInlineSizeCap: number;
  readonly headSlotWidth: number;
  readonly headGap: number;
}

export interface LifecycleWebLayoutMetrics {
  readonly maxColumns: number;
  readonly stateWidth: number;
  readonly stateHeight: number;
  readonly columnGap: number;
  readonly rowGap: number;
  readonly left: number;
  readonly top: number;
  readonly minInlineSize: number;
  readonly stateSpacing: number;
  readonly returnGap: number;
}

interface TypstLayoutMetrics {
  readonly supported: boolean;
  readonly [key: string]: boolean | number;
}

interface LayoutProfileBase<K extends DiagramKind, S extends string, W> {
  readonly id: string;
  readonly kind: K;
  readonly label: string;
  readonly status: LayoutProfileStatus;
  readonly strategy: S;
  readonly web: W;
  readonly typst: TypstLayoutMetrics;
}

export type HistoryLayoutProfile = LayoutProfileBase<'history', HistoryLayoutStrategy, HistoryWebLayoutMetrics>;
export type VersionChainLayoutProfile = LayoutProfileBase<'version-chain', VersionChainLayoutStrategy, VersionChainWebLayoutMetrics>;
export type LifecycleLayoutProfile = LayoutProfileBase<'lifecycle', LifecycleLayoutStrategy, LifecycleWebLayoutMetrics>;
export type DiagramLayoutProfile = HistoryLayoutProfile | VersionChainLayoutProfile | LifecycleLayoutProfile;

export interface DiagramLayoutProfileSummary {
  readonly id: string;
  readonly kind: DiagramKind;
  readonly label: string;
  readonly status: LayoutProfileStatus;
  readonly strategy: string;
  readonly typstSupported: boolean;
}

interface RawProfile {
  readonly label: string;
  readonly status: LayoutProfileStatus;
  readonly strategy: string;
  readonly web: Readonly<Record<string, unknown>>;
  readonly typst: TypstLayoutMetrics;
}

interface RawCatalogue {
  readonly profileSchemaVersion: number;
  readonly defaults: Readonly<Record<DiagramKind, string>>;
  readonly layerOrder: readonly DiagramLayer[];
  readonly profiles: Readonly<Record<DiagramKind, Readonly<Record<string, RawProfile>>>>;
}

const catalogue = rawCatalogue as unknown as RawCatalogue;
validateCatalogue(catalogue);

export const diagramLayerOrder: readonly DiagramLayer[] = catalogue.layerOrder;

export function defaultLayoutProfileId(kind: DiagramKind): string {
  return catalogue.defaults[kind];
}

export function listDiagramLayoutProfiles(kind: DiagramKind): readonly DiagramLayoutProfileSummary[] {
  return Object.entries(catalogue.profiles[kind]).map(([id, profile]) => ({
    id,
    kind,
    label: profile.label,
    status: profile.status,
    strategy: profile.strategy,
    typstSupported: profile.typst.supported,
  }));
}

export function resolveHistoryLayoutProfile(name?: string): HistoryLayoutProfile {
  return resolveProfile('history', name) as HistoryLayoutProfile;
}

export function resolveVersionChainLayoutProfile(name?: string): VersionChainLayoutProfile {
  return resolveProfile('version-chain', name) as VersionChainLayoutProfile;
}

export function resolveLifecycleLayoutProfile(name?: string): LifecycleLayoutProfile {
  return resolveProfile('lifecycle', name) as LifecycleLayoutProfile;
}

function resolveProfile(kind: DiagramKind, name?: string): DiagramLayoutProfile {
  const id = name ?? catalogue.defaults[kind];
  const raw = catalogue.profiles[kind][id];
  if (!raw) {
    const available = Object.keys(catalogue.profiles[kind]).join(', ');
    throw new TypeError(`Unknown ${kind} layout profile ${JSON.stringify(id)}; expected one of: ${available}`);
  }
  return {
    id,
    kind,
    label: raw.label,
    status: raw.status,
    strategy: raw.strategy,
    web: raw.web,
    typst: raw.typst,
  } as unknown as DiagramLayoutProfile;
}

function validateCatalogue(value: RawCatalogue): void {
  if (value.profileSchemaVersion !== 1) throw new TypeError('Unsupported diagram layout profile schema');
  const kinds: readonly DiagramKind[] = ['history', 'version-chain', 'lifecycle'];
  const layers: readonly DiagramLayer[] = ['background', 'relations', 'objects', 'annotations', 'proof'];
  if (value.layerOrder.length !== layers.length || layers.some(layer => !value.layerOrder.includes(layer))) {
    throw new TypeError('Diagram layout catalogue has an invalid authoring layer order');
  }
  for (const kind of kinds) {
    const profiles = value.profiles[kind];
    const defaultId = value.defaults[kind];
    if (!profiles || !profiles[defaultId]) throw new TypeError(`Missing default ${kind} layout profile`);
    for (const [id, profile] of Object.entries(profiles)) {
      if (!id || !profile.label) throw new TypeError(`Invalid ${kind} layout profile identity`);
      if (profile.status !== 'production' && profile.status !== 'candidate') {
        throw new TypeError(`Invalid status for ${kind} layout profile ${id}`);
      }
      if (!profile.web || !profile.typst || typeof profile.typst.supported !== 'boolean') {
        throw new TypeError(`Incomplete ${kind} layout profile ${id}`);
      }
    }
  }
}
