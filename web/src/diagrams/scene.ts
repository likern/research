import type {
  DiagramLayer,
  DiagramLayoutOptions,
  DiagramModel,
  DiagramScene,
  DiagramTone,
  SceneElement,
  SceneGroup,
  VersionState,
} from './types.js';
import { layoutHistory } from './layout/history.js';
import { layoutLifecycle } from './layout/lifecycle.js';
import {
  resolveHistoryLayoutProfile,
  resolveLifecycleLayoutProfile,
  resolveVersionChainLayoutProfile,
} from './layout/profiles.js';
import { layoutVersionChain } from './layout/version-chain.js';

export function layoutDiagram(model: DiagramModel, options: DiagramLayoutOptions = {}): DiagramScene {
  if (model.kind === 'history') return layoutHistory(model, resolveHistoryLayoutProfile(options.profile));
  if (model.kind === 'version-chain') return layoutVersionChain(model, resolveVersionChainLayoutProfile(options.profile));
  return layoutLifecycle(model, resolveLifecycleLayoutProfile(options.profile));
}

export interface SceneGroupOptions {
  readonly className?: string;
  readonly semanticId?: string;
  readonly layer?: DiagramLayer;
}

export function group(
  label: string,
  role: string,
  children: readonly SceneElement[],
  options: SceneGroupOptions = {},
): SceneGroup {
  return {
    kind: 'group',
    label,
    role,
    children,
    ...(options.className ? { className: options.className } : {}),
    ...(options.semanticId ? { semanticId: options.semanticId } : {}),
    ...(options.layer ? { layer: options.layer } : {}),
  };
}

export function wrapText(value: string, maxCharacters: number, maxLines = 3): readonly string[] {
  const words = value.trim().split(/\s+/u);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters || current.length === 0) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  const consumed = lines.join(' ').split(/\s+/u).filter(Boolean).length;
  const remainingWords = words.slice(consumed);
  if (lines.length === maxLines - 1 && remainingWords.length > 0) {
    let final = remainingWords.join(' ');
    if (final.length > maxCharacters) final = `${final.slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`;
    lines.push(final);
    return lines;
  }

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

export function toneForVersionState(state: VersionState): DiagramTone {
  if (state === 'visible') return 'inferred';
  if (state === 'obsolete') return 'warning';
  if (state === 'retired') return 'pending';
  if (state === 'uncommitted') return 'event';
  return 'danger';
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}
