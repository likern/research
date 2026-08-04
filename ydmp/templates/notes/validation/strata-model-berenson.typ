// Strata visual-validation snapshot of the persisted YDMP MODEL artifact.
//
// Canonical source:
//   ydmp/papers/berenson-1995-ansi-sql-isolation-levels/study/model.md
// Source SHA-256:
//   1769ea8e01973e35ef083fbba4757d45b7d81e08da59d44119171f21a417191d
//
// The body was converted to Typst once for visual validation. The Markdown
// artifact remains canonical and must be updated independently.

#import "../template.typ" as notes

#let variant = sys.inputs.at("variant", default: "candidate-strata")

#show: notes.paper_notes.with(
  title: "Canonical model",
  subtitle: "A Critique of ANSI SQL Isolation Levels · persisted YDMP MODEL snapshot",
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
  stage: "MODEL · STRATA VALIDATION",
  variant: variant,
)

#notes.evidence("PROVENANCE", variant: variant)[
  Visual snapshot of `study/model.md`; source SHA-256
  `1769ea8e01973e35ef083fbba4757d45b7d81e08da59d44119171f21a417191d`. The Markdown file remains the canonical model.
]

#notes.evidence("BOUNDARY", variant: variant)[
  This fixture tests long-form hierarchy, histories, code, evidence vocabulary
  and print rhythm. It does not change the evidentiary status of any claim.
]

This file is the corrected conceptual model extracted from the first
reading and `closed-book-recall-001`. It is organized by concept rather
than by dialogue order. The historical learner answers remain in the
session record.

= Evidence scope
<evidence-scope>
- #strong[CONFIRMED] — directly supported by the focal paper.
- #strong[INFERRED] — follows from the paper’s definitions and
  histories.
- #strong[EXTERNAL] — general concurrency-control theory used to explain
  the paper.
- #strong[ARTICLE-ADJACENT] — relevant, but not required for mastery of
  this paper.
- #strong[POSTGRESQL] — mapping to PostgreSQL behavior, not a claim
  about the paper.

= 1. The paper’s central problem
<the-papers-central-problem>
#strong[CONFIRMED.] The ANSI SQL isolation levels are described by
English-language prohibitions on a small set of anomalies. The language
is not mathematically precise enough to determine one unique set of
allowed histories.

The paper distinguishes two readings:

- a narrow anomaly reading, conventionally written `A1`, `A2`, `A3`;
- a broader phenomenon reading, written `P1`, `P2`, `P3`.

The narrow definitions wait for a particular observable outcome, such as
an abort or a repeated read. The broad definitions reject the dangerous
interleaving itself before the eventual outcome is known. This
difference is not cosmetic: the narrow interpretation admits
nonserializable histories that the broad interpretation excludes.

The authors also argue that the standard’s anomaly list is incomplete.
They add or discuss `P0 Dirty Write`, `P4 Lost Update`, cursor-specific
lost update, `A5A Read Skew`, `A5B Write Skew`, and Snapshot Isolation.

= 2. A1 versus P1: Dirty Read
<a1-versus-p1-dirty-read>
A narrow Dirty Read has the shape:

```text
w1[x] ... r2[x] ... a1
```

The abort is part of `A1`. This is too narrow because `T2` has already
consumed an uncommitted value before anyone knows whether `T1` will
commit or abort.

The broad phenomenon forbids:

```text
w1[x] ... r2[x] ... before c1 or a1
```

#strong[INFERRED.] The defect exists independently of the writer’s later
result. If `T1` commits, `T2` still read a value whose durability and
visibility were not yet established at the time of the read.

= 3. A2 versus P2: Non-repeatable and Fuzzy Read
<a2-versus-p2-non-repeatable-and-fuzzy-read>
The narrow anomaly requires a repeated read of the same item and a
changed result:

```text
r1[x] ... w2[x] ... c2 ... r1[x]
```

The broad phenomenon is the unfinished-transaction read/write overlap:

```text
r1[x] ... w2[x] ... before c1 or a1
```

A second `r1[x]` is not required. The risk is that `T1` has made a
decision from a value that another transaction changes before `T1`
completes.

