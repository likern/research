// Vector and textual renderers for linked concurrent queue states.
//
// The renderer preserves node identity and horizontal position across panels,
// making publication, helping, pointer lag, and retirement visible without
// encoding those semantics in raw coordinates.

#import "@preview/cetz:0.5.2"
#import cetz.draw: line, rect
#import "queue-model.typ" as model
#import "common.typ": require
#import "theme.typ": diagram-theme, tone-paint, tone-fill
#import "primitives.typ": (
  stroke-style, vector-canvas, arrow, canvas-label, tone-chip,
  diagram-figure, text-fallback,
)

#let queue-node = model.queue-node
#let queue-pointer = model.queue-pointer
#let queue-state = model.queue-state

#let _node-visual(node) = {
  if node.state in ("candidate", "new") {
    (tone: "event", badge: if node.state == "candidate" { [private] } else { [new] })
  } else if node.state == "retired" {
    (tone: "retired", badge: [retired])
  } else if node.state == "marked" {
    (tone: "danger", badge: [marked])
  } else if node.state == "unlinked" {
    (tone: "muted", badge: [unlinked])
  } else if node.sentinel {
    (tone: "primary", badge: [dummy])
  } else {
    (tone: "neutral", badge: none)
  }
}

#let _pointer-body(pointer) = if pointer.count == none {
  pointer.label
} else {
  [#pointer.label<#pointer.target,#pointer.count>]
}

#let render-queue-state(state, theme: diagram-theme(), scale: 1.0) = {
  require(state.kind == "queue-state", "render-queue-state: expected queue-state()")

  let data-width = theme.node-data-width
  let next-width = theme.node-next-width
  let node-width = data-width + next-width
  let node-height = theme.node-height
  let step = node-width + theme.node-gap
  let node-x = node-id => state.order.position(id => id == node-id) * step
  let node-center = node-id => node-x(node-id) + node-width / 2
  let right = (state.order.len() - 1) * step + node-width

  vector-canvas({
    // Links are drawn first so node bodies and pointer labels remain dominant.
    for node-id in state.order {
      let node = model.node-by-id(state, node-id)
      let x = node-x(node.id)
      if node.next == none {
        line(
          (x + node-width, 0),
          (x + node-width + 0.30, 0),
          stroke: stroke-style(theme.muted, theme.hairline),
        )
        canvas-label(
          (x + node-width + 0.36, 0),
          [NULL],
          theme: theme,
          anchor: "west",
          font: theme.mono-font,
          size: 5.2pt,
          fill: theme.muted,
          inset: 0pt,
        )
      } else {
        let target-x = node-x(node.next)
        let focused = state.focus-edge == (node.id, node.next)
        let paint = if focused { theme.event } else if node.state == "retired" { theme.muted } else { theme.ink }
        arrow(
          (x + node-width, 0),
          (target-x, 0),
          paint: paint,
          thickness: if focused { theme.strong-edge } else { theme.edge },
          dash: if node.state == "retired" { "dashed" } else { none },
        )
        if focused {
          tone-chip(
            ((x + node-width + target-x) / 2, 0.24),
            if state.focus-label == none { [CAS] } else { state.focus-label },
            tone: "event",
            theme: theme,
            anchor: "south",
          )
        }
      }
    }

    for node-id in state.order {
      let node = model.node-by-id(state, node-id)
      let x = node-x(node.id)
      let visual = _node-visual(node)
      let paint = tone-paint(visual.tone, theme: theme)
      let fill = if visual.tone == "neutral" { theme.paper } else { tone-fill(visual.tone, theme: theme) }
      let focused = state.focus-node == node.id
      let border = if focused { theme.event } else { paint }
      let border-width = if focused { theme.strong-edge } else { theme.edge }
      let dash = if node.state in ("retired", "unlinked") { "dashed" } else { none }

      rect(
        (x, -node-height / 2),
        (x + node-width, node-height / 2),
        radius: 0.12,
        fill: fill,
        stroke: stroke-style(border, border-width, dash: dash),
      )
      line(
        (x + data-width, -node-height / 2),
        (x + data-width, node-height / 2),
        stroke: stroke-style(border, theme.hairline, dash: dash),
      )

      canvas-label(
        (x + data-width / 2, 0),
        node.value,
        theme: theme,
        font: theme.mono-font,
        size: 6.8pt,
        weight: "bold",
        fill: theme.ink,
        inset: 0pt,
      )
      canvas-label(
        (x + data-width + next-width / 2, 0),
        [next],
        theme: theme,
        font: theme.mono-font,
        size: 5.1pt,
        weight: "bold",
        fill: theme.muted,
        inset: 0pt,
      )
      canvas-label(
        (x + node-width / 2, -node-height / 2 - 0.10),
        node.id,
        theme: theme,
        anchor: "north",
        font: theme.mono-font,
        size: 5.2pt,
        fill: theme.muted,
        inset: 0pt,
      )

      if visual.badge != none {
        tone-chip(
          (x + node-width / 2, node-height / 2 + 0.10),
          visual.badge,
          tone: visual.tone,
          theme: theme,
          anchor: "south",
        )
      }
      if node.note != none {
        canvas-label(
          (x + node-width / 2, -node-height / 2 - 0.32),
          node.note,
          theme: theme,
          anchor: "north",
          font: theme.body-font,
          size: 5.2pt,
          fill: theme.muted,
          background: theme.paper,
        )
      }
    }

    for pointer in state.pointers {
      let target-x = node-center(pointer.target)
      let x = target-x + pointer.slot * 0.23
      let above = pointer.side == "above"
      let y = if above {
        1.18 + calc.abs(pointer.slot) * 0.12
      } else {
        -1.02 - calc.abs(pointer.slot) * 0.12
      }
      let focused = state.focus-pointer == pointer.id
      let paint = if focused { theme.event } else { tone-paint(pointer.tone, theme: theme) }
      let target-y = if above { node-height / 2 + 0.03 } else { -node-height / 2 - 0.03 }
      let start-y = if above { y - 0.18 } else { y + 0.18 }

      canvas-label(
        (x, y),
        _pointer-body(pointer),
        theme: theme,
        font: theme.mono-font,
        size: 5.35pt,
        weight: "bold",
        fill: paint,
        background: if pointer.scope == "local" { theme.surface } else { theme.paper },
        stroke: (paint: paint, thickness: if focused { theme.strong-edge } else { theme.edge }),
        radius: 4pt,
        inset: (x: 3pt, y: 1.3pt),
      )
      arrow(
        (x, start-y),
        (x, target-y),
        paint: paint,
        thickness: if focused { theme.strong-edge } else { theme.edge },
        dash: if pointer.scope == "local" { "dashed" } else { none },
      )
      if pointer.note != none {
        canvas-label(
          (x + 0.47, y),
          pointer.note,
          theme: theme,
          anchor: "west",
          font: theme.body-font,
          size: 5.0pt,
          fill: theme.muted,
          background: theme.paper,
        )
      }
    }

    if state.transition != none {
      line(
        (0, -1.43),
        (right, -1.43),
        stroke: stroke-style(theme.rule, theme.hairline),
      )
      canvas-label(
        (right / 2, -1.55),
        state.transition,
        theme: theme,
        anchor: "north",
        font: theme.sans-font,
        size: 5.5pt,
        weight: "bold",
        fill: theme.event,
        background: theme.paper,
      )
    }
  }, scale: scale, padding: (0.06, 0.18, 0.25, 0.06))
}

#let queue-state-text(state, theme: diagram-theme()) = {
  require(state.kind == "queue-state", "queue-state-text: expected queue-state()")
  text-fallback(model.queue-text-lines(state), theme: theme)
}

#let queue-state-figure(
  state,
  caption,
  alt,
  theme: diagram-theme(),
  scale: 1.0,
) = diagram-figure(
  render-queue-state(state, theme: theme, scale: scale),
  caption,
  alt,
)
