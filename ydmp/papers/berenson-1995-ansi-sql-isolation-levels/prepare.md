# YDMP PREPARE

## A Critique of ANSI SQL Isolation Levels

| Поле | Значение |
|---|---|
| Paper ID | `berenson-1995-ansi-sql-isolation-levels` |
| Авторы | Hal Berenson, Philip A. Bernstein, Jim Gray, Jim Melton, Elizabeth J. O'Neil, Patrick E. O'Neil |
| Публикация | SIGMOD '95, 1995, pp. 1-10 |
| DOI | `10.1145/223784.223785` |
| Selected version | Uploaded 12-page PDF: repository copy carrying the MSR-TR-95-51 cover and the SIGMOD '95 article text |
| PDF SHA-256 | `734e83d498b9730ed5a2c73edbff9785df965b64f67a4924ea2672d7f757c818` |
| Curriculum | Isolation и consistency (stage 1) |

## Evidence legend

- **CONFIRMED** — directly supported by an opened source or inspected PDF.
- **INFERRED** — derived from confirmed facts or learner-profile context.
- **HYPOTHESIS** — requires later verification.

## Почему сейчас

**INFERRED** — The paper supplies the anomaly vocabulary and dependency-oriented questions needed to compare YDB transaction guarantees without equating product-level names such as REPEATABLE READ or SERIALIZABLE with one implementation mechanism.

## Ожидаемая проблема

**CONFIRMED** — The SQL-92 definition by three English-language phenomena does not uniquely characterize widely deployed locking and multiversion isolation behaviors.

## Ожидаемый вклад

- **CONFIRMED** — Disambiguate strict anomaly instances A1-A3 from broader prohibited phenomena P1-P3.
- **CONFIRMED** — Add and use further phenomena, especially Dirty Write (P0), Lost Update (P4), Read Skew (A5A), and Write Skew (A5B).
- **CONFIRMED** — Define Snapshot Isolation using a transaction snapshot and a first-committer-wins rule, then place it in a partial order of isolation types.

## Selected version и конфликты metadata

**INFERRED** — This copy is complete and locally inspectable, contains the technical-report cover, article body, figures, tables, and references. Cite the canonical ACM proceedings DOI while reading this PDF. Its 2007 PDF metadata is consistent with a later repository deposit, not with a new publication.

- **CONFIRMED — DOI**: ACM exposes two records for the same title and pages: 10.1145/223784.223785 for the SIGMOD '95 proceedings and 10.1145/568271.223785 for ACM SIGMOD Record 24(2). **Resolution:** Use the DOI supplied by the user as canonical; preserve the SIGMOD Record DOI as an alternate identifier.
- **CONFIRMED — publication year/date**: ResearchGate labels the supplied page January 2007, while ACM and the article identify the work as a 1995 publication; arXiv records a 2007 deposit. **Resolution:** Treat 1995 as the publication year and 2007 as repository/mirror metadata, not a new canonical publication.
- **CONFIRMED — pagination**: Canonical publication metadata says pages 1-10, while the uploaded PDF has 12 physical pages: a report cover plus article pages whose footer runs through -11. **Resolution:** Preserve canonical citation pages and record PDF page count separately.
- **CONFIRMED — Jim Gray affiliation**: The technical-report cover lists Microsoft Corp.; the article body lists U.C. Berkeley. **Resolution:** Preserve both source-specific affiliations.

## Scope чтения

**CONFIRMED** — Use this packet to orient attention; do not treat it as a replacement for deriving the example histories and comparisons.

### Первый проход

- Abstract and §1: intended failure of the ANSI taxonomy.
- §2.1-2.3: history, dependency graph, phenomena, and locking model.
- §3: P0 plus the strict/broad interpretation argument.
- §4.2: Snapshot Isolation and the H5 counterexample.
- Figure 2 and Table 4: final partial-order map.

### Вывести самостоятельно

- For H1-H5, write the dependency edges before reading the authors' conclusion.
- For each table row, distinguish item locks from predicate locks.
- For Snapshot Isolation, separate read visibility from commit validation.

### Можно отложить

- Detailed proof references to the longer OOBBGM version can be deferred until the paper's examples and definitions are stable.
- Product-specific historical claims about 1990s implementations are context, not the first-pass learning target.

## Potentially unknown terms

| Термин | Класс | Основание | Действие при чтении |
|---|---|---|---|
| phenomenon P_i versus anomaly A_i | paper_defined / INFERRED | The notation is specific to this paper and may differ from the terminology used in PostgreSQL internals. | Record the quantifier/commit-abort difference, not only the name. |
| Degrees of Consistency (GLPT) | deferrable / INFERRED | This historical naming is less likely to be central in a modern PostgreSQL-oriented mental model. | Map Degree 1/2/3 only after the locking table is clear. |
| predicate lock as protection of a logical, possibly absent set | prerequisite / INFERRED | The paper uses a broader formal object than a row lock and ties it directly to P3. | Translate each predicate read into the set of possible conflicting writes. |
| MV-history and view equivalence | prerequisite / INFERRED | The paper sketches this formal bridge but delegates fuller treatment to earlier literature and a longer version. | Do not assume a single-version history preserves version choice. |
| Cursor Stability | paper_defined / INFERRED | It is a historically important intermediate isolation type but not a standard term in all current DBMS discussions. | Track exactly how long the current cursor row stays protected. |
| first-committer-wins | paper_defined / INFERRED | The implementation idea may be familiar through MVCC, while the paper's timestamp interval formulation is more specific. | Write down the tested overlap of write sets at commit. |