`A5A Read Skew` is a more semantic multi-item example of inconsistent
observation. It should not be used as the definition of `P2`, although a
read-skew history contains read/write dependencies of the same general
kind.

= 4. A3 versus P3: Phantom and predicate interference
<a3-versus-p3-phantom-and-predicate-interference>
The narrow phantom anomaly requires two evaluations of the same
predicate:

```text
r1[P] ... w2[y in P] ... c2 ... r1[P]
```

The broad phenomenon does not require the repeated predicate read:

```text
r1[P] ... w2[y in P] ... before c1 or a1
```

`w2[y in P]` is conceptually broader than only an `INSERT`. An `UPDATE`
can move a row into or out of the predicate result, and a `DELETE` can
remove one.

A predicate operation can be dangerous even when the reader never
executes the query twice. The reader may combine the earlier predicate
result with another value or may write a different row after checking a
predicate invariant.

== Predicate Write Skew
<predicate-write-skew>
Let `P` be active tasks and let the invariant be:

```text
SUM(hours WHERE active) <= 8
```

Both transactions read sum `7`, then insert different one-hour tasks:

```text
T1: r1[P, SUM=7]  w1[a in P]
T2: r2[P, SUM=7]  w2[b in P]
```

The logical write sets are `{a}` and `{b}`, so Snapshot Isolation’s
First-Committer-Wins rule does not see a write/write collision. Both can
commit, producing sum `9`.

Strict `A3` is absent because neither transaction repeats `r[P]`. Broad
`P3` is present because each predicate read is followed by the other
transaction’s write affecting that predicate.

= 5. P0 Dirty Write
<p0-dirty-write>
Dirty Write is the overlap:

```text
w1[x] ... w2[x] ... before c1 or a1
```

No read is required.

== Why it must be forbidden
<why-it-must-be-forbidden>
#strong[CONFIRMED.] There are two independent arguments.

=== 5.1 Invariant fragmentation
<invariant-fragmentation>
Suppose the invariant is `x = y`. Each transaction independently
preserves it:

```text
T1: x := 1; y := 1
T2: x := 2; y := 2
```

An interleaving with dirty overwrites can leave `x = 2, y = 1`, a final
state assembled from incompatible fragments of the two transactions.

=== 5.2 Undo ambiguity
<undo-ambiguity>
If `T2` overwrites the uncommitted value of `T1`, then a simple
before-image undo cannot safely restore one transaction without
affecting the other. Undoing `T1` may erase `T2`; undoing `T2` may
restore a value written by an already aborted `T1`.

This is why practical locking protocols hold write locks until commit or
abort.

= 6. P4 Lost Update
<p4-lost-update>
Lost Update requires a stale read:

```text
r1[x] ... w2[x] ... w1[x] ... c1
```

`T1` computes its later write from the old value read before `T2`
changed the item. `T2` may already have committed when `T1` writes, so
no Dirty Write is necessary.

Example:

```text
x = 100
T1 reads 100
T2 reads 100, writes 120, commits
T1 writes 130 from the stale 100
```

The intended combined result was `150`; one increment is lost.

== Locking Read Committed
<locking-read-committed>
Long-duration write locks prevent `P0`: a second writer must wait for
the first writer to finish. Short-duration read locks still allow `P4`:
after `T1` releases its read lock, `T2` may update and commit, and `T1`
can later write a stale application-computed value.

= 7. Cursor Stability
<cursor-stability>
Cursor Stability does not freeze the whole result set. It extends
locking Read Committed by retaining the read lock on the #strong[current
cursor row] until the cursor moves, closes, or updates that row.

It prevents cursor-specific lost update `P4C`, where a row fetched
through a cursor is changed by another transaction before
`WHERE CURRENT OF` updates it.

It remains weaker than locking Repeatable Read because:

- previously visited rows are unlocked after cursor movement;
- ordinary reads are not protected until transaction end;
- predicate results and possible phantoms are not frozen.

#strong[POSTGRESQL.] PostgreSQL does not expose Cursor Stability as a
separate isolation level. A cursor with `FOR UPDATE` is a practical but
stricter analogue for fetched rows because PostgreSQL row locks normally
last until transaction end.

