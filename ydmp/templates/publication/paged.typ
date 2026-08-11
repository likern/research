// Paged Strata adapter for Pinega dual-target publications.

#import "../../../design/generated/strata.tokens.typ": pinega-strata-token

#let token(path) = pinega-strata-token(path)
#let ink = token("system.light.color.text.primary")
#let muted = token("system.light.color.text.quiet")
#let action = token("system.light.color.action.primary")
#let border = token("system.light.color.border.normal")
#let border-subtle = token("system.light.color.border.subtle")
#let paper = token("system.light.color.surface.canvas")
#let raised = token("system.light.color.surface.raised")
#let reading-font = token("system.font.family.reading").first()
// CSS generic families in the shared token fallback lists are not Typst font
// names. The paged adapter therefore maps the unavailable UI/code primaries to
// the deterministic open families used by the existing YDMP corpus.
#let ui-font = "DejaVu Sans"
#let code-font = "DejaVu Sans Mono"

#let publication-paged(
  id: none,
  lang: "en",
  title: "Untitled publication",
  subtitle: none,
  authors: (),
  published-at: none,
  body,
) = {
  let author-line = if authors.len() == 0 { "Pinega Labs" } else { authors.join(", ") }
  let published-line = if published-at == none { "—" } else { published-at }
  let labels = if lang == "ru" {
    (
      kicker: "ИССЛЕДОВАТЕЛЬСКАЯ ПУБЛИКАЦИЯ PINEGA",
      authors: "АВТОРЫ",
      published: "ОПУБЛИКОВАНО",
      profile: "ПРОФИЛЬ",
      profile-name: "Двухцелевая публикация",
    )
  } else {
    (
      kicker: "PINEGA RESEARCH PUBLICATION",
      authors: "AUTHORS",
      published: "PUBLISHED",
      profile: "PROFILE",
      profile-name: "Dual-target specimen",
    )
  }

  set document(title: title, author: authors)
  set page(
    paper: "a4",
    margin: (top: 20mm, bottom: 21mm, left: 21mm, right: 21mm),
    fill: paper,
    header: context {
      if counter(page).get().first() > 1 {
        grid(
          columns: (1fr, auto),
          text(font: ui-font, size: 7pt, weight: "bold", fill: action)[PINEGA LABS · RESEARCH],
          text(font: code-font, size: 6.6pt, fill: muted)[#id],
        )
        v(3pt)
        line(length: 100%, stroke: (paint: border-subtle, thickness: 0.45pt))
      }
    },
    footer: context {
      line(length: 100%, stroke: (paint: border-subtle, thickness: 0.45pt))
      v(3pt)
      grid(
        columns: (1fr, auto),
        text(font: code-font, size: 6.4pt, fill: muted)[DUAL-TARGET · VALIDATION SPECIMEN],
        text(font: code-font, size: 6.6pt, weight: "bold", fill: action)[#counter(page).display()],
      )
    },
  )
  set text(
    lang: lang,
    font: reading-font,
    size: 10.5pt,
    fill: ink,
  )
  set par(justify: true, leading: 0.76em, spacing: 0.62em)
  set heading(numbering: "1.1")
  show heading.where(level: 1): it => block(above: 1.5em, below: 0.7em)[
    #text(font: ui-font, size: 16pt, weight: "bold", fill: action)[#it.body]
  ]
  show heading.where(level: 2): it => block(above: 1.25em, below: 0.55em)[
    #text(font: ui-font, size: 12pt, weight: "bold", fill: ink)[#it.body]
  ]
  show heading.where(level: 3): it => block(above: 1em, below: 0.45em)[
    #text(font: ui-font, size: 10.2pt, weight: "bold", fill: ink)[#it.body]
  ]
  show raw.where(block: true): it => block(
    width: 100%,
    inset: 9pt,
    radius: token("system.radius.control"),
    fill: token("system.light.color.code.surface"),
  )[
    #text(font: code-font, size: 8.2pt, fill: token("system.light.color.code.text"))[#it]
  ]

  stack(
    dir: ttb,
    spacing: 1.5pt,
    rect(width: 100%, height: 3.2pt, fill: action),
    rect(width: 100%, height: 2.2pt, fill: token("research.light.color.hypothesis")),
    rect(width: 100%, height: 1.6pt, fill: token("research.light.color.confirmed")),
  )
  v(18pt)
  text(font: ui-font, size: 7.2pt, weight: "bold", fill: action, tracking: 0.08em)[#labels.kicker]
  v(7pt)
  text(font: ui-font, size: 24pt, weight: "bold", fill: ink)[#title]
  if subtitle != none {
    v(7pt)
    text(font: reading-font, size: 12pt, fill: muted)[#subtitle]
  }
  v(14pt)
  box(
    width: 100%,
    inset: 9pt,
    radius: token("system.radius.panel"),
    fill: raised,
    stroke: (paint: border, thickness: 0.5pt),
  )[
    #grid(
      columns: (1fr, 1fr, 1fr),
      gutter: 10pt,
      [#text(font: ui-font, size: 6.8pt, weight: "bold", fill: muted)[#labels.authors]\
       #author-line],
      [#text(font: ui-font, size: 6.8pt, weight: "bold", fill: muted)[#labels.published]\
       #published-line],
      [#text(font: ui-font, size: 6.8pt, weight: "bold", fill: muted)[#labels.profile]\
       #labels.profile-name],
    )
  ]
  v(18pt)
  body
}
