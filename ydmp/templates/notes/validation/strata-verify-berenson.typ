// Strata visual-validation snapshot of the persisted YDMP VERIFY artifact.
//
// Canonical source:
//   ydmp/papers/berenson-1995-ansi-sql-isolation-levels/study/verification.md
// Source SHA-256:
//   6266bbfa380f5f0fdd6eb319b1e616f7c8664ff859bb13669c4d9c5a0d1ea107
//
// The body was converted to Typst once for visual validation. The Markdown
// artifact remains canonical and must be updated independently.

#import "../template.typ" as notes

#let variant = sys.inputs.at("variant", default: "candidate-strata")

#show: notes.paper_notes.with(
  title: "Verification ledger",
  subtitle: "A Critique of ANSI SQL Isolation Levels · persisted YDMP VERIFY snapshot",
  authors: (
    "Hal Berenson",
    "Philip A. Bernstein",
    "Jim Gray",
    "Jim Melton",
    "Elizabeth J. O'Neil",
    "Patrick E. O'Neil",
  ),
  paper_id: "berenson-1995-ansi-sql-isolation-levels",
  doi: "10.1145/223784.223785",
  stage: "VERIFY · STRATA VALIDATION",
  variant: variant,
)

#notes.evidence("PROVENANCE", variant: variant)[
  Visual snapshot of `study/verification.md`; source SHA-256
  `6266bbfa380f5f0fdd6eb319b1e616f7c8664ff859bb13669c4d9c5a0d1ea107`. The Markdown file remains the canonical verification ledger.
]

#notes.evidence("BOUNDARY", variant: variant)[
  The layout must keep focal-paper claims, corrections, external theory and
  unresolved verification work visibly separable over many pages.
]

This file records source boundaries, corrections, and unresolved issues
for the model derived from `closed-book-recall-001`.

= Focal source
<focal-source>
Hal Berenson, Philip A. Bernstein, Jim Gray, Jim Melton, Elizabeth J.
O’Neil, and Patrick E. O’Neil. #emph[A Critique of ANSI SQL Isolation
Levels];. SIGMOD ’95, pp.~1-10. DOI `10.1145/223784.223785`.

The repository’s PREPARE packet records the selected PDF version,
alternate ACM SIGMOD Record DOI, MSR technical report identity, arXiv
deposit, DBLP entry, and metadata conflicts.

= Verification policy
<verification-policy>
The dialogue contained three kinds of material:

+ definitions, histories, tables, and claims directly present in the
  focal paper;
+ deductions from those definitions used to explain cycles and lock
  behavior;
+ external background on multiversion serialization graphs, PostgreSQL
  cursors, and predicate-aware dependencies.

Only the first category is labelled `CONFIRMED` by the focal paper. The
second is `INFERRED`; the third is `EXTERNAL` or `ARTICLE-ADJACENT`
until checked against its own primary source.

= Confirmed focal-paper claims
<confirmed-focal-paper-claims>
== ANSI ambiguity and broad phenomena
<ansi-ambiguity-and-broad-phenomena>
- ANSI’s English definitions admit strict and broad interpretations.
- The strict `A1-A3` definitions can allow histories excluded by broader
  `P1-P3` phenomena.
- Dirty Write `P0` must be prohibited even at the weakest level.
- Lost Update, Cursor Stability, Read Skew, Write Skew, and Snapshot
  Isolation are needed to describe practical isolation behavior more
  accurately.

== Snapshot Isolation
<snapshot-isolation>
- SI reads from a snapshot fixed by a start point.
- First-Committer-Wins prevents concurrent transactions that update the
  same logical data item from both committing.
- SI prevents Lost Update but permits Write Skew when write sets do not
  overlap.
- SI and classical locking Repeatable Read are incomparable.
- strict repeated-read phantoms differ from broader predicate
  interference.

== Summary structures
<summary-structures>
- Figure 2 presents a hierarchy/partial ordering of isolation levels.
- Table 4 compares phenomena across levels, including Snapshot
  Isolation.

#pagebreak()

= Corrections made during the session
<corrections-made-during-the-session>
== 1. A2 versus P2
<a2-versus-p2>
#strong[Earlier learner model:] `P2` was described primarily as
cross-object Read Skew.

#strong[Correction:] `P2` is the broader read/write overlap on an item
before the reader finishes; a second read is not required. `A5A` is the
named multi-item Read Skew pattern. A read-skew example can contain
relevant dependencies, but it is not the definition of `P2`.

== 2. A3 under Snapshot Isolation
<a3-under-snapshot-isolation>
#strong[Earlier explanation risk:] the prevention of strict `A3` was
briefly tied to write-set intersection.

#strong[Correction:] strict `A3` can involve a read-only transaction, so
First-Committer-Wins is irrelevant. A fixed snapshot prevents the
repeated predicate read from observing the later committed row. Broad
predicate `P3` can still arise through disjoint witness writes.

