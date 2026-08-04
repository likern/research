// Pinega Strata design tokens for semantic technical diagrams.
//
// Renderers accept a resolved theme record. The semantic model never imports
// this module, so the same model can be rendered for screen, print, or another
// publication system without changing its facts.

#let _screen-theme = (
  paper: rgb("#fbf7ef"),
  surface: rgb("#f4ebdd"),
  surface-alt: rgb("#efe3d2"),
  ink: rgb("#272827"),
  muted: rgb("#67625b"),
  rule: rgb("#c9bead"),
  primary: rgb("#365e72"),
  event: rgb("#b45c3f"),
  inferred: rgb("#687b59"),
  warning: rgb("#a77824"),
  danger: rgb("#963c36"),
  pending: rgb("#756b84"),

  body-font: "Libertinus Serif",
  sans-font: "DejaVu Sans",
  mono-font: "DejaVu Sans Mono",

  hairline: 0.45pt,
  edge: 0.75pt,
  strong-edge: 1.35pt,

  lane-gap: 1.18,
  timeline-unit: 0.86,
  operation-height: 0.48,
  event-radius: 0.068,

  node-data-width: 1.08,
  node-next-width: 0.58,
  node-height: 0.78,
  node-gap: 0.76,
)

#let _print-theme = _screen-theme + (
  paper: white,
  surface: luma(244),
  surface-alt: luma(232),
  ink: black,
  muted: luma(70),
  rule: luma(150),
  primary: black,
  event: luma(35),
  inferred: luma(90),
  warning: luma(110),
  danger: black,
  pending: luma(85),
  hairline: 0.55pt,
  edge: 0.85pt,
  strong-edge: 1.45pt,
)

#let diagram-theme(mode: "screen", overrides: (:)) = {
  let base = if mode == "print" { _print-theme } else { _screen-theme }
  base + overrides
}

#let print-diagram-theme = diagram-theme(mode: "print")

#let tone-paint(tone, theme: diagram-theme()) = {
  if tone in ("event", "focus", "new") {
    theme.event
  } else if tone in ("inferred", "valid", "witness") {
    theme.inferred
  } else if tone in ("warning", "queued") {
    theme.warning
  } else if tone in ("danger", "invalid", "violation") {
    theme.danger
  } else if tone == "pending" {
    theme.pending
  } else if tone in ("muted", "retired") {
    theme.muted
  } else {
    theme.primary
  }
}

#let tone-fill(tone, theme: diagram-theme()) = {
  if tone == "neutral" {
    theme.surface
  } else {
    tone-paint(tone, theme: theme).lighten(78%)
  }
}
