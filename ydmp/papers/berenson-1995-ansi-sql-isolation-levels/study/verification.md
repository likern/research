# Verification ledger

This file records source boundaries, corrections, and unresolved issues for the
model derived from `closed-book-recall-001`.

## Focal source

Hal Berenson, Philip A. Bernstein, Jim Gray, Jim Melton, Elizabeth J. O'Neil,
and Patrick E. O'Neil. *A Critique of ANSI SQL Isolation Levels*. SIGMOD '95,
pp. 1-10. DOI `10.1145/223784.223785`.

The repository's PREPARE packet records the selected PDF version, alternate ACM
SIGMOD Record DOI, MSR technical report identity, arXiv deposit, DBLP entry, and
metadata conflicts.

## Verification policy

The dialogue contained three kinds of material:

1. definitions, histories, tables, and claims directly present in the focal
   paper;
2. deductions from those definitions used to explain cycles and lock behavior;
3. external background on multiversion serialization graphs, PostgreSQL
   cursors, and predicate-aware dependencies.

Only the first category is labelled `CONFIRMED` by the focal paper. The second
is `INFERRED`; the third is `EXTERNAL` or `ARTICLE-ADJACENT` until checked
against its own primary source.

## Confirmed focal-paper claims

### ANSI ambiguity and broad phenomena

- ANSI's English definitions admit strict and broad interpretations.
- The strict `A1-A3` definitions can allow histories excluded by broader
  `P1-P3` phenomena.
- Dirty Write `P0` must be prohibited even at the weakest level.
- Lost Update, Cursor Stability, Read Skew, Write Skew, and Snapshot Isolation
  are needed to describe practical isolation behavior more accurately.

### Snapshot Isolation

- SI reads from a snapshot fixed by a start point.
- First-Committer-Wins prevents concurrent transactions that update the same
  logical data item from both committing.
- SI prevents Lost Update but permits Write Skew when write sets do not overlap.
- SI and classical locking Repeatable Read are incomparable.
- strict repeated-read phantoms differ from broader predicate interference.

### Summary structures

- Figure 2 presents a hierarchy/partial ordering of isolation levels.
- Table 4 compares phenomena across levels, including Snapshot Isolation.

## Corrections made during the session

### 1. A2 versus P2

**Earlier learner model:** `P2` was described primarily as cross-object Read
Skew.

**Correction:** `P2` is the broader read/write overlap on an item before the
reader finishes; a second read is not required. `A5A` is the named multi-item
Read Skew pattern. A read-skew example can contain relevant dependencies, but it
is not the definition of `P2`.

### 2. A3 under Snapshot Isolation

**Earlier explanation risk:** the prevention of strict `A3` was briefly tied to
write-set intersection.

**Correction:** strict `A3` can involve a read-only transaction, so
First-Committer-Wins is irrelevant. A fixed snapshot prevents the repeated
predicate read from observing the later committed row. Broad predicate `P3`
can still arise through disjoint witness writes.

### 3. P0 and P4 under Snapshot Isolation

**Earlier learner model:** creating separate physical versions was treated as
the reason Dirty Write and Lost Update are impossible.

**Correction:** physical multiversion storage alone does not guarantee this.
The operative rule is conflict validation over the same logical data item:
First-Committer-Wins permits only one of the concurrent writers to commit.

### 4. A5A database state

**Earlier learner model:** canonical Read Skew was said to violate both the
observed view and the committed database state.

**Correction:** the database can move only through valid committed states while
a reader combines old and new components into an impossible local view.
Persistent final-state corruption is characteristic of the canonical Write
Skew example, not required for Read Skew.

### 5. Cursor Stability

**Earlier learner model:** Cursor Stability was interpreted as freezing the
entire cursor result set.

**Correction:** the classical protocol protects only the current cursor row
until movement, closure, or positioned update. It prevents `P4C`, not all Lost
Update, P2, or phantom histories.

### 6. Version-order dependencies

**Earlier learner model:** reversing a version order was expected to make a
reader/writer dependency disappear.

**Correction:** one of two constraints is needed. Either the other version's
writer precedes the writer of the read version, or the reader precedes the
writer of the later version. The dependency changes form rather than vanishing.

## External and article-adjacent material

### MVSG and one-copy serializability

The focal paper invokes multiversion histories but is not a self-contained
textbook treatment of MVSG. The following explanations are retained as
`ARTICLE-ADJACENT`:

- explicit `wr`, `ww`, and `rw` edge taxonomy;
- the need for reads-from plus per-object version order;
- the criterion involving existence of an acyclic MVSG for some version order;
- preservation of reads-from and final writers in one-copy equivalence;
- computational questions about recognizing one-copy serializability.

These should be verified against the original multiversion concurrency-control
literature before being promoted to `CONFIRMED` in a dedicated module.

### Predicate-aware MVSG

The session introduced witness objects, negative/absence observations, and
absent or tombstone versions to explain predicate Write Skew. This is a useful
teaching model, but it was not established as the exact formal construction of
the focal paper.

Status: `ARTICLE-ADJACENT / DEFERRED`.

Required verification:

- identify a primary source defining predicate reads in multiversion
  serialization graphs;
- determine whether absent versions are formal objects or explanatory notation;
- distinguish predicate locks, serialization dependencies, and SSI's practical
  conflict tracking.

### PostgreSQL cursor mapping

The explanation of PostgreSQL `Portal`, `WHERE CURRENT OF`, and `SELECT FOR
UPDATE` is implementation-specific and not part of the focal paper.

Status: `EXTERNAL / POSTGRESQL`.

It should be verified separately against the target PostgreSQL source version
before use in an implementation document.

## Formal caveats retained

### Single-valued phenomena applied to multiversion histories

`P1-P3` were formulated in a single-valued-history vocabulary. A statement such
as “SI prevents P2” in a summary table must not be expanded into “SI has no
read/write anti-dependencies.” Write Skew demonstrates that such dependencies
can exist even though a transaction repeatedly sees the same snapshot version.

### Patterns versus application anomalies

A pattern such as `A5A` or `A5B` is dangerous only when an application relies on
an invariant connecting the affected objects. The graph pattern does not by
itself imply that every application state is invalid.

### Locking Repeatable Read naming

The paper's locking Repeatable Read must not be identified with PostgreSQL
`REPEATABLE READ`, which is a Snapshot Isolation implementation.

## Session-process correction

The recall expanded from diagnosis into instruction and then into theory beyond
the paper. The new protocol fixes this by inserting CAPTURE after a bounded
recall pass and moving detailed reconstruction to MODEL.

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

## Unresolved verification queue

1. Verify the exact formal version-order/MVSG theorem from its original source.
2. Verify predicate-aware multiversion dependency construction from a primary
   source rather than from explanatory reconstruction.
3. Re-read the paper's final Table 4 and independently reproduce every SI cell.
4. Reconstruct H1-H5 and check every serialization-order argument against the
   printed histories.
5. Keep PostgreSQL-specific cursor and SSI mappings in separate implementation
   notes.
