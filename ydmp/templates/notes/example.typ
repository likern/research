#import "default.typ": paper_notes, note_panel, evidence

#show: paper_notes.with(
  title: "Example scientific-paper notes",
  subtitle: "YDMP MODEL / VERIFY working document",
  authors: ("First Author", "Second Author"),
  paper_id: "example-2026-paper",
  doi: "10.0000/example",
  stage: "MODEL",
)

= Problem and system model

#evidence("CONFIRMED")[
  State the exact problem, assumptions, and object or transaction boundaries
  supported by the focal source.
]

#note_panel(kind: "recall")[
  Reconstruct the mechanism without reopening the source. Preserve uncertainty
  and incomplete reasoning rather than silently repairing the answer.
]

= Mechanism

Describe the causal path, ownership of state, persistence points, ordering
relations, and the normal execution path.

== Failure path

#note_panel(kind: "verification")[
  Compare the reconstructed model with the paper, code, tests, or authoritative
  documentation. Record corrections separately from the historical answer.
]

= Open questions

#note_panel(kind: "gap")[
  List unresolved assumptions, missing proofs, source conflicts, and the next
  concrete verification action.
]
