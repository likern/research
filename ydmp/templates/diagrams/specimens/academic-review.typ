#import "../../notes/template.typ": paper_notes, note_panel
#import "../theme.typ": diagram-theme, print-diagram-theme
#import "../shared-model.typ": load-shared-diagram, shared-diagram-figure
#let history = load-shared-diagram("linearizability-overlap")
#let versions = load-shared-diagram("version-chain-snapshot")
#let lifecycle = load-shared-diagram("buffer-frame-lifecycle")
#let theme = diagram-theme()
#show: paper_notes.with(title: "Scientific Diagram Language v0.2", subtitle: "Academic renderer visual review", authors: ("Pinega Labs / YDMP Research Workspace",), paper_id: "pinega-scientific-diagram-language-v0.2-review", stage: "DIAGRAM-REVIEW / ACADEMIC-2", variant: "candidate-strata")
#set figure.caption(separator: [ — ])
#show figure.where(kind: "ydmp-diagram"): set block(above: 0.8em, below: 1.0em)
= 1. Linearizability history
#note_panel(title: "Review target", kind: "verification", variant: "candidate-strata")[Operation intervals are rails rather than UI cards. Linearization points are first-class event markers. The time axis, real-time precedence, quiescent boundary, and legal sequential witness have distinct visual roles.]
#shared-diagram-figure(history, theme: theme)
#pagebreak()
= 2. Snapshot-visible version chain
#note_panel(title: "Review target", kind: "verification", variant: "candidate-strata")[The stable row head is a reference, not a version object. Versions form the dominant temporal chain. Snapshot S17 is shown as a visibility evaluation, not as a pointer to the selected version.]
#shared-diagram-figure(versions, theme: theme)
#pagebreak()
= 3. Buffer-frame lifecycle consistency
#note_panel(title: "Review target", kind: "verification", variant: "candidate-strata")[The lifecycle renderer is included to verify that the refined typography, edge weights, state tones, and print discipline remain coherent across the third shared semantic family.]
#shared-diagram-figure(lifecycle, theme: theme)
#pagebreak()
= 4. Monochrome projection
The semantic models are unchanged. Only the renderer theme changes.
#shared-diagram-figure(history, theme: print-diagram-theme)
#v(8pt)
#shared-diagram-figure(versions, theme: print-diagram-theme)
