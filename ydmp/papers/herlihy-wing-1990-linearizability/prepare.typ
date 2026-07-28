#set page(paper: "a4", margin: 20mm)
#set text(size: 10.2pt)
#set heading(numbering: "1.")
#align(center)[
  #text(size: 18pt, weight: "bold")[YDMP PREPARE]
  #linebreak()
  #text(size: 13pt)[Linearizability: A Correctness Condition for Concurrent Objects]
]

#grid(
  columns: (1fr, 2.2fr),
  gutter: 8pt,
  [*Paper ID*], [herlihy-wing-1990-linearizability],
  [*Authors*], [Maurice P. Herlihy, Jeannette M. Wing],
  [*Publication*], [ACM Transactions on Programming Languages and Systems 12(3), 463-492 (1990-07)],
  [*DOI*], [10.1145/78969.78972],
  [*Selected version*], [Final ACM TOPLAS journal version],
  [*Curriculum*], [isolation-theory],
)

= Why this material now
Статья вводит точную operation-level модель real-time correctness. После разбора transaction isolation она позволяет не смешивать linearizability отдельных операций с serializability транзакций и подготавливает основу для анализа границ объектов, compositionality и порядка событий в YDB.

= Expected problem
CONFIRMED: Как задать семантику concurrent object так, чтобы разрешать перекрывающиеся операции, но рассуждать о них через привычную sequential specification и при этом не нарушать наблюдаемый real-time order?

= Expected contribution
CONFIRMED: Формальное correctness condition, два ключевых structural properties — locality и nonblocking — и proof method, который переносит representation invariant и abstraction function в concurrent domain.

= Reading scope
- pp. 463-470: abstract, motivation, histories, equivalence, well-formedness, L1/L2 definition
- pp. 470-474: locality, nonblocking, sequential consistency and serializability comparison
- pp. 485-486: Section 6.2 Final Remarks and safety/liveness boundary

== Visual checkpoints
- Figure 1: identify which real-time constraints make H1-H4 acceptable or not
- Figure 2: explain the one-event difference between H5 and H6
- Figure 3: connect sequential queue axioms to legal histories
- Figure 4: track why the set of possible linearized values expands and contracts
- Figure 5: distinguish representation-level and abstract-level possibilities

= Potential terminology barriers
- *process subhistory H|P and object subhistory H|x* [paper\_defined]: Зафиксировать, что equivalence определяется по process projections.
- *pending invocation and complete(H)* [paper\_defined]: Проследить, какие pending calls получают response в H' и какие отбрасываются.
- *real-time precedence relation <\_H* [paper\_defined]: Для каждой пары операций решить, сравнимы ли они по <\_H.
- *local correctness property* [prerequisite]: Связать theorem statement с независимой проверкой H|x.
- *total versus partial operation specification* [paper\_defined]: Отмечать precondition каждой sequential operation.
- *set-valued, continually-defined abstraction function* [potentially\_unknown]: Сначала понять Figure 4, затем возвращаться к формулам Section 4.3.
- *linearized value and Lin(H)* [paper\_defined]: Отслеживать множество допустимых abstract states, а не одно состояние.
- *Larch and prophecy variables* [deferrable]: Не углубляться на READ-1; отметить для отдельного MODEL-блока.

= Questions to hold while reading
1. *problem:* Какие два интуитивных требования к concurrent operations авторы пытаются выразить одним correctness condition?
2. *model:* Почему history состоит из отдельных invocation и response events, а не из уже атомарных операций?
3. *definition:* Зачем определение разрешает сначала расширить H до H', а затем применяет complete(H')?
4. *invariants:* Какие ограничения сохраняет equivalence по process subhistories, а какие добавляет real-time precedence?
5. *mechanism:* Как Figures 1-3 переводят семантику FIFO queue из sequential axioms в критерий приемлемости concurrent histories?
6. *properties:* Почему locality меняет архитектуру proof obligations и scheduling по сравнению с nonlocal correctness conditions?
7. *failure\_semantics:* В каких случаях blocking следует из partial sequential specification, а в каких является свойством конкретной реализации?
8. *verification:* Почему single-valued abstraction function оказывается недостаточной для highly concurrent queue?
9. *comparison:* На каком уровне granularity и real-time guarantees различаются linearizability, sequential consistency, serializability и strict serializability?
10. *ydb\_mapping:* Какие YDB interfaces разумно моделировать как отдельные linearizable objects, а где требуется transaction-level model?

= YDB mapping hypotheses
- *HYPOTHESIS:* Некоторые single-operation YDB APIs вокруг tablet-local state можно специфицировать как operations одного abstract object; это нужно проверять по реальным API contracts и failure semantics.
- *HYPOTHESIS:* Transaction-level guarantees YDB следует сопоставлять прежде всего со strict serializability/serializability, а не выводить напрямую из linearizability отдельных internal components.
- *HYPOTHESIS:* Locality theorem полезен только при корректно выбранных object boundaries; actor или tablet boundary сам по себе не доказывает compositional linearizability.
- *HYPOTHESIS:* PlanStep, TxId и commit-related ordering могут участвовать в candidate real-time/serialization relation, но соответствие формальному <\_H требует отдельного protocol-level VERIFY.

= Closed-book notes after reading
#box(width: 100%, height: 75mm, inset: 8pt, stroke: 0.7pt)[Write from memory. Do not reopen the source yet.]

= Verification notes
#box(width: 100%, height: 45mm, inset: 8pt, stroke: 0.7pt)[Record errors, missing assumptions, and corrected mental model.]

= Sources and unresolved issues
- ACM Digital Library DOI record: https://dl.acm.org/doi/10.1145/78969.78972
- Maurice Herlihy / Brown University hosted PDF: https://cs.brown.edu/people/mph/HerlihyW90/p463-herlihy.pdf
- Jeannette M. Wing official CMU bibliography: https://www.cs.cmu.edu/~wing/resume.html
- DBLP: https://dblp.org/rec/journals/toplas/HerlihyW90
- ACM Digital Library POPL '87 record: https://dl.acm.org/doi/10.1145/41625.41627
- UNRESOLVED: The CMU-CS-88-120 technical report was identified from the author's official bibliography but its full text was not opened.
- UNRESOLVED: Byte-level identity between the ACM publisher PDF and the author-hosted Brown PDF was not checked; bibliographic pagination and visible article identity match.

Recommended repository path: `ydmp/papers/herlihy-wing-1990-linearizability/`
