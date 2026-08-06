import type { DiagramModel } from './types.js';
import { layoutDiagram } from './scene.js';
import { renderDiagramTranscriptText } from './text.js';
import { escapeAttribute, escapeText, renderSceneSvg } from './svg.js';
import { validateDiagramModel } from './validate.js';

export function renderDiagramFigure(value: unknown): string {
  const model = validateDiagramModel(value);
  const scene = layoutDiagram(model);
  const transcript = renderDiagramTranscriptText(model);
  const figureId = `pinega-figure-${model.id}`;
  return [
    `<figure class="pinega-semantic-diagram" id="${escapeAttribute(figureId)}" data-diagram-id="${escapeAttribute(model.id)}" data-diagram-kind="${escapeAttribute(model.kind)}">`,
    `<div class="pinega-diagram-viewport" tabindex="0" role="region" aria-label="${escapeAttribute(`${model.title} diagram viewport`)}">`,
    renderSceneSvg(scene),
    '</div>',
    `<figcaption>${escapeText(model.caption)}</figcaption>`,
    '<details class="pinega-diagram-transcript">',
    '<summary>Text representation and semantic model</summary>',
    `<pre tabindex="0"><code>${escapeText(transcript)}</code></pre>`,
    `<a href="/diagrams/models/${escapeAttribute(model.id)}.json" download>Download semantic model</a>`,
    '</details>',
    '</figure>',
  ].join('');
}

export function renderDiagramSvg(value: unknown): string {
  const model = validateDiagramModel(value);
  return renderSceneSvg(layoutDiagram(model));
}
