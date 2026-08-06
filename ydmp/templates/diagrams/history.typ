// Academic vector and textual renderers for semantic concurrent histories.

#import "@preview/cetz:0.5.2"
#import cetz.draw: line, rect, circle
#import "history-model.typ" as model
#import "common.typ": require
#import "theme.typ": diagram-theme, tone-paint
#import "primitives.typ": (
  stroke-style, vector-canvas, arrow, poly-arrow, canvas-label,
  diagram-figure, text-fallback,
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

    circle(
      (x, y),
      radius: 0.105,
      fill: none,
      stroke: stroke-style(theme.event, theme.hairline),
    )
    circle(
      (x, y),
      radius: 0.060,
      fill: theme.event,
      stroke: none,
    )
    line(
      (x, y + 0.11),
      (x, y + 0.32),
      stroke: stroke-style(theme.event, theme.edge),
    )
    canvas-label(
      (x, y + 0.38),
      [LP],
      theme: theme,
      anchor: "south",
      font: theme.mono-font,
      size: 5.4pt,
      weight: "bold",
      fill: theme.event,
      background: theme.paper,
      inset: (x: 1.2pt, y: 0.2pt),
    )
  } else {
    let start-x = x-of(operation.linearization.first())
    let end-x = x-of(operation.linearization.last())

    rect(
      (start-x, y - 0.16),
      (end-x, y + 0.16),
      radius: 0.025,
      fill: none,
      stroke: stroke-style(theme.event, theme.edge, dash: "dotted"),
    )
    canvas-label(
      ((start-x + end-x) / 2, y + 0.24),
      [LP interval],
      theme: theme,
      anchor: "south",
      font: theme.mono-font,
      size: 4.9pt,
      weight: "bold",
      fill: theme.event,
      background: theme.paper,
      inset: (x: 1.2pt, y: 0.2pt),
    )
  }
}

#let _render-operation(operation, history, x-of, lane-y, theme) = {
  let y = lane-y(operation.lane)
  let x1 = x-of(operation.start)
  let x2 = x-of(_operation-end(operation, history))
  let paint = tone-paint(operation.tone, theme: theme)
  let pending = operation.end == none

  line(
    (x1, y),
    (x2, y),
    stroke: stroke-style(
      paint,
      if pending { 2.2pt } else { 3.3pt },
      dash: if pending { "dashed" } else { none },
    ),
  )
  circle(
    (x1, y),
    radius: theme.event-radius,
    fill: paint,
    stroke: none,
  )

  if pending {
    arrow(
      (x2 - 0.20, y),
      (x2 + 0.02, y),
      paint: paint,
      thickness: theme.edge,
      dash: "dashed",
    )
    canvas-label(
      (x2 - 0.02, y + 0.27),
      [PENDING],
      theme: theme,
      anchor: "south-east",
      font: theme.mono-font,
      size: 4.6pt,
      weight: "bold",
      fill: theme.pending,
      background: theme.paper,
      inset: (x: 1.2pt, y: 0.2pt),
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
    ((x1 + x2) / 2, y + 0.24),
    _operation-body(operation),
    theme: theme,
    anchor: "south",
    font: theme.mono-font,
    size: 5.85pt,
    weight: "bold",
    fill: theme.ink,
    background: theme.paper,
    inset: (x: 1.5pt, y: 0.3pt),
  )

  _render-linearization(operation, x-of, y, theme)

  if operation.note != none {
    canvas-label(
      ((x1 + x2) / 2, y - 0.22),
      emph(operation.note),
      theme: theme,
      anchor: "north",
      font: theme.body-font,
      size: 5.25pt,
      fill: theme.muted,
      background: theme.paper,
      inset: (x: 1.2pt, y: 0.2pt),
    )
  }
}

#let _render-precedence(history, x-of, top-lane-y, theme) = {
  for (index, edge) in history.precedence.enumerate() {
    let from = model.operation-by-id(history, edge.from)
    let to = model.operation-by-id(history, edge.to)
    let source-time = if from.end == none { from.start } else { from.end }
    let relation-y = top-lane-y + 0.38 + index * 0.19
    let paint = tone-paint(edge.tone, theme: theme)

    poly-arrow(
      (
        (x-of(source-time), top-lane-y + 0.10),
        (x-of(source-time), relation-y),
        (x-of(to.start), relation-y),
        (x-of(to.start), top-lane-y + 0.10),
      ),
      paint: paint,
      thickness: theme.hairline,
      dash: if edge.tone == "muted" { "dashed" } else { none },
    )

    if edge.label != none {
      canvas-label(
        ((x-of(source-time) + x-of(to.start)) / 2, relation-y + 0.03),
        edge.label,
        theme: theme,
        anchor: "south",
        font: theme.mono-font,
        size: 4.9pt,
        weight: "bold",
        fill: paint,
        background: theme.paper,
        inset: (x: 1.2pt, y: 0.2pt),
      )
    }
  }
}

