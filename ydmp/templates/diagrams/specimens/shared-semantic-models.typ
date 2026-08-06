#import "../../notes/template.typ": paper_notes, note_panel, evidence
#import "../theme.typ": diagram-theme, print-diagram-theme
#import "../shared-model.typ": (
  load-shared-diagram, shared-diagram-figure, shared-diagram-text,
)

#let history = load-shared-diagram("linearizability-overlap")
#let versions = load-shared-diagram("version-chain-snapshot")
#let lifecycle = load-shared-diagram("buffer-frame-lifecycle")
#let theme = diagram-theme()

#show: paper_notes.with(
  title: "Shared Semantic Diagram Models",
  subtitle: "One model layer for Typst/CeTZ publications and accessible web SVG",
  authors: ("Pinega Labs / YDMP Research Workspace",),
  paper_id: "pinega-shared-semantic-diagrams-001",
  stage: "DIAGRAM-GATE / SHARED-MODEL-1",
  variant: "candidate-strata",
)

#set figure.caption(separator: [ — ])
#show figure.where(kind: "ydmp-diagram"): set block(above: 0.8em, below: 1.0em)

= 1. Contract

#note_panel(title: "Canonical boundary", kind: "verification", variant: "candidate-strata")[
  The JSON records in `design/diagrams/models/` contain domain facts and stable
  identity only. They contain no coordinates, colours, fonts, SVG paths, CeTZ
  primitives, or page dimensions. Each renderer validates and lays out those
  facts independently.
]

#evidence("CONFIRMED", variant: "candidate-strata")[
  This document reads the same three JSON files that the website build uses to
  produce inline SVG. Typst converts them into the existing semantic history
  model plus dedicated version-chain and lifecycle models before CeTZ layout.
]

The shared gate requires:

1. stable model and object identifiers;
2. cross-reference and temporal validation before geometry;
3. deterministic vector output;
4. a searchable textual projection from the same facts;
5. captions and alternative descriptions owned by the model;
6. renderer-specific design tokens outside the model.

#pagebreak()

= 2. Linearizability history

#shared-diagram-figure(history, theme: theme)

#shared-diagram-text(history, theme: theme)

#pagebreak()

= 3. Snapshot-visible version chain

#shared-diagram-figure(versions, theme: theme)

#shared-diagram-text(versions, theme: theme)

#pagebreak()

= 4. Buffer-frame lifecycle

#shared-diagram-figure(lifecycle, theme: theme)

#shared-diagram-text(lifecycle, theme: theme)

#pagebreak()

= 5. Print projection

The semantic model is unchanged. Only the renderer theme changes:

#shared-diagram-figure(lifecycle, theme: print-diagram-theme)
