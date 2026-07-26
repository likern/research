#set page(paper: "a4", margin: 22mm)
#set text(size: 10.5pt)
#set heading(numbering: "1.")

#align(center)[
  #text(size: 18pt, weight: "bold")[YDMP PREPARE]
  #linebreak()
  #text(size: 13pt)[{{paper.canonical_title}}]
]

#grid(
  columns: (1fr, 2fr),
  gutter: 8pt,
  [*Paper ID*], [{{paper_id}}],
  [*Authors*], [{{authors_inline}}],
  [*Venue / Year*], [{{publication_inline}}],
  [*Selected version*], [{{paper.versions.selected_version}}],
  [*Curriculum*], [{{curriculum.stage}}],
)

= Why this material now
{{curriculum.why_now}}

= Expected problem
{{prepare.expected_problem}}

= Expected contribution
{{prepare.expected_contribution}}

= Reading scope
{{reading_scope}}

= Potential terminology barriers
{{terms_table}}

= Questions to hold while reading
{{questions_numbered}}

= Closed-book notes after reading
#box(width: 100%, height: 95mm, inset: 8pt, stroke: 0.7pt)[
  Write from memory. Do not reopen the source yet.
]

= Verification notes
#box(width: 100%, height: 55mm, inset: 8pt, stroke: 0.7pt)[
  Record errors, missing assumptions, and corrected mental model.
]

= Sources and unresolved issues
{{sources_and_unresolved}}
