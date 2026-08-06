// CeTZ and textual renderers for the shared row-version-chain model.
#import "@preview/cetz:0.5.2"
#import cetz.draw: line, rect, circle
#import "version-chain-model.typ" as model
#import "common.typ": require
#import "theme.typ": diagram-theme, tone-paint, tone-fill
#import "primitives.typ": (stroke-style, vector-canvas, arrow, canvas-label, diagram-figure, text-fallback)
#let version-node = model.version-node
#let version-snapshot = model.version-snapshot
#let version-chain-model = model.version-chain-model
#let _tone(state) = if state == "visible" { "inferred" } else if state == "obsolete" { "warning" } else if state == "retired" { "pending" } else if state == "uncommitted" { "event" } else { "danger" }
#let render-version-chain(chain, theme: diagram-theme(), scale: 0.76) = {
  require(chain.kind == "version-chain-model", "render-version-chain: expected version-chain-model()")
  let left = 0.38
  let node-width = 2.22
  let node-height = 1.38
  let gap = 0.82
  let x-of = index => left + index * (node-width + gap)
  let selected-index = chain.versions.position(version => version.id == chain.snapshot.visible_version)
  let right = x-of(chain.versions.len() - 1) + node-width
  vector-canvas({
    canvas-label((left, 2.34), chain.title, theme: theme, anchor: "west", size: 7.1pt, weight: "bold", fill: theme.primary, inset: 0pt)
    canvas-label((left, 2.05), chain.subject, theme: theme, anchor: "west", font: theme.mono-font, size: 5.4pt, fill: theme.muted, inset: 0pt)
    for (index, version) in chain.versions.enumerate() {
      let x = x-of(index)
      let tone = _tone(version.state)
      let paint = tone-paint(tone, theme: theme)
      let selected = version.id == chain.snapshot.visible_version
      let fill = if selected { tone-fill(tone, theme: theme) } else { theme.paper }
      rect((x, 0), (x + node-width, node-height), radius: 0.035, fill: fill, stroke: stroke-style(paint, if selected { theme.strong-edge } else { theme.edge }, dash: if version.state == "retired" { "dashed" } else { none }))
      line((x + 0.13, 0.98), (x + node-width - 0.13, 0.98), stroke: stroke-style(theme.rule, theme.hairline))
      canvas-label((x + 0.14, 1.19), version.label, theme: theme, anchor: "west", font: theme.mono-font, size: 6.4pt, weight: "bold", fill: theme.primary, inset: 0pt)
      canvas-label((x + node-width - 0.14, 1.19), upper(version.state), theme: theme, anchor: "east", font: theme.mono-font, size: 4.55pt, weight: "bold", fill: paint, inset: 0pt)
      canvas-label((x + 0.14, 0.74), version.payload, theme: theme, anchor: "west", font: theme.mono-font, size: 5.7pt, weight: "bold", fill: theme.ink, inset: 0pt)
      canvas-label((x + 0.14, 0.43), [xmin #version.created_by #h(4pt)·#h(4pt) xmax #if version.deleted_by == none { [—] } else { version.deleted_by }], theme: theme, anchor: "west", font: theme.mono-font, size: 4.75pt, fill: theme.muted, inset: 0pt)
      canvas-label((x + 0.14, 0.19), [generation #version.generation], theme: theme, anchor: "west", font: theme.mono-font, size: 4.7pt, fill: theme.muted, inset: 0pt)
      if version.note != none { canvas-label((x + node-width / 2, -0.16), emph(version.note), theme: theme, anchor: "north", size: 4.55pt, fill: paint, background: theme.paper, inset: (x: 1.2pt, y: 0.2pt)) }
      if index < chain.versions.len() - 1 {
        arrow((x + node-width + 0.09, node-height / 2), (x + node-width + gap - 0.09, node-height / 2), paint: theme.primary, thickness: theme.edge)
        canvas-label((x + node-width + gap / 2, node-height / 2 + 0.20), [older], theme: theme, anchor: "center", font: theme.mono-font, size: 4.6pt, fill: theme.muted, background: theme.paper, inset: (x: 1.2pt, y: 0.2pt))
      }
    }
    let head-x = x-of(0) + node-width / 2
    canvas-label((head-x, 1.86), chain.head_label, theme: theme, anchor: "south", font: theme.mono-font, size: 5.0pt, weight: "bold", fill: theme.primary, background: theme.paper, inset: (x: 1.4pt, y: 0.3pt))
    arrow((head-x, 1.80), (head-x, 1.48), paint: theme.primary, thickness: theme.edge)
    let evaluation-y = -0.80
    canvas-label((left, evaluation-y), [#chain.snapshot.label #h(3pt)·#h(3pt) visibility evaluation], theme: theme, anchor: "west", size: 5.7pt, weight: "bold", fill: theme.inferred, inset: 0pt)
    line((left, evaluation-y - 0.18), (right, evaluation-y - 0.18), stroke: stroke-style(theme.rule, theme.hairline))
    for (index, version) in chain.versions.enumerate() {
      let x = x-of(index) + node-width / 2
      let selected = version.id == chain.snapshot.visible_version
      let paint = if selected { theme.inferred } else { theme.muted }
      circle((x, evaluation-y - 0.18), radius: if selected { 0.065 } else { 0.050 }, fill: if selected { paint } else { theme.paper }, stroke: stroke-style(paint, theme.hairline))
      canvas-label((x, evaluation-y - 0.48), if selected { [selected] } else { [not selected] }, theme: theme, anchor: "center", font: theme.mono-font, size: 4.45pt, weight: if selected { "bold" } else { "regular" }, fill: paint, inset: 0pt)
    }
    let selected-x = x-of(selected-index) + node-width / 2
    canvas-label((selected-x, evaluation-y - 0.78), box(width: 3.0cm)[#chain.snapshot.note], theme: theme, anchor: "north", size: 4.45pt, fill: theme.muted, inset: 0pt)
  }, scale: scale)
}
#let version-chain-text(chain, theme: diagram-theme()) = { require(chain.kind == "version-chain-model", "version-chain-text: expected version-chain-model()"); text-fallback(model.version-chain-text-lines(chain), theme: theme) }
#let version-chain-figure(chain, theme: diagram-theme(), scale: 0.76) = diagram-figure(render-version-chain(chain, theme: theme, scale: scale), chain.caption, chain.description)
