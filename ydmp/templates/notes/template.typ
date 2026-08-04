// Shared rendering API for the four original YDMP note-template candidates
// plus the experimental Pinega Strata candidate.
//
// Select a profile with `variant: "candidate-a"` ... `"candidate-d"` or
// `variant: "candidate-strata"`. Candidate C remains the stable default.

#import "candidate-a.typ" as candidate_a
#import "candidate-b.typ" as candidate_b
#import "candidate-c.typ" as candidate_c
#import "candidate-d.typ" as candidate_d
#import "candidate-strata.typ" as candidate_strata

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
  } else if variant == "candidate-strata" or variant == "strata" {
    candidate_strata.theme
  } else {
    panic("Unknown YDMP note-template variant: " + variant)
  }
}

#let display_or_dash(value) = {
  if value == none or value == "" { "—" } else { value }
}

#let theme_value(theme, key, fallback) = {
  theme.at(key, default: fallback)
}

#let is_strata(theme) = {
  theme_value(theme, "profile", "standard") == "strata"
}

#let strata_motif(theme) = {
  stack(
    dir: ttb,
    spacing: 1.5pt,
    rect(width: 100%, height: 3.2pt, fill: theme.accent),
    rect(
      width: 100%,
      height: 2.4pt,
      fill: theme_value(theme, "accent_secondary", theme.accent),
    ),
    rect(
      width: 100%,
      height: 2.4pt,
      fill: theme_value(theme, "accent_tertiary", theme.accent),
    ),
    rect(width: 100%, height: 1.6pt, fill: theme.metadata_fill),
  )
}

