#import "../../../templates/publication/core.typ": *

#show: publication.with(
  id: "dual-target-contract",
  lang: "en",
  title: "One source, two reading contracts",
  subtitle: "A Gate 5.1 specimen for responsive HTML and exact Typst PDF",
  authors: ("Pinega Labs",),
  published-at: "2026-08-11",
)

#abstract-block[
  This validation publication proves a narrow contract: one Typst source can
  preserve semantic reading structure in HTML while retaining a deliberate
  paged composition in PDF. It exercises headings, prose, mathematics, code,
  tables, citations, footnotes, cross-references, evidence states, bilingual
  spans, and a shared renderer-independent scientific diagram.
]

= The contract <reading-contract>

The responsive reader and the paged artefact are not pixel-identical outputs.
They are two projections of the same logical publication. The Web projection
owns reflow and accessibility; the paged projection owns exact page geometry.
This follows the target-neutral authoring model described by Typst's `target()`
interface and is tested against the linearizability literature @herlihy1990.

#definition("definition-contract", title: "Dual-target publication")[
  A *dual-target publication* is a target-neutral source whose semantic
  structure survives HTML export and whose paged adapter produces a stable PDF
  without copying the article body into a second authoring format.
]

The same contract can be expressed as a preservation relation:

$ forall x in C, quad S_h(x) = S_p(x), quad L_h(x) != L_p(x) $

where $C$ is the supported component set, $S_h$ and $S_p$ are the semantic
interpretations of the HTML and paged outputs, and $L_h$ and $L_p$ are their
layout functions. A longer matrix probes MathML and line wrapping:

$ A = mat(1, 0, alpha; 0, 1, beta; gamma, delta, 1), quad
  sum_(i=1)^n w_i p_i <= B, quad max_(pi in Pi) E[R(pi)] $

== One semantic source

The source uses ordinary headings, paragraphs, lists, emphasis, links, notes,
and references. The target-specific choices remain inside the publication
template:

- HTML emits a single semantic `<article>` for the Pinega build adapter.
- PDF applies physical margins, running furniture, fonts, and page rules.
- Pinega Strata tokens supply shared colour, typography, spacing, and radius values.
- The site shell supplies navigation, locale metadata, CSS, and lifecycle behaviour.

#evidence("evidence-confirmed", title: "Confirmed in the build")[
  The commit-preview pipeline compiles both outputs with Typst 0.15.1, extracts
  exactly one article, verifies the registry join, and deploys the exact tested
  bytes. A failed compiler or adapter contract fails the website build.
]

#my-thought("thought-layout", title: "Working interpretation")[
  Layout equality would be the wrong invariant. The useful invariant is that
  propositions, headings, evidence labels, references, and figure meaning are
  preserved while each medium uses its own reading geometry.
]

== Responsive structure

The main reader must remain usable at 320 CSS pixels. Wide two-dimensional
objects receive local scrolling, while ordinary prose continues to reflow.
The comparison in @comparison-table is intentionally wider than the prose
measure.

#responsive-table("contract-comparison", "Comparison of HTML and PDF publication contracts")[
  #figure(
    caption: [Comparison of the two output contracts.],
  )[
    #table(
      columns: (1.15fr, 1fr, 1fr, 1fr),
      inset: 6pt,
      stroke: 0.45pt + gray,
      table.header([*Concern*], [*Canonical owner*], [*HTML reader*], [*Paged PDF*]),
      [Meaning], [Typst source], [Semantic elements], [Paged reading structure],
      [Geometry], [Target adapter], [Responsive CSS], [A4 page layout],
      [Navigation], [Pinega shell], [Same-document enhancement], [Document outline],
      [Diagram], [Shared JSON model], [Accessible SVG + transcript], [Typst/CeTZ renderer],
    )
  ] <comparison-table>
]

The reference implementation is intentionally small:

```
type Projection = "html" | "paged";

export function render(source: Publication, target: Projection) {
  return target === "html"
    ? renderSemanticArticle(source)
    : renderPagedArtifact(source);
}
```

== Shared scientific diagram

The next figure is not encoded as coordinates in this publication. Both
renderers consume the canonical `linearizability-overlap.json` model. The Web
reader adds an accessible transcript and a downloadable semantic model.

#semantic-diagram("linearizability-overlap")

The history illustrates overlapping operations and a sequential witness, the
same distinction formalised by Herlihy and Wing @herlihy1990. Transaction
isolation provides a useful contrast because serializability and
linearizability constrain different observable orders @berenson1995.

== Language and notes

The HTML reader retains inline language changes. For example,
#foreign("ru")[один источник — два контракта чтения] is marked as Russian,
while the surrounding paragraph remains English. A footnote also survives the
projection.#footnote[The footnote is authored once and participates in both the HTML and PDF outputs.]

== Acceptance boundary

Gate 5.1 does not promise arbitrary Typst-to-HTML conversion, exact-layout
islands, or an embedded PDF.js reader. Those belong to later Gate 5 stages.
This specimen proves only the deployable vertical slice described in
@reading-contract.

== References

#bibliography("references.bib", title: none)
