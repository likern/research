// CeTZ and textual renderers for the shared row-version-chain model.

#import "@preview/cetz:0.5.2"
#import cetz.draw: rect
#import "version-chain-model.typ" as model
#import "common.typ": require
#import "theme.typ": diagram-theme, tone-paint, tone-fill
#import "primitives.typ": (
  stroke-style, vector-canvas, arrow, canvas-label,
  diagram-figure, text-fallback,
)

#let version-node = model.version-node
#let version-snapshot = model.version-snapshot
#let version-chain-model = model.version-chain-model

#let _tone(state) = if state == "visible" {
  "inferred"
} else if state == "obsolete" {
  "warning"
} else if state == "retired" {
  "pending"
} else if state == "uncommitted" {
  "event"
} else {
  "danger"
}

#let render-version-chain(chain, theme: diagram-theme(), scale: 0.72) = {
  require(chain.kind == "version-chain-model", "render-version-chain: expected version-chain-model()")

  let left = 0.45
  let node_width = 2.18
  let node_height = 1.76
  let gap = 0.82
  let x_of = index => left + index * (node_width + gap)
  let selected_index = chain.versions.position(version => version.id == chain.snapshot.visible_version)

  vector-canvas({
    canvas-label(
      (left, 2.48),
      chain.title,
      theme: theme,
      anchor: "west",
      size: 7.2pt,
      weight: "bold",
      fill: theme.primary,
      inset: 0pt,
    )
    canvas-label(
      (left, 2.17),
      chain.subject,
      theme: theme,
      anchor: "west",
      font: theme.mono-font,
      size: 5.6pt,
      fill: theme.muted,
      inset: 0pt,
    )

    for (index, version) in chain.versions.enumerate() {
      let x = x_of(index)
      let tone = _tone(version.state)
      let paint = tone-paint(tone, theme: theme)
      let fill = tone-fill(tone, theme: theme)
      let selected = version.id == chain.snapshot.visible_version

      rect(
        (x, 0),
        (x + node_width, node_height),
        radius: 0.12,
        fill: fill,
        stroke: stroke-style(
          paint,
          if selected { theme.strong-edge } else { theme.edge },
          dash: if version.state == "retired" { "dashed" } else { none },
        ),
      )
      canvas-label(
        (x + 0.15, 1.52),
        version.label,
        theme: theme,
        anchor: "west",
        font: theme.mono-font,
        size: 6.4pt,
        weight: "bold",
        fill: paint,
        inset: 0pt,
      )
      canvas-label(
        (x + node_width - 0.13, 1.52),
        version.state,
        theme: theme,
        anchor: "east",
        font: theme.mono-font,
        size: 4.8pt,
        weight: "bold",
        fill: paint,
        background: theme.paper,
        stroke: (paint: paint, thickness: theme.hairline),
        radius: 3pt,
        inset: (x: 2.2pt, y: 0.8pt),
      )
      canvas-label(
        (x + 0.15, 1.12),
        version.payload,
        theme: theme,
        anchor: "west",
        font: theme.mono-font,
        size: 5.6pt,
        weight: "bold",
        fill: theme.ink,
        inset: 0pt,
      )
      canvas-label((x + 0.15, 0.78), [xmin  #version.created_by], theme: theme, anchor: "west", font: theme.mono-font, size: 5.0pt, fill: theme.muted, inset: 0pt)
      canvas-label((x + 0.15, 0.53), [xmax  #if version.deleted_by == none { [—] } else { version.deleted_by }], theme: theme, anchor: "west", font: theme.mono-font, size: 5.0pt, fill: theme.muted, inset: 0pt)
      canvas-label((x + 0.15, 0.28), [gen   #version.generation], theme: theme, anchor: "west", font: theme.mono-font, size: 5.0pt, fill: theme.muted, inset: 0pt)

      if version.note != none {
        canvas-label(
          (x + node_width / 2, -0.17),
          version.note,
          theme: theme,
          anchor: "north",
          size: 4.8pt,
          fill: paint,
          background: theme.paper,
          inset: (x: 1.4pt, y: 0.3pt),
        )
      }

      if index < chain.versions.len() - 1 {
        arrow(
          (x + node_width + 0.08, node_height / 2),
          (x + node_width + gap - 0.08, node_height / 2),
          paint: theme.primary,
          thickness: theme.edge,
        )
        canvas-label(
          (x + node_width + gap / 2, node_height / 2 + 0.23),
          [older],
          theme: theme,
          anchor: "center",
          font: theme.mono-font,
          size: 4.8pt,
          fill: theme.muted,
          background: theme.paper,
        )
      }
    }

    let head_x = x_of(0) + node_width / 2
    canvas-label(
      (head_x, 2.02),
      chain.head_label,
      theme: theme,
      anchor: "south",
      font: theme.mono-font,
      size: 5.2pt,
      weight: "bold",
      fill: theme.primary,
      background: theme.paper,
      stroke: (paint: theme.primary, thickness: theme.hairline),
      radius: 4pt,
      inset: (x: 3pt, y: 1pt),
    )
    arrow((head_x, 1.98), (head_x, 1.82), paint: theme.primary, thickness: theme.edge)

    let selected_x = x_of(selected_index) + node_width / 2
    let snapshot_x = calc.max(left, selected_x - 1.35)
    rect(
      (snapshot_x, -1.37),
      (snapshot_x + 2.70, -0.60),
      radius: 0.10,
      fill: tone-fill("inferred", theme: theme),
      stroke: stroke-style(theme.inferred, theme.edge),
    )
    canvas-label((snapshot_x + 0.15, -0.82), chain.snapshot.label, theme: theme, anchor: "west", size: 5.8pt, weight: "bold", fill: theme.inferred, inset: 0pt)
    canvas-label((snapshot_x + 0.15, -1.13), box(width: 2.25cm)[#chain.snapshot.note], theme: theme, anchor: "west", size: 4.6pt, fill: theme.muted, inset: 0pt)
    arrow(
      (snapshot_x + 1.35, -0.58),
      (selected_x, -0.06),
      paint: theme.inferred,
      thickness: theme.strong-edge,
    )
  }, scale: scale)
}

#let version-chain-text(chain, theme: diagram-theme()) = {
  require(chain.kind == "version-chain-model", "version-chain-text: expected version-chain-model()")
  text-fallback(model.version-chain-text-lines(chain), theme: theme)
}

#let version-chain-figure(chain, theme: diagram-theme(), scale: 0.72) = diagram-figure(
  render-version-chain(chain, theme: theme, scale: scale),
  chain.caption,
  chain.description,
)