#let evidence_paint(label, theme) = {
  let normalized = upper(label)
  if normalized == "CONFIRMED" {
    theme.accent
  } else if normalized == "INFERRED" {
    theme_value(theme, "accent_tertiary", theme.accent)
  } else if normalized == "HYPOTHESIS" or normalized == "PROOF GAP" {
    theme_value(theme, "accent_secondary", theme.accent)
  } else {
    theme.muted
  }
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
  let strata = is_strata(t)

  let page_header = if strata {
    context {
      if counter(page).get().first() > 1 {
        grid(
          columns: (1fr, auto),
          text(
            font: t.heading_font,
            size: 7pt,
            weight: "bold",
            fill: t.accent,
          )[PINEGA LABS · YDMP],
          text(
            font: theme_value(t, "mono_font", t.heading_font),
            size: 6.8pt,
            fill: t.muted,
          )[#display_or_dash(stage)],
        )
        v(3pt)
        line(
          length: 100%,
          stroke: (paint: t.rule, thickness: 0.4pt),
        )
      }
    }
  } else {
    none
  }
  let page_footer = if strata {
    context {
      line(
        length: 100%,
        stroke: (paint: t.rule, thickness: 0.4pt),
      )
      v(3pt)
      grid(
        columns: (1fr, auto),
        text(
          font: theme_value(t, "mono_font", t.heading_font),
          size: 6.5pt,
          fill: t.muted,
        )[STRATA · EXPERIMENTAL CANDIDATE],
        text(
          font: theme_value(t, "mono_font", t.heading_font),
          size: 6.7pt,
          weight: "bold",
          fill: t.accent,
        )[#counter(page).display()],
      )
    }
  } else {
    none
  }

  set page(
    paper: "a4",
    margin: t.page_margin,
    fill: if strata { theme_value(t, "page_fill", none) } else { none },
    header: page_header,
    footer: page_footer,
  )

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

  show heading.where(level: 1): it => {
    if strata {
      block(
        above: t.section_above,
        below: t.section_below,
      )[
        #text(
          font: t.heading_font,
          size: t.h1_size,
          weight: t.heading_weight,
          fill: t.accent,
        )[#it.body]
        #v(3pt)
        #strata_motif(t)
      ]
    } else {
      block(
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
    }
  }

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

  show heading.where(level: 3): it => {
    if strata {
      block(
        above: t.section_above * 0.60,
        below: t.section_below * 0.55,
      )[
        #text(
          font: t.heading_font,
          size: 10.4pt,
          weight: "bold",
          fill: t.text_fill,
        )[#it.body]
      ]
    } else {
      it
    }
  }

  show raw.where(block: true): it => {
    if strata {
      block(
        width: 100%,
        breakable: true,
        inset: 8pt,
        radius: t.panel_radius,
        fill: t.text_fill,
        stroke: (
          left: (
            paint: theme_value(t, "accent_secondary", t.accent),
            thickness: 2.4pt,
          ),
        ),
      )[
        #set text(
          font: theme_value(t, "mono_font", t.heading_font),
          size: 8pt,
          fill: white,
        )
        #it
      ]
    } else {
      it
    }
  }

  if strata {
    strata_motif(t)
    v(9pt)
    text(
      font: theme_value(t, "mono_font", t.heading_font),
      size: 7.2pt,
      weight: "bold",
      fill: t.accent,
      tracking: 0.7pt,
    )[PINEGA LABS · RESEARCH WORKSPACE]
    v(6pt)
    text(
      font: t.heading_font,
      size: t.title_size,
      weight: "bold",
      fill: t.accent,
    )[#title]

    if subtitle != none {
      v(3pt)
      text(
        font: t.heading_font,
        size: t.subtitle_size,
        fill: t.muted,
      )[#subtitle]
    }
  } else {
    align(center)[
      #set par(justify: false)
      #text(
        font: t.heading_font,
        size: t.title_size,
        weight: "bold",
        fill: t.accent,
      )[#title]
    ]

    if subtitle != none {
      v(3pt)
      align(center)[
        #set par(justify: false)
        #text(
          font: t.heading_font,
          size: t.subtitle_size,
          fill: t.muted,
        )[#subtitle]
      ]
    }
  }

  v(10pt)
  table(
    columns: (1fr, 2.2fr),
    inset: if strata { 6pt } else { 5pt },
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

  if is_strata(t) {
    block(
      width: 100%,
      breakable: true,
      inset: t.panel_inset,
      radius: t.panel_radius,
      fill: t.panel_fill,
      stroke: (
        left: (
          paint: theme_value(t, "accent_tertiary", t.accent),
          thickness: 2.4pt,
        ),
        top: (paint: t.rule, thickness: 0.4pt),
        right: (paint: t.rule, thickness: 0.4pt),
        bottom: (paint: t.rule, thickness: 0.4pt),
      ),
    )[
      #text(
        font: t.heading_font,
        size: 0.90em,
        weight: t.heading_weight,
        fill: t.accent,
      )[#inferred_title]
      #v(4pt)
      #body
    ]
  } else {
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
}

// Learner-authored interpretation block.
//
// `body` is unrestricted Typst content: paragraphs, lists, display equations,
// tables, code, diagrams, and nested blocks are all allowed. The body inherits
// the surrounding document font and layout. Only a relative text-size change is
// applied, so the component follows the active candidate rather than replacing
// its typography.
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

    if is_strata(t) {
      block(
        width: 100%,
        breakable: true,
        above: 0.68em,
        below: 0.72em,
        inset: (
          top: 0.66em,
          bottom: 0.70em,
          left: 0.86em,
          right: 0.80em,
        ),
        radius: t.panel_radius,
        fill: theme_value(t, "page_fill", t.panel_fill),
        stroke: (
          left: (
            paint: theme_value(t, "accent_secondary", t.accent),
            thickness: 0.18em,
          ),
          top: (paint: t.rule, thickness: 0.035em),
          right: (paint: t.rule, thickness: 0.035em),
          bottom: (paint: t.rule, thickness: 0.035em),
        ),
      )[
        #if rendered_title != none [
          #text(
            font: t.heading_font,
            size: 0.88em,
            weight: t.heading_weight,
            fill: t.accent,
          )[#spec.marker #h(0.32em) #rendered_title]
          #v(0.32em)
        ]
        #set text(size: 0.97em)
        #set par(spacing: 0.46em)
        #body
      ]
    } else {
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
}

#let thought = my_thought

#let evidence(label, body, variant: default_variant) = {
  let t = resolve_theme(variant: variant)
  if is_strata(t) {
    let paint = evidence_paint(label, t)
    block(
      width: 100%,
      breakable: true,
      above: 0.52em,
      below: 0.62em,
      inset: (
        top: 0.60em,
        bottom: 0.64em,
        left: 0.78em,
        right: 0.76em,
      ),
      radius: t.panel_radius,
      fill: t.metadata_fill,
      stroke: (
        left: (paint: paint, thickness: 0.16em),
        top: (paint: t.rule, thickness: 0.035em),
        right: (paint: t.rule, thickness: 0.035em),
        bottom: (paint: t.rule, thickness: 0.035em),
      ),
    )[
      #text(
        font: theme_value(t, "mono_font", t.heading_font),
        size: 0.76em,
        weight: "bold",
        fill: t.accent,
        tracking: 0.35pt,
      )[#upper(label)]
      #v(0.24em)
      #body
    ]
  } else {
    text(weight: "bold", fill: t.accent, label + ":") + [ ] + body
  }
}

#let research_kicker(body, variant: default_variant) = {
  let t = resolve_theme(variant: variant)
  text(
    font: theme_value(t, "mono_font", t.heading_font),
    size: 7.2pt,
    weight: "bold",
    fill: t.accent,
    tracking: 0.65pt,
  )[#body]
}

#let state_panel(
  title,
  body,
  variant: default_variant,
  tone: "neutral",
) = {
  let t = resolve_theme(variant: variant)
  let fill = if is_strata(t) {
    if tone == "quiet" {
      theme_value(t, "page_fill", t.panel_fill)
    } else {
      t.metadata_fill
    }
  } else {
    t.panel_fill
  }
  block(
    width: 100%,
    breakable: true,
    inset: 7pt,
    radius: t.panel_radius,
    fill: fill,
    stroke: (paint: t.rule, thickness: 0.45pt),
  )[
    #text(
      font: theme_value(t, "mono_font", t.heading_font),
      size: 0.76em,
      weight: "bold",
      fill: t.accent,
    )[#title]
    #v(2.5pt)
    #set text(size: 0.90em)
    #body
  ]
}
