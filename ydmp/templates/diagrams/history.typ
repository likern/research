// Vector and textual renderers for semantic concurrent histories.
//
// The public API re-exports model constructors, then applies deterministic
// lane and time-axis layout. Documents never position CeTZ primitives directly.

#import "@preview/cetz:0.5.2"
#import cetz.draw: line, rect, circle
#import "history-model.typ" as model
#import "common.typ": require
#import "theme.typ": diagram-theme, tone-paint, tone-fill
#import "primitives.typ": (
  stroke-style, vector-canvas, arrow, poly-arrow, canvas-label,
  tone-chip, diagram-figure, text-fallback,
)

#let history-lane = model.history-lane
#let history-operation = model.history-operation
#let history-marker = model.history-marker
#let history-witness = model.history-witness
#let history-precedence = model.history-precedence
#let history-model = model.history-model

#let _operation-end(operation, history) = if operation.end == none {
  history.horizon
} else {
  operation.end
}

#let _operation-body(operation) = if operation.result == none {
  operation.call
} else {
  [#operation.call #h(2pt) #sym.arrow.r #h(2pt) #operation.result]
}

#let _render-linearization(operation, x-of, y, theme) = {
  if operation.linearization == none { return }
  if type(operation.linearization) in (int, float) {
    let x = x-of(operation.linearization)
    line(
      (x, y - theme.operation-height / 2 - 0.11),
      (x, y + theme.operation-height / 2 + 0.11),
      stroke: stroke-style(theme.event, theme.strong-edge),
    )
    canvas-label(
      (x, y + theme.operation-height / 2 + 0.15),
      [LP],
      theme: theme,
      anchor: "south",
      font: theme.mono-font,
      size: 5.2pt,
      weight: "bold",
      fill: theme.event,
      background: theme.paper,
      inset: (x: 1.4pt, y: 0.3pt),
    )
  } else {
    let start-x = x-of(operation.linearization.first())
    let end-x = x-of(operation.linearization.last())
    rect(
      (start-x, y - theme.operation-height / 2 - 0.07),
      (end-x, y + theme.operation-height / 2 + 0.07),
      radius: 0.04,
      fill: none,
      stroke: stroke-style(theme.event, theme.strong-edge, dash: "dotted"),
    )
    canvas-label(
      ((start-x + end-x) / 2, y + theme.operation-height / 2 + 0.14),
      [LP?],
      theme: theme,
      anchor: "south",
      font: theme.mono-font,
      size: 5.1pt,
      weight: "bold",
      fill: theme.event,
      background: theme.paper,
      inset: (x: 1.4pt, y: 0.3pt),
    )
  }
}

#let _render-operation(operation, history, x-of, lane-y, theme) = {
  let y = lane-y(operation.lane)
  let x1 = x-of(operation.start)
  let x2 = x-of(_operation-end(operation, history))
  let paint = tone-paint(operation.tone, theme: theme)
  let pending = operation.end == none
  let fill = if pending { theme.paper } else { tone-fill(operation.tone, theme: theme) }
  let dash = if pending { "dashed" } else { none }
  let thickness = if operation.tone in ("danger", "invalid") {
    theme.strong-edge
  } else {
    theme.edge
  }

  rect(
    (x1, y - theme.operation-height / 2),
    (x2, y + theme.operation-height / 2),
    radius: 0.11,
    fill: fill,
    stroke: stroke-style(paint, thickness, dash: dash),
  )
  circle(
    (x1, y),
    radius: theme.event-radius,
    fill: paint,
    stroke: none,
  )

  if pending {
    arrow(
      (x2 - 0.23, y),
      (x2 + 0.02, y),
      paint: paint,
      thickness: theme.edge,
      dash: "dashed",
    )
    tone-chip(
      (x2 - 0.02, y + 0.34),
      [PENDING],
      tone: "pending",
      theme: theme,
      anchor: "south-east",
    )
  } else {
    circle(
      (x2, y),
      radius: theme.event-radius,
      fill: theme.paper,
      stroke: stroke-style(paint, theme.edge),
    )
  }

  canvas-label(
    ((x1 + x2) / 2, y),
    _operation-body(operation),
    theme: theme,
    font: theme.mono-font,
    size: 6.05pt,
    weight: "bold",
    fill: theme.ink,
    background: fill,
    inset: (x: 2pt, y: 0.7pt),
  )

  _render-linearization(operation, x-of, y, theme)

  if operation.note != none {
    canvas-label(
      ((x1 + x2) / 2, y - theme.operation-height / 2 - 0.16),
      operation.note,
      theme: theme,
      anchor: "north",
      font: theme.body-font,
      size: 5.5pt,
      fill: theme.muted,
      background: theme.paper,
      inset: (x: 1.4pt, y: 0.4pt),
    )
  }

  if operation.tone in ("danger", "invalid") {
    canvas-label(
      (x2 + 0.13, y),
      [×],
      theme: theme,
      anchor: "west",
      font: theme.sans-font,
      size: 9pt,
      weight: "bold",
      fill: theme.danger,
      inset: 0pt,
    )
  }
}