== 3. P0 and P4 under Snapshot Isolation
<p0-and-p4-under-snapshot-isolation>
#strong[Earlier learner model:] creating separate physical versions was
treated as the reason Dirty Write and Lost Update are impossible.

#strong[Correction:] physical multiversion storage alone does not
guarantee this. The operative rule is conflict validation over the same
logical data item: First-Committer-Wins permits only one of the
concurrent writers to commit.

== 4. A5A database state
<a5a-database-state>
#strong[Earlier learner model:] canonical Read Skew was said to violate
both the observed view and the committed database state.

#strong[Correction:] the database can move only through valid committed
states while a reader combines old and new components into an impossible
local view. Persistent final-state corruption is characteristic of the
canonical Write Skew example, not required for Read Skew.

== 5. Cursor Stability
<cursor-stability>
#strong[Earlier learner model:] Cursor Stability was interpreted as
freezing the entire cursor result set.

#strong[Correction:] the classical protocol protects only the current
cursor row until movement, closure, or positioned update. It prevents
`P4C`, not all Lost Update, P2, or phantom histories.

== 6. Version-order dependencies
<version-order-dependencies>
#strong[Earlier learner model:] reversing a version order was expected
to make a reader/writer dependency disappear.

#strong[Correction:] one of two constraints is needed. Either the other
version’s writer precedes the writer of the read version, or the reader
precedes the writer of the later version. The dependency changes form
rather than vanishing.

#pagebreak()

= External and article-adjacent material
<external-and-article-adjacent-material>
== MVSG and one-copy serializability
<mvsg-and-one-copy-serializability>
The focal paper invokes multiversion histories but is not a
self-contained textbook treatment of MVSG. The following explanations
are retained as `ARTICLE-ADJACENT`:

- explicit `wr`, `ww`, and `rw` edge taxonomy;
- the need for reads-from plus per-object version order;
- the criterion involving existence of an acyclic MVSG for some version
  order;
- preservation of reads-from and final writers in one-copy equivalence;
- computational questions about recognizing one-copy serializability.

These should be verified against the original multiversion
concurrency-control literature before being promoted to `CONFIRMED` in a
dedicated module.

== Predicate-aware MVSG
<predicate-aware-mvsg>
The session introduced witness objects, negative/absence observations,
and absent or tombstone versions to explain predicate Write Skew. This
is a useful teaching model, but it was not established as the exact
formal construction of the focal paper.

Status: `ARTICLE-ADJACENT / DEFERRED`.

Required verification:

- identify a primary source defining predicate reads in multiversion
  serialization graphs;
- determine whether absent versions are formal objects or explanatory
  notation;
- distinguish predicate locks, serialization dependencies, and SSI’s
  practical conflict tracking.

== PostgreSQL cursor mapping
<postgresql-cursor-mapping>
The explanation of PostgreSQL `Portal`, `WHERE CURRENT OF`, and
`SELECT FOR UPDATE` is implementation-specific and not part of the focal
paper.

Status: `EXTERNAL / POSTGRESQL`.

It should be verified separately against the target PostgreSQL source
version before use in an implementation document.

#pagebreak()

= Formal caveats retained
<formal-caveats-retained>
== Single-valued phenomena applied to multiversion histories
<single-valued-phenomena-applied-to-multiversion-histories>
`P1-P3` were formulated in a single-valued-history vocabulary. A
statement such as "SI prevents P2" in a summary table must not be
expanded into "SI has no read/write anti-dependencies." Write Skew
demonstrates that such dependencies can exist even though a transaction
repeatedly sees the same snapshot version.

== Patterns versus application anomalies
<patterns-versus-application-anomalies>
A pattern such as `A5A` or `A5B` is dangerous only when an application
relies on an invariant connecting the affected objects. The graph
pattern does not by itself imply that every application state is
invalid.

== Locking Repeatable Read naming
<locking-repeatable-read-naming>
The paper’s locking Repeatable Read must not be identified with
PostgreSQL `REPEATABLE READ`, which is a Snapshot Isolation
implementation.

#pagebreak()

= Session-process correction
<session-process-correction>
The recall expanded from diagnosis into instruction and then into theory
beyond the paper. The new protocol fixes this by inserting CAPTURE after
a bounded recall pass and moving detailed reconstruction to MODEL.

Historical conclusion:

```text
PREPARE               completed
READ-1                 completed
CLOSED-BOOK RECALL     completed, but overextended
CAPTURE                 completed
MODEL                   partial
VERIFY                  partial
MVSG deep module        deferred
```

#pagebreak()

= Unresolved verification queue
<unresolved-verification-queue>
+ Verify the exact formal version-order/MVSG theorem from its original
  source.
+ Verify predicate-aware multiversion dependency construction from a
  primary source rather than from explanatory reconstruction.
+ Re-read the paper’s final Table 4 and independently reproduce every SI
  cell.
+ Reconstruct H1-H5 and check every serialization-order argument against
  the printed histories.
+ Keep PostgreSQL-specific cursor and SSI mappings in separate
  implementation notes.
