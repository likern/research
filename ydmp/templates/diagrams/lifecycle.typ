// CeTZ and textual renderers for concurrent object lifecycle models.

#import "@preview/cetz:0.5.2"
#import cetz.draw: rect
#import "lifecycle-model.typ" as model
#import "common.typ": require
#import "theme.typ": diagram-theme, tone-paint, tone-fill
#import "primitives.typ": (
  stroke-style, vector-canvas, arrow, poly-arrow, canvas-label,
  diagram-figure, text-fallback,
)

#let lifecycle-state = model.lifecycle-state
#let lifecycle-transition = model.lifecycle-transition
#let lifecycle-model = model.lifecycle-model

#let render-lifecycle(lifecycle, theme: diagram-theme(), scale: 1.08) = {
  require(lifecycle.kind == "lifecycle-model", "render-lifecycle: expected lifecycle-model()")

  let columns = 3
  let node_width = 2.25
  let node_height = 1.30
  let column_gap = 1.30
  let top_y = 2.35
  let bottom_y = 0.05
  let origin_x = 0.55
  let position = index => {
    let column = if index < columns { index } else { columns - 1 - calc.rem(index, columns) }
    let y = if index < columns { top_y } else { bottom_y }
    (origin_x + column * (node_width + column_gap), y)
  }
  let state_index = id => lifecycle.states.position(state => state.id == id)

  vector-canvas({
    canvas-label(
      (origin_x, 4.25),
      lifecycle.title,
      theme: theme,
      anchor: "west",
      size: 7.5pt,
      weight: "bold",
      fill: theme.primary,
      inset: 0pt,
    )
    canvas-label(
      (origin_x, 3.96),
      lifecycle.subject,
      theme: theme,
      anchor: "west",
      font: theme.mono-font,
      size: 5.5pt,
      fill: theme.muted,
      inset: 0pt,
    )

    for (index, state) in lifecycle.states.enumerate() {
      let pos = position(index)
      let x = pos.first()
      let y = pos.last()
      let paint = tone-paint(state.tone, theme: theme)
      rect(
        (x, y),
        (x + node_width, y + node_height),
        radius: 0.12,
        fill: tone-fill(state.tone, theme: theme),
        stroke: stroke-style(
          paint,
          if state.id == lifecycle.initial { theme.strong-edge } else { theme.edge },
          dash: if state.id == "retired" { "dashed" } else { none },
        ),
      )
      if state.id == lifecycle.initial {
        canvas-label(
          (x + node_width / 2, y + node_height + 0.18),
          [INITIAL],
          theme: theme,
          anchor: "south",
          font: theme.mono-font,
          size: 4.7pt,
          weight: "bold",
          fill: paint,
          background: theme.paper,
          stroke: (paint: paint, thickness: theme.hairline),
          radius: 3pt,
          inset: (x: 2pt, y: 0.6pt),
        )
      }
      canvas-label(
        (x + node_width / 2, y + 0.88),
        state.label,
        theme: theme,
        anchor: "center",
        size: 6.2pt,
        weight: "bold",
        fill: paint,
        inset: 0pt,
      )
      canvas-label(
        (x + node_width / 2, y + 0.39),
        box(width: 1.55cm)[#align(center)[#state.description]],
        theme: theme,
        anchor: "center",
        size: 4.5pt,
        fill: theme.muted,
        inset: 0pt,
      )
    }

    for transition in lifecycle.transitions {
      let from_index = state_index(transition.from)
      let to_index = state_index(transition.to)
      let from_pos = position(from_index)
      let to_pos = position(to_index)
      let from_x = from_pos.first()
      let from_y = from_pos.last()
      let to_x = to_pos.first()
      let to_y = to_pos.last()
      let paint = tone-paint(transition.tone, theme: theme)

      if from_y == to_y {
        let rightward = to_x > from_x
        let start_x = if rightward { from_x + node_width + 0.07 } else { from_x - 0.07 }
        let end_x = if rightward { to_x - 0.07 } else { to_x + node_width + 0.07 }
        let center_x = (start_x + end_x) / 2
        let center_y = from_y + node_height / 2
        arrow(
          (start_x, center_y),
          (end_x, center_y),
          paint: paint,
          thickness: theme.edge,
        )
        canvas-label(
          (center_x, center_y + 0.30),
          box(width: 1.05cm)[#align(center)[#transition.label]],
          theme: theme,
          anchor: "center",
          font: theme.mono-font,
          size: 4.4pt,
          weight: "bold",
          fill: paint,
          background: theme.paper,
          inset: (x: 1pt, y: 0.4pt),
        )
        if transition.guard != none {
          canvas-label(
            (center_x, center_y - 0.31),
            box(width: 1.05cm)[#align(center)[#transition.guard]],
            theme: theme,
            anchor: "center",
            font: theme.mono-font,
            size: 4.0pt,
            fill: theme.muted,
            background: theme.paper,
            inset: (x: 1pt, y: 0.3pt),
          )
        }
      } else if from_x == to_x and to_y < from_y {
        let center_x = from_x + node_width / 2
        let start_y = from_y - 0.07
        let end_y = to_y + node_height + 0.07
        let center_y = (start_y + end_y) / 2
        arrow(
          (center_x, start_y),
          (center_x, end_y),
          paint: paint,
          thickness: theme.edge,
        )
        canvas-label(
          (center_x + 0.30, center_y + 0.13),
          box(width: 1.35cm)[#align(left)[#transition.label]],
          theme: theme,
          anchor: "west",
          font: theme.mono-font,
          size: 4.4pt,
          weight: "bold",
          fill: paint,
          background: theme.paper,
          inset: (x: 1pt, y: 0.4pt),
        )
        if transition.guard != none {
          canvas-label(
            (center_x + 0.30, center_y - 0.20),
            box(width: 1.35cm)[#align(left)[#transition.guard]],
            theme: theme,
            anchor: "west",
            font: theme.mono-font,
            size: 4.0pt,
            fill: theme.muted,
            background: theme.paper,
            inset: (x: 1pt, y: 0.3pt),
          )
        }
      } else {
        let route_x = origin_x - 0.43
        let source_y = from_y + node_height / 2
        let target_y = to_y + node_height / 2
        poly-arrow(
          (
            (from_x - 0.07, source_y),
            (route_x, source_y),
            (route_x, target_y),
            (to_x - 0.07, target_y),
          ),
          paint: paint,
          thickness: theme.edge,
        )
        canvas-label(
          (route_x + 0.13, (source_y + target_y) / 2 + 0.16),
          box(width: 1.30cm)[#align(left)[#transition.label]],
          theme: theme,
          anchor: "west",
          font: theme.mono-font,
          size: 4.4pt,
          weight: "bold",
          fill: paint,
          background: theme.paper,
          inset: (x: 1pt, y: 0.4pt),
        )
        if transition.guard != none {
          canvas-label(
            (route_x + 0.13, (source_y + target_y) / 2 - 0.20),
            box(width: 1.30cm)[#align(left)[#transition.guard]],
            theme: theme,
            anchor: "west",
            font: theme.mono-font,
            size: 4.0pt,
            fill: theme.muted,
            background: theme.paper,
            inset: (x: 1pt, y: 0.3pt),
          )
        }
      }
    }
  }, scale: scale)
}

#let lifecycle-text(lifecycle, theme: diagram-theme()) = {
  require(lifecycle.kind == "lifecycle-model", "lifecycle-text: expected lifecycle-model()")
  text-fallback(model.lifecycle-text-lines(lifecycle), theme: theme)
}

#let lifecycle-figure(lifecycle, theme: diagram-theme(), scale: 1.08) = diagram-figure(
  render-lifecycle(lifecycle, theme: theme, scale: scale),
  lifecycle.caption,
  lifecycle.description,
)
