import type { AuthoringSvgOptions, DiagramLayoutOptions, DiagramScene } from './types.js';
import { layoutDiagram } from './scene.js';
import { renderDiagramTranscriptText } from './text.js';
import { escapeAttribute, escapeText, renderSceneAuthoringSvg, renderSceneSvg } from './svg.js';
import { validateDiagramModel } from './validate.js';
import { diagramMessage } from './i18n.js';

export function renderDiagramFigure(value: unknown, options: DiagramLayoutOptions = {}): string {
  const model = validateDiagramModel(value);
  const scene = layoutDiagram(model, options);
  const transcript = renderDiagramTranscriptText(model, options.messages);
  const figureId = `pinega-figure-${model.id}`;
  return [
    `<pinega-diagram-viewer data-diagram-id="${escapeAttribute(model.id)}" data-pinega-locale="${escapeAttribute(options.locale ?? 'en')}">`,
    `<figure class="pinega-semantic-diagram" id="${escapeAttribute(figureId)}" data-diagram-id="${escapeAttribute(model.id)}" data-diagram-kind="${escapeAttribute(model.kind)}" data-layout-profile="${escapeAttribute(scene.layoutProfile)}">`,
    `<div class="pinega-diagram-viewport" tabindex="0" role="region" aria-label="${escapeAttribute(diagramMessage(options.messages, 'viewport', { title: model.title }))}">`,
    renderSceneSvg(scene),
    '</div>',
    `<figcaption>${escapeText(model.caption)}</figcaption>`,
    '<details class="pinega-diagram-transcript">',
    `<summary>${escapeText(diagramMessage(options.messages, 'transcript_summary'))}</summary>`,
    `<pre tabindex="0"><code>${escapeText(transcript)}</code></pre>`,
    `<a href="${escapeAttribute(options.modelHref ?? `/diagrams/models/${model.id}.json`)}" download>${escapeText(diagramMessage(options.messages, 'download_model'))}</a>`,
    '<div data-pinega-island-root hidden></div>',
    '</details>',
    '</figure>',
    '</pinega-diagram-viewer>',
  ].join('');
}

export function renderDiagramSvg(value: unknown, options: DiagramLayoutOptions = {}): string {
  const model = validateDiagramModel(value);
  return renderSceneSvg(layoutDiagram(model, options));
}

export function renderDiagramAuthoringSvg(value: unknown, options: AuthoringSvgOptions = {}): string {
  const model = validateDiagramModel(value);
  return renderSceneAuthoringSvg(layoutDiagram(model, options), options);
}

export function renderDiagramScene(value: unknown, options: DiagramLayoutOptions = {}): DiagramScene {
  return layoutDiagram(validateDiagramModel(value), options);
}
