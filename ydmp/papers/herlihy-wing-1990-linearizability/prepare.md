# YDMP PREPARE

## Linearizability: A Correctness Condition for Concurrent Objects

- **Paper ID:** `herlihy-wing-1990-linearizability`
- **Authors:** Maurice P. Herlihy, Jeannette M. Wing
- **Publication:** ACM Transactions on Programming Languages and Systems 12(3), 463-492 (1990-07)
- **DOI:** `10.1145/78969.78972`
- **Selected version:** Final ACM TOPLAS journal version
- **Curriculum stage:** `isolation-theory` — Isolation и consistency

## Evidence status

**CONFIRMED:** bibliographic identity is resolved against ACM, the author-hosted final PDF, DBLP, and Jeannette Wing's official bibliography.

**CONFIRMED:** выбрана финальная журнальная версия, соответствующая точному DOI пользователя. Доступная author-hosted PDF-копия имеет журнальную пагинацию 463-492 и содержит расширенный материал, отсутствующий или сокращённый в предварительной POPL-версии.

## Why this material now

Статья вводит точную operation-level модель real-time correctness. После разбора transaction isolation она позволяет не смешивать linearizability отдельных операций с serializability транзакций и подготавливает основу для анализа границ объектов, compositionality и порядка событий в YDB.

## Expected problem

CONFIRMED: Как задать семантику concurrent object так, чтобы разрешать перекрывающиеся операции, но рассуждать о них через привычную sequential specification и при этом не нарушать наблюдаемый real-time order?

## Expected contribution

CONFIRMED: Формальное correctness condition, два ключевых structural properties — locality и nonblocking — и proof method, который переносит representation invariant и abstraction function в concurrent domain.

## Selected version and lineage

- **Final journal article** — `selected`; year=1990; venue=ACM Transactions on Programming Languages and Systems 12(3); pages=463-492; doi=10.1145/78969.78972
- **Author-hosted copy of the final journal article** — `recommended_reading_copy`; year=1990; url=https://cs.brown.edu/people/mph/HerlihyW90/p463-herlihy.pdf
- **CMU technical report matching the expanded work** — `not_inspected`; year=1987; report_number=CMU-CS-88-120; date=1987-11
- **Axioms for Concurrent Objects** — `preliminary_shorter_version`; year=1987; venue=14th ACM Symposium on Principles of Programming Languages (POPL '87); pages=13-26; doi=10.1145/41625.41627
- **Axioms for Concurrent Objects technical report** — `earliest_known_report`; year=1986; report_number=CMU-CS-86-154; date=1986-10

## Reading scope

### First-pass priority
- pp. 463-470: abstract, motivation, histories, equivalence, well-formedness, L1/L2 definition
- pp. 470-474: locality, nonblocking, sequential consistency and serializability comparison
- pp. 485-486: Section 6.2 Final Remarks and safety/liveness boundary

### Second priority
- pp. 474-481: why ordinary abstraction functions fail and how set-valued/continually-defined abstractions are used
- pp. 482-484: client-side reasoning about registers and queues

### Defer on READ-1
- line-by-line proof of Theorem 1 locality
- full queue implementation proof obligations
- appendix annotations and Larch-level proof details

### Visual checkpoints
- Figure 1: identify which real-time constraints make H1-H4 acceptable or not
- Figure 2: explain the one-event difference between H5 and H6
- Figure 3: connect sequential queue axioms to legal histories
- Figure 4: track why the set of possible linearized values expands and contracts
- Figure 5: distinguish representation-level and abstract-level possibilities

**Success criterion:** После READ-1 достаточно уметь своими словами сформулировать definition skeleton, объяснить роль real-time order и pending operations, а также назвать locality/nonblocking без воспроизведения полных доказательств.

## Potential terminology barriers

| Term | Classification | Why it may matter | Reading action |
|---|---|---|---|
| `process subhistory H|P and object subhistory H|x` | `paper_defined` | Формальная projection-нотация не указана явно в learner profile, хотя идея projection должна быть знакома системному разработчику. | Зафиксировать, что equivalence определяется по process projections. |
| `pending invocation and complete(H)` | `paper_defined` | Это центральная техника определения linearizability для незавершённых операций. | Проследить, какие pending calls получают response в H' и какие отбрасываются. |
| `real-time precedence relation <_H` | `paper_defined` | Нужно не смешивать с порядком событий одного процесса, serialization order и физическим временем внутри перекрывающихся calls. | Для каждой пары операций решить, сравнимы ли они по <_H. |
| `local correctness property` | `prerequisite` | В статье locality означает object-wise compositionality, а не локальность памяти или узла. | Связать theorem statement с независимой проверкой H|x. |
| `total versus partial operation specification` | `paper_defined` | Nonblocking theorem применим к total operations; blocking Deq на empty queue моделируется иначе. | Отмечать precondition каждой sequential operation. |
| `set-valued, continually-defined abstraction function` | `potentially_unknown` | Learner profile силён в systems implementation, но не заявляет опыт с formal refinement proofs и nondeterministic abstractions. | Сначала понять Figure 4, затем возвращаться к формулам Section 4.3. |
| `linearized value and Lin(H)` | `paper_defined` | Это proof-oriented понятие, отличное от одного выбранного linearization point. | Отслеживать множество допустимых abstract states, а не одно состояние. |
| `Larch and prophecy variables` | `deferrable` | Они важны для истории verification techniques, но не обязательны для первого усвоения definition и properties. | Не углубляться на READ-1; отметить для отдельного MODEL-блока. |

## Questions to hold while reading

1. **problem** — Какие два интуитивных требования к concurrent operations авторы пытаются выразить одним correctness condition?
2. **model** — Почему history состоит из отдельных invocation и response events, а не из уже атомарных операций?
3. **definition** — Зачем определение разрешает сначала расширить H до H', а затем применяет complete(H')?
4. **invariants** — Какие ограничения сохраняет equivalence по process subhistories, а какие добавляет real-time precedence?
5. **mechanism** — Как Figures 1-3 переводят семантику FIFO queue из sequential axioms в критерий приемлемости concurrent histories?
6. **properties** — Почему locality меняет архитектуру proof obligations и scheduling по сравнению с nonlocal correctness conditions?
7. **failure_semantics** — В каких случаях blocking следует из partial sequential specification, а в каких является свойством конкретной реализации?
8. **verification** — Почему single-valued abstraction function оказывается недостаточной для highly concurrent queue?
9. **comparison** — На каком уровне granularity и real-time guarantees различаются linearizability, sequential consistency, serializability и strict serializability?
10. **ydb_mapping** — Какие YDB interfaces разумно моделировать как отдельные linearizable objects, а где требуется transaction-level model?