= 8. Snapshot Isolation: two independent rules
<snapshot-isolation-two-independent-rules>
== 8.1 Snapshot visibility rule
<snapshot-visibility-rule>
A transaction reads from a fixed snapshot. Conceptually it sees the
newest committed version whose commit point precedes the transaction’s
start point, plus its own writes.

A transaction that started earlier but committed after the snapshot was
taken is not visible. Start order of the writer is not enough; snapshot
membership is about whether the version was committed before the
snapshot boundary.

== 8.2 First-Committer-Wins
<first-committer-wins>
Two concurrent transactions cannot both commit if their logical write
sets intersect:

```text
WS(T1) intersect WS(T2) != empty
```

The transaction that reaches successful commit first wins; the competing
writer must abort or be rejected.

The rule is not based merely on which transaction is older. Concurrent
transactions with disjoint write sets may both commit.

= 9. Lost Update versus Write Skew under SI
<lost-update-versus-write-skew-under-si>
== Lost Update
<lost-update>
Both transactions write the same logical item:

```text
WS(T1) = {x}
WS(T2) = {x}
```

First-Committer-Wins rejects one transaction. Creating physical versions
alone is not the protection; the decisive mechanism is logical
write-conflict validation.

== Write Skew
<write-skew>
Both transactions read a shared invariant but write different items:

```text
Initial: x = 1, y = 1
Invariant: x + y >= 1

T1 reads x,y; writes x := 0
T2 reads x,y; writes y := 0
```

The write sets are disjoint. Both commits are allowed, producing
`x = 0, y = 0`.

In a dependency graph the cycle is formed by two crossing `rw`
anti-dependencies:

```text
T1 --rw(y)--> T2
T2 --rw(x)--> T1
```

There is no mutual `wr` edge because neither transaction reads the
other’s new version, and no mutual `ww` edge because they write
different logical items.

= 10. A5A Read Skew versus A5B Write Skew
<a5a-read-skew-versus-a5b-write-skew>
== A5A Read Skew
<a5a-read-skew>
Let the invariant be `x + y = 100`. The database moves atomically from
`(50,50)` to `(10,90)`. Both committed states are valid.

A transaction that observes old `x = 50` and new `y = 90` constructs the
impossible view `(50,90)`. The inconsistency is in the transaction’s
observation; the committed database need never violate the invariant.

== A5B Write Skew
<a5b-write-skew>
Each transaction reads a consistent state and makes a locally valid
decision, but their disjoint writes combine into an invalid committed
state. This is a persistent invariant violation, not merely a mixed read
view.

Patterns do not violate a business invariant automatically. They are
dangerous when the application relies on a relationship between the
affected items.

= 11. Locking Repeatable Read and Snapshot Isolation are incomparable
<locking-repeatable-read-and-snapshot-isolation-are-incomparable>
Neither set of allowed histories contains the other.

== Allowed by locking RR, prevented by SI
<allowed-by-locking-rr-prevented-by-si>
Without long predicate/range locks, locking Repeatable Read can protect
every existing row read by `T1` yet allow `T2` to insert a new row
satisfying `P`. A repeated predicate query can observe a phantom. SI’s
fixed snapshot returns the same result set.

== Allowed by SI, prevented by locking RR
<allowed-by-si-prevented-by-locking-rr>
SI allows Write Skew with disjoint write sets. Under locking Repeatable
Read, long read locks on both `x` and `y` make the later lock upgrades
conflict. The transactions block or deadlock, and both cannot commit in
the dangerous form.

Therefore isolation levels form a partial order, not always a single
strength ladder.

#strong[POSTGRESQL.] PostgreSQL `REPEATABLE READ` is Snapshot Isolation,
not the classical locking Repeatable Read used in this comparison.

= 12. Snapshot Isolation and the summary anomaly table
<snapshot-isolation-and-the-summary-anomaly-table>
The useful causal mapping is:

== Prevented by the fixed snapshot
<prevented-by-the-fixed-snapshot>
- Dirty Read / `P1` — uncommitted versions are absent.
- strict non-repeatable read / `A2` — repeated reads use the same
  snapshot.
