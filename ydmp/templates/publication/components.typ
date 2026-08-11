// Target-neutral authoring components used by the Gate 5.1 specimen.

#import "../../../design/generated/strata.tokens.typ": pinega-strata-token
#import "../diagrams/shared-model.typ": load-shared-diagram, shared-diagram-figure

#let token(path) = pinega-strata-token(path)
#let ui-font = "DejaVu Sans"

#let abstract-block(id: "abstract", title: "Abstract", body) = context {
  if target() == "html" {
    html.elem("section", attrs: ("class": "pinega-publication-abstract", "aria-labelledby": id))[
      #html.elem("h2", attrs: ("id": id))[#title]
      #html.elem("p")[#body]
    ]
  } else {
    block(
      width: 100%,
      inset: 10pt,
      radius: token("system.radius.panel"),
      fill: token("system.light.color.surface.raised"),
      stroke: (paint: token("system.light.color.border.normal"), thickness: 0.5pt),
    )[
      #text(font: ui-font, size: 8pt, weight: "bold", fill: token("system.light.color.action.primary"))[#upper(title)]
      #v(5pt)
      #body
    ]
  }
}

#let semantic-panel(id, title, kind: "evidence", body) = context {
  let tone = if kind == "confirmed" {
    token("research.light.color.confirmed")
  } else if kind == "hypothesis" {
    token("research.light.color.hypothesis")
  } else {
    token("research.light.color.inferred")
  }
  if target() == "html" {
    html.elem(
      "aside",
      attrs: (
        "class": "pinega-publication-panel",
        "data-publication-panel": kind,
        "aria-labelledby": id,
      ),
    )[
      #html.elem("h3", attrs: ("id": id))[#title]
      #html.elem("p")[#body]
    ]
  } else {
    block(
      width: 100%,
      inset: 9pt,
      radius: token("system.radius.panel"),
      fill: token("system.light.color.surface.raised"),
      stroke: (
        left: (paint: tone, thickness: 2.4pt),
        top: (paint: token("system.light.color.border.subtle"), thickness: 0.45pt),
        right: (paint: token("system.light.color.border.subtle"), thickness: 0.45pt),
        bottom: (paint: token("system.light.color.border.subtle"), thickness: 0.45pt),
      ),
    )[
      #text(font: ui-font, size: 8pt, weight: "bold", fill: tone)[#upper(title)]
      #v(4pt)
      #body
    ]
  }
}

#let definition(id, title: "Definition", body) = semantic-panel(id, title, kind: "inferred", body)
#let evidence(id, title: "Evidence", body) = semantic-panel(id, title, kind: "confirmed", body)
#let my-thought(id, title: "Working interpretation", body) = semantic-panel(id, title, kind: "hypothesis", body)

#let foreign(lang, body) = context {
  if target() == "html" {
    html.elem("span", attrs: ("lang": lang))[#body]
  } else {
    text(lang: lang)[#body]
  }
}

#let responsive-table(id, label, body) = context {
  if target() == "html" {
    html.elem(
      "div",
      attrs: (
        "class": "pinega-publication-table-scroll",
        "tabindex": "0",
        "role": "region",
        "aria-label": label,
        "data-publication-table": id,
      ),
    )[#body]
  } else {
    body
  }
}

#let semantic-diagram(id) = context {
  if target() == "html" {
    html.elem(
      "div",
      attrs: (
        "class": "pinega-publication-diagram-slot",
        "data-pinega-diagram-placeholder": id,
      ),
    )[]
  } else {
    let diagram = load-shared-diagram(id)
    shared-diagram-figure(diagram)
  }
}
