// Shared CeTZ and Typst presentation primitives.
//
// Domain renderers use these wrappers instead of duplicating arrow, label,
// panel, fallback, and accessible-figure conventions.

#import "@preview/cetz:0.5.2"
#import cetz.draw: line, content
#import "theme.typ": diagram-theme, tone-paint, tone-fill

#let stroke-style(paint, thickness, dash: none) = if dash == none {
  (paint: paint, thickness: thickness, cap: "round", join: "round")
} else {
  (
    paint: paint,
    thickness: thickness,
    dash: dash,
    cap: "round",
    join: "round",
  )
}

#let vector-canvas(body, scale: 1.0, padding: (0.05, 0.10, 0.10, 0.05)) = cetz.canvas(
  body,
  length: 1cm * scale,
  padding: padding,
)

#let arrow(
  start,
  finish,
  paint: black,
  thickness: 0.75pt,
  dash: none,
  head: true,
) = {
  let style = stroke-style(paint, thickness, dash: dash)
  if head {
    line(start, finish, stroke: style, mark: (end: ">"))
  } else {
    line(start, finish, stroke: style)
  }
}

#let poly-arrow(
  points,
  paint: black,
  thickness: 0.75pt,
  dash: none,
  head: true,
) = {
  let style = stroke-style(paint, thickness, dash: dash)
  if head {
    line(..points, stroke: style, mark: (end: ">"))
  } else {
    line(..points, stroke: style)
  }
}

#let canvas-label(
  position,
  body,
  theme: diagram-theme(),
  anchor: "center",
  font: auto,
  size: 6.6pt,
  weight: "regular",
  fill: auto,
  background: none,
  inset: (x: 2pt, y: 1pt),
  radius: 2pt,
  stroke: none,
) = {
  let label = box(
    fill: background,
    inset: inset,
    radius: radius,
    stroke: stroke,
  )[
    #text(
      font: if font == auto { theme.sans-font } else { font },
      size: size,
      weight: weight,
      fill: if fill == auto { theme.ink } else { fill },
    )[#body]
  ]
  content(position, label, anchor: anchor)
}

#let tone-chip(
  position,
  body,
  tone: "primary",
  theme: diagram-theme(),
  anchor: "center",
) = {
  let paint = tone-paint(tone, theme: theme)
  canvas-label(
    position,
    body,
    theme: theme,
    anchor: anchor,
    font: theme.mono-font,
    size: 5.6pt,
    weight: "bold",
    fill: paint,
    background: tone-fill(tone, theme: theme),
    stroke: (paint: paint, thickness: theme.hairline),
    radius: 4pt,
    inset: (x: 3pt, y: 1.3pt),
  )
}

#let diagram-panel(body, title: none, theme: diagram-theme(), inset: 8pt) = block(
  width: 100%,
  breakable: false,
  inset: inset,
  radius: 4pt,
  fill: theme.paper,
  stroke: (paint: theme.rule, thickness: theme.hairline),
)[
  #if title != none [
    #text(
      font: theme.sans-font,
      size: 8.2pt,
      weight: "bold",
      fill: theme.primary,
    )[#title]
    #v(5pt)
  ]
  #body
]

#let diagram-figure(
  body,
  caption,
  alt,
  kind: "ydmp-diagram",
  supplement: [Схема],
) = figure(
  body,
  caption: caption,
  alt: alt,
  kind: kind,
  supplement: supplement,
)

#let text-fallback(lines, theme: diagram-theme()) = block(
  width: 100%,
  inset: 7pt,
  radius: 4pt,
  fill: theme.ink,
  stroke: (
    left: (paint: theme.event, thickness: 1.4pt),
    top: (paint: theme.ink, thickness: theme.hairline),
    right: (paint: theme.ink, thickness: theme.hairline),
    bottom: (paint: theme.ink, thickness: theme.hairline),
  ),
)[
  #stack(
    dir: ttb,
    spacing: 2pt,
    ..lines.map(line => text(
      font: theme.mono-font,
      size: 6.6pt,
      fill: theme.paper,
    )[#line]),
  )
]