## Вопросы перед чтением

Q1. **problem** — Which ambiguity in the SQL-92 prose lets two readers assign different operational meaning to the same named phenomenon?
Q2. **model** — What information must a history and its dependency graph retain for the paper's serializability comparisons?
Q3. **model** — How do the broad P1-P3 patterns differ logically from the strict A1-A3 anomaly instances?
Q4. **mechanism** — For P0-P3, which lock scope and duration would exclude each pattern in a single-version scheduler?
Q5. **invariants** — Why does Dirty Write matter simultaneously to database constraints and to rollback/recovery semantics?
Q6. **mechanism** — What additional protection does Cursor Stability add to READ COMMITTED, and where does that protection stop?
Q7. **mechanism** — Which two independent rules define Snapshot Isolation's read visibility and commit eligibility?
Q8. **failures** — Can you derive the dependency cycle in H5 without relying on the label Write Skew?
Q9. **failures** — Which counterexamples are needed to show that Snapshot Isolation and locking REPEATABLE READ are incomparable?
Q10. **evaluation** — Which claims are supported by constructed histories, equivalence arguments, or cited proofs, and which are merely implementation observations?
Q11. **YDB mapping** — Which YDB guarantees would need to be expressed as visibility, conflict, and commit-order rules before comparing them with this paper's levels?
Q12. **YDB mapping** — Across multiple DataShard participants, where would read-set, write-set, and predicate dependencies have to be detected or conservatively represented?

## Сравнения, которые стоит удерживать

- **SQL-92 strict A1-A3 versus broad P1-P3** — Separate observed symptoms from prohibited execution patterns.
- **locking REPEATABLE READ versus Snapshot Isolation** — Practice partial-order reasoning rather than a linear strength ranking.
- **Cursor Stability versus READ COMMITTED** — Identify a mechanism-specific intermediate guarantee.
- **PostgreSQL REPEATABLE READ and SERIALIZABLE** — Use existing PostgreSQL knowledge as a later verification target; do not import its semantics into the 1995 definitions.
- **Adya's generalized isolation model** — Follow-up reading for a more general dependency taxonomy.

## YDB mapping hypotheses

- **HYPOTHESIS** — The paper's dependency-graph questions can be reused to specify cross-DataShard anomalies, but YDB's actual graph edges and validation points must be verified from authoritative YDB sources.
- **HYPOTHESIS** — Snapshot Isolation's first-committer-wins rule may be a useful comparison target for YDB optimistic-lock or write-conflict handling; equivalence must not be assumed.
- **HYPOTHESIS** — P3 highlights the need to reason about predicate or range reads whose conflicting writes may occur on different shards.
- **HYPOTHESIS** — The Start-Timestamp/Commit-Timestamp split may prepare later analysis of YDB logical time, PlanStep, and visibility, but this paper alone does not establish that mapping.

## Осмотренные диаграммы и таблицы

- **PDF p. 4, Table 1** — Separate the original ANSI matrix from the paper's later corrected characterization. (CONFIRMED)
- **PDF p. 5, Table 2** — Track lock scope, mode, and duration rather than treating isolation-level names as sufficient semantics. (CONFIRMED)
- **PDF p. 7, Table 3** — Use this as the paper's repaired P0-P3 matrix, not as a complete multiversion taxonomy. (CONFIRMED)
- **PDF p. 11, Figure 2 and Table 4** — Reconstruct the partial order and note the incomparable branches rather than memorizing a single linear ladder. (CONFIRMED)

## Authoritative sources

- **CONFIRMED — ACM Digital Library**: canonical conference identity, DOI, venue, pages. https://dl.acm.org/doi/10.1145/223784.223785
- **CONFIRMED — Microsoft Research**: technical-report identity MSR-TR-95-51, date, authors, abstract. https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/
- **CONFIRMED — arXiv**: official repository identifier and 2007 deposit date. https://arxiv.org/abs/cs/0701157
- **CONFIRMED — DBLP**: independent bibliographic cross-check. https://dblp.org/rec/conf/sigmod/BerensonBGMOO95.html

## Unresolved

- **HYPOTHESIS** — Is the uploaded PDF byte-identical to the current Microsoft Research download or the arXiv PDF? Not established; the local file was hashed, but remote bytes were not downloaded for comparison.
- **HYPOTHESIS** — Does the longer OOBBGM version contain proofs or definitions materially different from this 1995 text? Deferred to follow-up bibliographic resolution.

## Validation

- JSON Schema: `passed`
- YAML/JSON semantic equality: `true`
- Curriculum stage exists: `true`
- Selected version explicit: `true`
- Authoritative source present: `true`
- GitHub updated: `true` — `likern/research`, branch `ydmp/berenson-1995-prepare`
- DuckDB updated: `false`

Рекомендуемый путь:
`ydmp/papers/berenson-1995-ansi-sql-isolation-levels/`
