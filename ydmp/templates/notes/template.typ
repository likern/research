// Shared rendering API for the four YDMP note-template candidates.
// Select a profile with `variant: "candidate-a"` ... `"candidate-d"`.

#import "candidate-a.typ" as candidate_a
#import "candidate-b.typ" as candidate_b
#import "candidate-c.typ" as candidate_c
#import "candidate-d.typ" as candidate_d

#let default_variant = "candidate-c"

#let resolve_theme(variant: default_variant) = {
  if variant == "candidate-a" or variant == "a" {
    candidate_a.theme
  } else if variant == "candidate-b" or variant == "b" {
    candidate_b.theme
  } else if variant == "candidate-c" or variant == "c" {
    candidate_c.theme
  } else if variant == "candidate-d" or variant == "d" {
    candidate_d.theme
  } else {
    panic("Unknown YDMP note-template variant: " + variant)
  }
}

#let display_or_dash(value) = {
  if value == none or value == "" { "—" } else { value }
}

// External compilation switch:
//   typst compile file.typ --input show-thoughts=false
// sys.inputs values are strings, so normalize a small set of false values.
#let parse_bool_input(value, default: true) = {
  if value == none {
    default
  } else {
    let normalized = lower(value)
    not (normalized in ("0", "false", "no", "off", "hide", "hidden"))
  }
}

#let thoughts_visible(visible: auto) = {
  if visible == auto {
    parse_bool_input(
      sys.inputs.at("show-thoughts", default: "true"),
      default: true,
    )
  } else {
    visible
  }
}

#let thought_kind(kind: "default") = {
  if kind == "main-idea" or kind == "main_idea" or kind == "idea" {
    (id: "main-idea", label: "Главная мысль", marker: "◆")
  } else if kind == "causal-chain" or kind == "causal_chain" or kind == "cause" {
    (id: "causal-chain", label: "Причинная цепочка", marker: "→")
  } else if kind == "formal-link" or kind == "formal_link" or kind == "definition" {
    (id: "formal-link", label: "Связь с формальным определением", marker: "≡")
  } else if kind == "example" or kind == "own-example" or kind == "own_example" {
    (id: "example", label: "Свой пример", marker: "◇")
  } else if kind == "uncertainty" or kind == "unclear" or kind == "question" {
    (id: "uncertainty", label: "Неясность", marker: "?")
  } else if kind == "default" or kind == "thought" or kind == "note" {
    (id: "default", label: "Мои мысли", marker: "•")
  } else {
    panic("Unknown YDMP thought kind: " + kind)
  }
}

#let paper_notes(
  title: "Untitled scientific-paper notes",
  subtitle: none,
  authors: (),
  paper_id: none,
  doi: none,
  stage: none,
  variant: default_variant,
  body,
) = {
  let t = resolve_theme(variant: variant)
  let author_line = if authors.len() == 0 { "—" } else { authors.join(", ") }

  set page(paper: "a4", margin: t.page_margin)
  set text(
    font: t.body_font,
    size: t.body_size,
    weight: t.body_weight,
    fill: t.text_fill,
  )
  set par(
    justify: t.justify,
    leading: t.leading,
    spacing: t.paragraph_spacing,
  )

  show heading.where(level: 1): it => block(
    above: t.section_above,
    below: t.section_below,
  )[
    #text(
      font: t.heading_font,
      size: t.h1_size,
      weight: t.heading_weight,
      fill: t.accent,
    )[#it.body]
    #v(2pt)
    #line(length: 100%, stroke: (paint: t.rule, thickness: 0.6pt))
  ]

  show heading.where(level: 2): it => block(
    above: t.section_above * 0.75,
    below: t.section_below * 0.75,
  )[
    #text(
      font: t.heading_font,
      size: t.h2_size,
      weight: t.heading_weight,
      fill: t.accent,
    )[#it.body]
  ]

  align(center, text(
    font: t.heading_font,
    size: t.title_size,
    weight: "bold",
    fill: t.accent,
    title,
  ))

  if subtitle != none {
    v(3pt)
    align(center, text(
      font: t.heading_font,
      size: t.subtitle_size,
      fill: t.muted,
      subtitle,
    ))
  }

  v(10pt)
  table(
    columns: (1fr, 2.2fr),
    inset: 5pt,
    fill: t.metadata_fill,
    stroke: (paint: t.rule, thickness: 0.35pt),
    [*Paper ID*], [#display_or_dash(paper_id)],
    [*Authors*], [#author_line],
    [*DOI*], [#display_or_dash(doi)],
    [*YDMP stage*], [#display_or_dash(stage)],
    [*Template*], [#t.label (#t.id)],
  )

  v(12pt)
  body
}

#let note_panel(
  body,
  title: none,
  kind: "note",
  variant: default_variant,
) = {
  let t = resolve_theme(variant: variant)
  let inferred_title = if title != none {
    title
  } else if kind == "recall" {
    "Closed-book recall"
  } else if kind == "verification" {
    "Verification"
  } else if kind == "gap" {
    "Knowledge gap"
  } else {
    "Note"
  }

  block(
    width: 100%,
    inset: t.panel_inset,
    radius: t.panel_radius,
    fill: t.panel_fill,
    stroke: (paint: t.rule, thickness: 0.45pt),
  )[
    #text(
      font: t.heading_font,
      weight: t.heading_weight,
      fill: t.accent,
    )[#inferred_title]
    #v(4pt)
    #body
  ]
}

// Learner-authored interpretation block.
//
// `body` is unrestricted Typst content: paragraphs, lists, display equations,
// tables, code, diagrams, and nested blocks are all allowed. The body inherits
// the surrounding document font and layout. Only a relative text-size change is
// applied, so the component follows Candidate A/B/C/D instead of replacing it.
//
// `visible: auto` obeys `--input show-thoughts=false`. Passing an explicit bool
// overrides the external switch for a single block or a pre-bound function.
#let my_thought(
  body,
  kind: "default",
  title: auto,
  show_label: true,
  visible: auto,
  variant: default_variant,
) = {
  if not thoughts_visible(visible: visible) {
    none
  } else {
    let t = resolve_theme(variant: variant)
    let spec = thought_kind(kind: kind)
    let rendered_title = if not show_label or title == none {
      none
    } else if title == auto {
      spec.label
    } else {
      title
    }

    block(
      width: 100%,
      breakable: true,
      above: 0.68em,
      below: 0.72em,
      inset: (
        top: 0.62em,
        bottom: 0.68em,
        left: 0.82em,
        right: 0.76em,
      ),
      radius: t.panel_radius,
      fill: t.panel_fill,
      stroke: (
        left: (paint: t.accent, thickness: 0.16em),
        top: (paint: t.rule, thickness: 0.035em),
        right: (paint: t.rule, thickness: 0.035em),
        bottom: (paint: t.rule, thickness: 0.035em),
      ),
    )[
      #if rendered_title != none [
        #text(
          size: 0.88em,
          weight: t.heading_weight,
          fill: t.accent,
        )[#spec.marker #h(0.32em) #rendered_title]
        #v(0.32em)
      ]
      #set text(size: 0.96em)
      #set par(spacing: 0.44em)
      #body
    ]
  }
}

#let thought = my_thought

#let evidence(label, body, variant: default_variant) = {
  let t = resolve_theme(variant: variant)
  text(weight: "bold", fill: t.accent, label + ":") + [ ] + body
}
