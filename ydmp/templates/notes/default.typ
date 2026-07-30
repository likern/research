// Stable default import for YDMP scientific-paper notes.
// Candidate C is provisional default unless the caller explicitly selects
// another variant through template.typ.

#import "template.typ" as notes

#let default_variant = "candidate-c"
#let paper_notes = notes.paper_notes.with(variant: default_variant)
#let note_panel = notes.note_panel.with(variant: default_variant)
#let evidence = notes.evidence.with(variant: default_variant)
#let resolve_theme = notes.resolve_theme