## Comparison targets

- **Berenson et al. (1995), A Critique of ANSI SQL Isolation Levels** — transaction histories and anomalies versus operation histories over typed objects
- **Lamport sequential consistency** — preservation of process order without the same real-time constraint
- **serializability** — multi-operation transactions and application invariants
- **strict serializability** — transaction-level serial order compatible with real-time precedence; compare granularity with linearizability
- **state-machine replication** — later transfer target: relation between a legal sequential specification and externally observed operation order

## YDB mapping hypotheses

- **HYPOTHESIS:** Некоторые single-operation YDB APIs вокруг tablet-local state можно специфицировать как operations одного abstract object; это нужно проверять по реальным API contracts и failure semantics.
- **HYPOTHESIS:** Transaction-level guarantees YDB следует сопоставлять прежде всего со strict serializability/serializability, а не выводить напрямую из linearizability отдельных internal components.
- **HYPOTHESIS:** Locality theorem полезен только при корректно выбранных object boundaries; actor или tablet boundary сам по себе не доказывает compositional linearizability.
- **HYPOTHESIS:** PlanStep, TxId и commit-related ordering могут участвовать в candidate real-time/serialization relation, но соответствие формальному <_H требует отдельного protocol-level VERIFY.

## Inspected content landmarks

- **journal page 465, Figure 1** — four FIFO queue histories separating acceptable and unacceptable concurrent behavior
- **journal page 466, Figure 2** — register histories showing why object semantics and real-time constraints matter
- **journal page 469, Figure 3** — sequential axioms for Enq and Deq immediately before the formal L1/L2 definition
- **journal page 479, Figure 4** — evolution of possible linearized queue values as invocation and response events occur
- **journal page 481, Figure 5** — queue history beside abstracted representation values and admissible abstract linearized values

## Authoritative sources

- **CONFIRMED — ACM Digital Library DOI record**: https://dl.acm.org/doi/10.1145/78969.78972  
  Supports: canonical title, authors, journal identity, volume and issue, pages, DOI.
- **CONFIRMED — Maurice Herlihy / Brown University hosted PDF**: https://cs.brown.edu/people/mph/HerlihyW90/p463-herlihy.pdf  
  Supports: full final article text, abstract and section structure, figures and proof-method material, publication-time affiliation.
- **CONFIRMED — Jeannette M. Wing official CMU bibliography**: https://www.cs.cmu.edu/~wing/resume.html  
  Supports: journal bibliographic identity, CMU-CS-88-120, POPL '87 preliminary version, CMU-CS-86-154.
- **CONFIRMED — DBLP**: https://dblp.org/rec/journals/toplas/HerlihyW90  
  Supports: authors, journal, volume and issue, pages, year, DBLP key.
- **CONFIRMED — ACM Digital Library POPL '87 record**: https://dl.acm.org/doi/10.1145/41625.41627  
  Supports: preliminary version title, authors, conference DOI.

## Metadata conflicts and unresolved issues

- **title capitalization** — `resolved_nonsemantic`: Publisher/index records vary between sentence case and title case; canonical wording is otherwise identical.
- **version lineage** — `preserved`: The 1987 POPL paper and 1986 technical report are titled Axioms for Concurrent Objects; the expanded journal/technical report line uses the Linearizability title.
- **affiliations** — `resolved_for_selected_version`: The final article lists both authors at Carnegie Mellon University. Later institutional affiliations in secondary metadata are not used as publication-time affiliations.
- **UNRESOLVED:** The CMU-CS-88-120 technical report was identified from the author's official bibliography but its full text was not opened.
- **UNRESOLVED:** Byte-level identity between the ACM publisher PDF and the author-hosted Brown PDF was not checked; bibliographic pagination and visible article identity match.

## Validation

- JSON Schema: **passed** (`draft-2020-12`)
- YAML and JSON semantic equality: **passed**
- Curriculum stage exists: **passed**
- Questions checked to avoid full pre-reading answers: **passed**
- Recommended repository path: `ydmp/papers/herlihy-wing-1990-linearizability/`
- GitHub updated: **no**
- DuckDB updated: **no**
