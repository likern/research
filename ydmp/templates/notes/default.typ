// Stable default import for YDMP scientific-paper notes.
// Candidate C is provisional default unless the caller explicitly selects
// another variant through template.typ.

#import "template.typ" as notes

#let default_variant = "candidate-c"
#let paper_notes = notes.paper_notes.with(variant: default_variant)
#let note_panel = notes.note_panel.with(variant: default_variant)
#let my_thought = notes.my_thought.with(variant: default_variant)
#let thought = my_thought
#let evidence = notes.evidence.with(variant: default_variant)
#let thoughts_visible = notes.thoughts_visible
#let thought_kind = notes.thought_kind
#let resolve_theme = notes.resolve_theme
#let research_kicker = notes.research_kicker.with(variant: default_variant)
#let state_panel = notes.state_panel.with(variant: default_variant)