#let _render-precedence(history, x-of, top-y, theme) = {
  for (index, edge) in history.precedence.enumerate() {
    let from = model.operation-by-id(history, edge.from)
    let to = model.operation-by-id(history, edge.to)
    let source-time = if from.end == none { from.start } else { from.end }
    let y = top-y + 0.32 + index * 0.20
    let paint = tone-paint(edge.tone, theme: theme)
    poly-arrow(
      (
        (x-of(source-time), top-y - 0.08),
        (x-of(source-time), y),
        (x-of(to.start), y),
      ),
      paint: paint,
      thickness: theme.hairline,
      dash: if edge.tone == "muted" { "dashed" } else { none },
    )
    if edge.label != none {
      canvas-label(
        ((x-of(source-time) + x-of(to.start)) / 2, y + 0.04),
        edge.label,
        theme: theme,
        anchor: "south",
        font: theme.mono-font,
        size: 5.1pt,
        weight: "bold",
        fill: paint,
        background: theme.paper,
      )
    }
  }
}

#let render-history(history, theme: diagram-theme(), scale: 1.0, legend: true) = {
  require(history.kind == "history-model", "render-history: expected history-model()")

  let left = 1.12
  let duration = history.horizon - history.start
  let x-of = time => left + (time - history.start) * theme.timeline-unit
  let right = x-of(history.horizon)
  let lane-count = history.lanes.len()
  let lane-y = lane-id => {
    let index = history.lanes.position(lane => lane.id == lane-id)
    (lane-count - index - 1) * theme.lane-gap
  }
  let top-lane-y = (lane-count - 1) * theme.lane-gap
  let title-y = top-lane-y + 0.84 + history.precedence.len() * 0.20
  let bottom-y = -0.67

  vector-canvas({
    if history.title != none {
      canvas-label(
        (left, title-y + 0.56),
        history.title,
        theme: theme,
        anchor: "west",
        font: theme.sans-font,
        size: 7.0pt,
        weight: "bold",
        fill: theme.primary,
        inset: 0pt,
      )
    }

    for lane in history.lanes {
      let y = lane-y(lane.id)
      canvas-label(
        (0.05, y),
        lane.label,
        theme: theme,
        anchor: "west",
        font: theme.mono-font,
        size: 6.9pt,
        weight: "bold",
        fill: theme.primary,
        inset: 0pt,
      )
      arrow(
        (left, y),
        (right, y),
        paint: theme.rule,
        thickness: theme.hairline,
      )
    }

    for marker in history.markers {
      let x = x-of(marker.time)
      let paint = tone-paint(marker.tone, theme: theme)
      line(
        (x, bottom-y + 0.17),
        (x, title-y),
        stroke: stroke-style(
          paint,
          theme.hairline,
          dash: if marker.pattern == "solid" { none } else { marker.pattern },
        ),
      )
      canvas-label(
        (x, title-y + 0.04),
        marker.label,
        theme: theme,
        anchor: "south",
        font: theme.mono-font,
        size: 5.5pt,
        weight: "bold",
        fill: paint,
        background: theme.paper,
      )
    }

    _render-precedence(history, x-of, top-lane-y + 0.42, theme)

    for operation in history.operations {
      _render-operation(operation, history, x-of, lane-y, theme)
    }

    if legend {
      canvas-label(
        (left, bottom-y),
        [● invocation   ○ response   │ linearization   ⇢ pending],
        theme: theme,
        anchor: "west",
        font: theme.mono-font,
        size: 5.25pt,
        fill: theme.muted,
        background: theme.paper,
        inset: 0pt,
      )
    }
  }, scale: scale)
}

#let _witness-chip(operation, theme) = box(
  inset: (x: 4pt, y: 2pt),
  radius: 3pt,
  fill: tone-fill(operation.tone, theme: theme),
  stroke: (
    paint: tone-paint(operation.tone, theme: theme),
    thickness: theme.hairline,
  ),
  text(
    font: theme.mono-font,
    size: 5.7pt,
    weight: "bold",
    fill: theme.ink,
    _operation-body(operation),
  ),
)

#let render-witnesses(history, theme: diagram-theme()) = {
  require(history.kind == "history-model", "render-witnesses: expected history-model()")
  if history.witnesses.len() == 0 { return none }

  block(width: 100%)[
    #for witness in history.witnesses [
      #grid(
        columns: (auto, 1fr),
        column-gutter: 7pt,
        align: (left, center),
        text(
          font: theme.mono-font,
          size: 5.8pt,
          weight: "bold",
          fill: tone-paint(witness.tone, theme: theme),
          witness.label,
        ),
        box()[
          #for (index, operation-id) in witness.operations.enumerate() [
            #let operation = model.operation-by-id(history, operation-id)
            #_witness-chip(operation, theme)
            #if index < witness.operations.len() - 1 [
              #h(3pt)#text(size: 6pt, fill: theme.muted)[→]#h(3pt)
            ]
          ]
        ],
      )
      #v(4pt)
    ]
  ]
}

#let render-history-with-witnesses(history, theme: diagram-theme(), scale: 1.0) = block(
  width: 100%,
)[
  #render-history(history, theme: theme, scale: scale)
  #v(4pt)
  #render-witnesses(history, theme: theme)
]

#let history-text(history, theme: diagram-theme()) = {
  require(history.kind == "history-model", "history-text: expected history-model()")
  text-fallback(model.history-text-lines(history), theme: theme)
}

#let history-figure(history, caption, alt, theme: diagram-theme(), scale: 1.0) = diagram-figure(
  render-history-with-witnesses(history, theme: theme, scale: scale),
  caption,
  alt,
)