#let render-history(history, theme: diagram-theme(), scale: 1.0, legend: true) = {
  require(history.kind == "history-model", "render-history: expected history-model()")

  let left = 1.12
  let x-of = time => left + (time - history.start) * theme.timeline-unit
  let right = x-of(history.horizon)
  let lane-count = history.lanes.len()
  let lane-y = lane-id => {
    let index = history.lanes.position(lane => lane.id == lane-id)
    (lane-count - index - 1) * theme.lane-gap
  }
  let top-lane-y = (lane-count - 1) * theme.lane-gap
  let axis-y = top-lane-y + 0.82 + history.precedence.len() * 0.19
  let title-y = axis-y + 0.48
  let bottom-y = -0.62

  vector-canvas({
    if history.title != none {
      canvas-label(
        (left, title-y),
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

    arrow(
      (left, axis-y),
      (right, axis-y),
      paint: theme.rule,
      thickness: theme.hairline,
    )
    canvas-label(
      (left, axis-y + 0.10),
      str(history.start),
      theme: theme,
      anchor: "south",
      font: theme.mono-font,
      size: 4.6pt,
      fill: theme.muted,
      inset: 0pt,
    )
    canvas-label(
      (right, axis-y + 0.10),
      [t = #history.horizon],
      theme: theme,
      anchor: "south-east",
      font: theme.mono-font,
      size: 4.6pt,
      fill: theme.muted,
      inset: 0pt,
    )

    for lane in history.lanes {
      let y = lane-y(lane.id)
      canvas-label(
        (0.05, y),
        lane.label,
        theme: theme,
        anchor: "west",
        font: theme.mono-font,
        size: 6.7pt,
        weight: "bold",
        fill: theme.primary,
        inset: 0pt,
      )
      arrow(
        (left, y),
        (right, y),
        paint: theme.rule,
        thickness: theme.hairline,
        head: false,
      )
    }

    for marker in history.markers {
      let x = x-of(marker.time)
      let paint = tone-paint(marker.tone, theme: theme)
      line(
        (x, bottom-y + 0.12),
        (x, axis-y - 0.08),
        stroke: stroke-style(
          paint,
          theme.hairline,
          dash: if marker.pattern == "solid" { none } else { marker.pattern },
        ),
      )
      canvas-label(
        (x, axis-y - 0.04),
        marker.label,
        theme: theme,
        anchor: "north",
        font: theme.mono-font,
        size: 5.0pt,
        weight: "bold",
        fill: paint,
        background: theme.paper,
        inset: (x: 1.2pt, y: 0.2pt),
      )
    }

    _render-precedence(history, x-of, top-lane-y, theme)
    for operation in history.operations {
      _render-operation(operation, history, x-of, lane-y, theme)
    }

    if legend {
      canvas-label(
        (left, bottom-y),
        [● invocation   ○ response   ● LP   ⇢ pending],
        theme: theme,
        anchor: "west",
        font: theme.mono-font,
        size: 5.0pt,
        fill: theme.muted,
        background: theme.paper,
        inset: 0pt,
      )
    }
  }, scale: scale)
}

#let render-witnesses(history, theme: diagram-theme()) = {
  require(history.kind == "history-model", "render-witnesses: expected history-model()")
  if history.witnesses.len() == 0 { return none }

  block(width: 100%)[
    #for witness in history.witnesses [
      #box(
        width: 100%,
        inset: 7pt,
        radius: 2pt,
        fill: theme.paper,
        stroke: (paint: theme.rule, thickness: theme.hairline),
      )[
        #text(
          font: theme.sans-font,
          size: 6.2pt,
          weight: "bold",
          fill: tone-paint(witness.tone, theme: theme),
        )[#witness.label]
        #v(5pt)

        #for (index, operation-id) in witness.operations.enumerate() [
          #let operation = model.operation-by-id(history, operation-id)
          #text(
            font: theme.mono-font,
            size: 5.1pt,
            weight: "bold",
            fill: tone-paint(operation.tone, theme: theme),
          )[#(index + 1)]
          #h(2.5pt)
          #text(
            font: theme.mono-font,
            size: 5.7pt,
            weight: "bold",
            fill: theme.ink,
          )[#_operation-body(operation)]
          #if index < witness.operations.len() - 1 [
            #h(4pt)#text(size: 6pt, fill: theme.muted)[→]#h(4pt)
          ]
        ]

        #v(5pt)
        #text(
          font: theme.body-font,
          size: 5.2pt,
          fill: theme.muted,
        )[Preserves process order and every real-time precedence constraint.]
      ]
      #v(5pt)
    ]
  ]
}

#let render-history-with-witnesses(history, theme: diagram-theme(), scale: 1.0) = block(
  width: 100%,
)[
  #render-history(history, theme: theme, scale: scale)
  #v(5pt)
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