- strict phantom / `A3` — repeated predicate reads use the same
  snapshot.
- `A5A Read Skew` — related items come from one snapshot state.

== Prevented by First-Committer-Wins
<prevented-by-first-committer-wins>
- `P0 Dirty Write` — competing logical writers cannot both commit.
- `P4 Lost Update` and `P4C` — both transactions write the same logical
  item.

== Still possible
<still-possible>
- `A5B Write Skew` — disjoint writes can encode crossing read/write
  conflicts.
- some broad `P3` histories — predicate interference may occur without a
  repeated observed phantom.

== Important formal caveat
<important-formal-caveat>
The original `P1-P3` notation was designed around single-valued
histories. Applying it to multiversion systems requires care. The
absence of a visible non-repeatable read does not mean SI has no `rw`
anti-dependencies; Write Skew is built from them.

= 13. Multiversion notation
<multiversion-notation>
#strong[ARTICLE-ADJACENT.] The following material supports the paper’s
SI analysis but requires dedicated multiversion theory for full mastery.

```text
r_i[x_j]
```

means transaction `T_i` read version `x_j` created by transaction `T_j`.

Two structures are required before building a multiversion serialization
graph:

+ #strong[reads-from] — which writer supplied every read;
+ #strong[version order] — a total order over versions of each logical
  object.

Reads-from creates a writer-to-reader requirement:

```text
T_j --wr--> T_i
```

This edge alone is insufficient. If another transaction `T_k` writing
`x` were placed between `T_j` and `T_i` in a single-copy serial history,
then `T_i` would read `T_k`’s value instead of `T_j`’s.

Version-order-derived edges force `T_k` either before the writer of the
read version or after its reader.

= 14. One-copy serializability
<one-copy-serializability>
A multiversion history is one-copy serializable when it is
observationally equivalent to some serial history over one logical copy
of every object.

The histories are not physically identical and their graphs need not be
identical. The equivalence preserves at least:

- which logical writer supplies each read;
- the final logical writer or final logical state of every object.

A multiversion serialization graph is a method for checking whether an
appropriate serial order exists; it is not itself the history to which
the execution is equivalent.

= 15. Version-order alternatives in MVSG
<version-order-alternatives-in-mvsg>
For a read `r_k[x_j]` and another writer `T_i` producing `x_i`, a chosen
version order induces one of two constraints:

- if `x_i` is earlier than `x_j`, then the writer of `x_i` must precede
  the writer of `x_j`;
- if `x_j` is earlier than `x_i`, then the reader `T_k` must precede the
  writer `T_i`.

Reversing version order does not simply delete the dependency; it
changes which edge is needed to preserve the read.

Initial versions are normally fixed before later versions. For canonical
Write Skew this yields the two crossing `rw` anti-dependencies directly.

= 16. Predicate-aware MVSG boundary
<predicate-aware-mvsg-boundary>
#strong[ARTICLE-ADJACENT / DEFERRED.] A predicate read observes not just
concrete returned rows but also the absence of rows that would have
satisfied the predicate. A later concrete write can serve as a witness
that the query result would differ.

A useful explanatory notation is:

```text
T1 --rw[P, witness b]--> T2
```

However, absent-version objects, witness expansion, and a fully formal
predicate-aware MVSG construction are not developed sufficiently in the
focal paper to make them a required result of this reading. They belong
in a separate primary-source module.

= 17. Practical reading checkpoint
<practical-reading-checkpoint>
The first pass succeeded without complete mastery. The durable results
are:

- the ANSI anomaly definitions are ambiguous and incomplete;
- broad phenomena prohibit dangerous interleavings more reliably than
  narrow observed anomalies;
- Snapshot Isolation combines a stable snapshot with write/write
  validation;
- those rules prevent Lost Update but not Write Skew;
- locking Repeatable Read and SI are incomparable;
- multiversion graph theory is a separate prerequisite, not something to
  force into an indefinitely long closed-book recall.

The next deep-read task is to reconstruct `H1-H5`, Figure 2, and Table 4
from the definitions before returning to general MVSG theory.
