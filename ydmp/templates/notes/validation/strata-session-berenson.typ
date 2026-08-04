// Strata visual-validation snapshot of a persisted YDMP study session.
//
// Canonical source:
//   ydmp/papers/berenson-1995-ansi-sql-isolation-levels/study/sessions/closed-book-recall-001.md
// Source SHA-256:
//   49d5b258023ade2d5efffa5b73ca2f5fcbe86ce601a00a6ea1c6fff311c3300f
//
// The session record remains append-only and canonical in Markdown. This Typst
// copy exists only to stress-test long verbatim answers and assessment rhythm.

#import "../template.typ" as notes

#let variant = sys.inputs.at("variant", default: "candidate-strata")

#show: notes.paper_notes.with(
  title: "Closed-book recall 001",
  subtitle: "A Critique of ANSI SQL Isolation Levels · persisted session snapshot",
  authors: ("Learner", "YDMP Research Tutor"),
  paper_id: "berenson-1995-ansi-sql-isolation-levels",
  doi: "10.1145/223784.223785",
  stage: "CAPTURE / CLOSED-BOOK RECALL · STRATA VALIDATION",
  variant: variant,
)

#notes.evidence("PROVENANCE", variant: variant)[
  Visual snapshot of the append-only session record; source SHA-256
  `49d5b258023ade2d5efffa5b73ca2f5fcbe86ce601a00a6ea1c6fff311c3300f`. Learner answers remain verbatim in the canonical Markdown.
]

#notes.evidence("BOUNDARY", variant: variant)[
  This fixture tests long quotations, code histories, round-by-round assessment,
  correction records and navigation across a sustained study session.
]

```yaml
paper_id: berenson-1995-ansi-sql-isolation-levels
session_id: closed-book-recall-001
session_type: closed-book-recall
captured_at: 2026-07-28
rounds: 20
core_diagnostic_boundary: approximately rounds 1-12
editorial_policy:
  learner_answers_verbatim: true
  irrelevant_dialogue_removed: true
  assistant_explanations_normalized: true
  historical_record_append_only: true
```

= Purpose and boundary
<purpose-and-boundary>
The learner had read the entire paper once, but described the pass as
slow coverage reading rather than detailed mastery. The purpose of the
session was to find what could be reconstructed without reopening the
paper.

This record preserves technically relevant questions and learner
answers. The answers are reproduced verbatim, including uncertainty,
spelling, and initial misconceptions. Assistant explanations are
normalized into concise correction records; the full corrected treatment
lives in `../model.md`.

The session became overextended. Rounds 13-20 moved from diagnosis of
the focal paper into article-adjacent multiversion serializability
theory. That expansion is preserved because it revealed useful gaps, but
it is explicitly separated from required first-pass mastery.

#line(length: 100%, stroke: 0.4pt)

= Block A. Central critique and ANSI anomaly definitions
<block-a.-central-critique-and-ansi-anomaly-definitions>
= Round 1 — Main thesis of the paper
<round-1-main-thesis-of-the-paper>
== Prompt
<prompt>
Reconstruct the paper’s main criticism of the ANSI SQL isolation-level
definitions and the changes proposed by the authors.

== Learner answer — verbatim
<learner-answer-verbatim>
#quote(block: true)[
Авторы заметили что определения из ANSI SQL можно читать в двух
вариациях - то есть определение, выраженное на английском языке
недостаточно точное. Их нужно выражать более строго на языке математики.
Также они отметили аномалии, которые не покрываются аномалиями,
введёнными стандартом. И описали некоторые поведения, которые должны
закрываться определениями аномалий, но не закрываются полностью. И
рассмотрели другие виды изоляций \(Snapshot Isolation), которые не
описываются текущими уровнями изоляции стандарта.

Они предлагают изменить некоторые формулировки аномалий и названий,
ввести ещё две аномалии \(Write Sckew и что-то ещё) в общую таблицу,
которая закрывает уже все уровни изоляции, включая Snapshot Isolation.
Ослабить понимание определений аномалий \(то есть использовать не
строгий вариант A, а вариант P формулировок). Также они показали что при
интерпретации A - появляются несериализуемые истории - которые
аномалиями пропускаются, но в более широкой интерпретации они не могут
появиться.
]

== Assessment
<assessment>
`understood`

Correctly recalled:

- ambiguity of English ANSI definitions;
- strict `A` versus broad `P` readings;
- incompleteness of the anomaly list;
- addition of Snapshot Isolation and Write Skew;
- strict interpretations can admit nonserializable histories.

Missing or imprecise:

- the second named skew anomaly was `A5A Read Skew`;
- `P0 Dirty Write`, `P4 Lost Update`, and Cursor Stability were also
  central extensions;
- the broad reading is not merely "weaker wording"; it prohibits a
  broader set of interleavings.

Canonical model: `../model.md`, sections 1-4.

#line(length: 100%, stroke: 0.4pt)

= Round 2 — A1 versus P1 Dirty Read
<round-2-a1-versus-p1-dirty-read>
== Prompt
<prompt-1>
Why is strict `A1` too narrow, and what does broad `P1` prohibit?

== Learner answer — verbatim
<learner-answer-verbatim-1>
#quote(block: true)[
Аномалия A1 требует чтобы транзакция T2 \(которая записала данные, а T1
их прочитала и получила dirty read - то есть увидела) была ABORT. Однако
dirty read будет и если T2 сделает COMMIT. И в принципе dirty read будет
вне зависимости от ABORT/COMMIT обоих транзакций T1 и T2.
]

== Assessment
<assessment-1>
`understood`

Correctly recalled:

- the abort requirement makes `A1` outcome-dependent;
- exposure to an uncommitted value exists before commit/abort is known;
- the problem is not removed by the writer later committing.

Terminology correction:

- the exact transaction indices in the statement should be tied to the
  particular formal history, but the conceptual argument is correct.

Canonical model: section 2.

#line(length: 100%, stroke: 0.4pt)

= Round 3 — A2 versus P2
<round-3-a2-versus-p2>
== Prompt
<prompt-2>
Distinguish strict `A2 Non-repeatable Read` from broad `P2 Fuzzy Read`.

== Learner answer — verbatim
<learner-answer-verbatim-2>
#quote(block: true)[
A2 - это частный случай P2 — Fuzzy Read, когда мы в одной транзакции
перечитываем "объект" и получаем разные результаты. То есть
неповторяемое чтение в одной транзакции одного объекта \(например
строки). Я не помню про "P2 — Fuzzy Read" но сейчас попробую ответить. В
A2 нужно читать "один и тот же объект", а P2 - Fuzzy Read это по-сути
"несогласованное чтение" - read skew, например когда мы прочитали два
разных объекта "в разное время", в разном, несогласованном состоянии.

H1: w1\[x\=50\] r2\[x\] w2\[y\=20\] r1\[y\] … \(если какая-нибудь
транзакция ABORT, а вторая COMMIT) получим этот Fuzzy Read.
]

== Assessment
<assessment-2>
`misconception_corrected`

Correctly recalled:

- `A2` requires a repeated read of the same data item;
- the broad phenomenon is intended to cover more histories than the
  observed second-read anomaly.

Misconception:

- `P2` was equated with cross-object `Read Skew`. The broader `P2`
  pattern is the read of an item followed by another transaction’s write
  to that item before the reader finishes; no second read is required.

Editorial note:

- the proposed history mixes elements of the paper’s skew examples but
  does not state `P2` precisely.

Canonical model: section 3.

#line(length: 100%, stroke: 0.4pt)

= Round 4 — H2 serialization contradiction and anti-dependency
<round-4-h2-serialization-contradiction-and-anti-dependency>
== Prompt
<prompt-3>
Given a reader that sees old `x` and new `y`, derive both required
serial orders and explain the role of the `rw` anti-dependency.

== Learner answer — verbatim
<learner-answer-verbatim-3>
#quote(block: true)[
T1 видит значения y\=90, хотя начальное состояние y\=50 и T1 не меняла
значение y. Значит, его поменяла другая транзакция. Чтобы восстановить
корректность транзакции T1 - она должна прочитать значение y до того,
как его изменила транзакция T2. То есть T1 должна идти перед T2.

А вот как продолжить мои выводы - я не смог, чтобы придти к
противоречию. При чём тут anti-dependency? На что оно влияет? Как
появляется "T1 должна идти после T2"? Я этого не вижу.
]

== Assessment
<assessment-3>
`partial`

Correctly recalled:

- one observed value imposes a serialization constraint;
- the learner recognized that a read/write relation must be translated
  into a whole-transaction order.

Gap:

- the direction associated with old versus new values was not
  consistently derived;
- the second constraint and resulting cycle were not found without help.

Normalized explanation:

- reading a value written by `T2` requires `T2 -> T1` \(`wr`
  dependency);
- reading an older version of an item later changed by `T2` requires
  `T1 -> T2` \(`rw` anti-dependency);
- both constraints together form a cycle.

Canonical model: sections 3 and 10; detailed H2 reconstruction remains a
next action.

#line(length: 100%, stroke: 0.4pt)

= Round 5 — A3, P3, and an attempted H3
<round-5-a3-p3-and-an-attempted-h3>
== Prompt
<prompt-4>
How does strict `A3 Phantom` differ from broad `P3`, and can a predicate
anomaly exist without a repeated predicate read?

== Learner answer — verbatim
<learner-answer-verbatim-4>
#quote(block: true)[
аномалия A3 — Phantom - это когда добавляется новая строка другой
транзакцией, строка подпадает под условие . Однако ничего не говорится
про UPDATE и DELETE. P3 вместо этого использует более широкую операцию
WRITE.

Пример: P — множество объектов, например активные сотрудники z —
отдельное значение, например сохранённое количество сотрудников

T1 по условию \= "активные сотрудники" получает строки - всех активных
сотрудников и подсчитывает их количество Начальное состояние: z \= 9,
инвариант z \<\= 10 H3: r1\[z\] r2\[z\] insert2\[новый сотрудник\]
insert1\[новый сотрудник\]
]

== Assessment
<assessment-4>
`partial`

Correctly recalled:

- the ANSI wording is too focused on inserted rows;
- broad predicate writes should cover `INSERT`, `UPDATE`, and `DELETE`
  effects.

Missing:

- strict `A3` requires the same transaction to read the predicate twice;
- broad `P3` requires only the predicate read followed by a conflicting
  write before the reader completes.

Misclassification:

- the proposed history is predicate-style Write Skew: two transactions
  check an invariant and insert different rows. It is useful, but it is
  not the paper’s H3 mixed predicate/counter history as requested.

Canonical model: section 4.

#line(length: 100%, stroke: 0.4pt)

= Block B. Dirty Write, Lost Update, and Cursor Stability
<block-b.-dirty-write-lost-update-and-cursor-stability>
= Round 6 — Why prohibit P0 Dirty Write?
<round-6-why-prohibit-p0-dirty-write>
== Prompt
<prompt-5>
Name two independent reasons to prohibit Dirty Write: one about
invariants and one about rollback/recovery.

== Learner answer — verbatim
<learner-answer-verbatim-5>
#quote(block: true)[
Потому что порявлчется Lost Update. Что усложняет recovery. Но вот
детали не помню.
]

== Assessment
<assessment-5>
`not_recalled`

Correctly recalled:

- recovery becomes problematic.

Misconception:

- Dirty Write and Lost Update are distinct phenomena; Lost Update can
  occur after the overwritten writer has committed.

Normalized explanation:

- dirty overwrites can compose a final state from incompatible
  transaction fragments and violate an invariant;
- before-image undo becomes ambiguous: undoing one transaction can erase
  a later transaction or restore data from an aborted transaction.

Canonical model: section 5.

#line(length: 100%, stroke: 0.4pt)

= Round 7 — P4 Lost Update versus P0 and Read Committed
<round-7-p4-lost-update-versus-p0-and-read-committed>
== Prompt
<prompt-6>
Distinguish `P4 Lost Update` from `P0 Dirty Write`, and explain why
locking Read Committed can prohibit P0 while allowing P4.

== Learner answer — verbatim
<learner-answer-verbatim-6>
#quote(block: true)[
P4 - это когда теряется запись другой транзакции. То есть T1 читает
r1\[x\], потом T2 перезаписывает его, а T1 тоже его перезаписывает, но
основываясь на своём старом значении, которая прочитала. Таким образом,
например если две транзакции добавляют 10, одно добавление теряется. P0
- это когда транзакция T2 записывает значение после записи первой
транзакции, до коммита первой транзакции: w1\[x\=20\] w2\[x\=30\] c1 То
есть "чтения" не нужно. Про READ COMMITTED не помню.
]

== Assessment
<assessment-6>
`partial`

Correctly recalled:

- P4 requires a stale prior read;
- P0 does not require a read;
- P0 overwrites an unfinished writer;
- the incremental-update example captures Lost Update.

Not recalled:

- long-duration write locks prevent P0;
- short-duration read locks under locking Read Committed allow another
  transaction to change and commit before the stale writer returns.

Canonical model: sections 5-6.

#line(length: 100%, stroke: 0.4pt)

= Round 8 — Cursor Stability
<round-8-cursor-stability>
== Prompt
<prompt-7>
What is Cursor Stability, what lock does it retain, what Lost Update
does it prevent, and why is it weaker than locking Repeatable Read?

== Learner answer — verbatim
<learner-answer-verbatim-7>
#quote(block: true)[
Cursor Stability - как я понимаю это когда множество объектов, по
которым итерируется Cursor не меняется во время итерирования. То есть
оно должно фиксироваться во время создания курсора. Там вводится rc -
read cursor и wr - write cursor. Она удерживает "блокировку курсора" -
но это значит? Что вообщше такое cursor - какое его определение в теории
и как и реализуется в PostgreSQL? "какую разновидность Lost Update
предотвращает и почему всё ещё остаётся слабее locking REPEATABLE READ"
- не знаю
]

== Assessment
<assessment-7>
`misconception_corrected`

Misconception:

- Cursor Stability does not freeze the cursor’s entire result set.

Normalized explanation:

- it retains a read lock on the current cursor row until movement,
  closure, or positioned update;
- it prevents cursor-specific Lost Update `P4C`;
- previously visited rows, ordinary reads, and predicates are not
  protected to transaction end, so it remains weaker than locking
  Repeatable Read.

External mapping:

- the PostgreSQL `Portal`, `WHERE CURRENT OF`, and `FOR UPDATE`
  discussion is retained as `POSTGRESQL / EXTERNAL`, not as a
  focal-paper claim.

Canonical model: section 7; verification boundary in
`../verification.md`.

#line(length: 100%, stroke: 0.4pt)

= Block C. Snapshot Isolation
<block-c.-snapshot-isolation>
= Round 9 — The two rules of Snapshot Isolation
<round-9-the-two-rules-of-snapshot-isolation>
== Prompt
<prompt-8>
State the visibility rule and the commit rule of Snapshot Isolation.

== Learner answer — verbatim
<learner-answer-verbatim-8>
#quote(block: true)[
Правило 1: для транзакции вводится StartTransaction. Видна последняя
версия объекта \(строки) последней закомиченной транзакции. Все
транзакции \(и их версии) старше StsartTransaction не видны \(потому они
не могли быть закоммичены из будущего). То есть то есть "версии,
досткпнве чтению" это CommitTransaction видимых версий \<\=
StartTransaction транзакции Правило 2: First-Commit-Wins - но я не
помню. Попробую предположить - "старая транзакция не может читать
значения более новой транзакции" и "старая транзакция не может
перезаписывать значения из будущего". Если T1 сделала COMMIT, и для T2:
ST2 \(StartTransaction транзакции T2) находится в промежутке ST1 \< ST2
\< C1. То T2 не может делать коммит. Как-то так, но точно все детали не
помню. Могу ошибаться.
]

== Assessment
<assessment-8>
`partial`

Correctly recalled:

- a transaction reads from a start-time snapshot;
- visible versions must have committed before the snapshot boundary;
- uncommitted future results are invisible.

Corrections:

- "older" and "newer" transaction start times alone do not decide
  visibility; a transaction may start earlier and commit after the
  snapshot, remaining invisible;
- First-Committer-Wins is a commit rule about overlapping logical write
  sets, not a general prohibition based only on `ST1 < ST2 < C1`.

Canonical model: section 8.

#line(length: 100%, stroke: 0.4pt)

= Round 10 — Lost Update and Write Skew under FCW
<round-10-lost-update-and-write-skew-under-fcw>
== Prompt
<prompt-9>
Why does First-Committer-Wins prevent Lost Update but not Write Skew?
Give one history for each.

== Learner answer — verbatim
<learner-answer-verbatim-9>
#quote(block: true)[
Write Skew: x\=100 y\=100

T1: s1\=10 T2: s2\=20

T1 writes x\=110 T2 writes y\=120

T1: c1\=30 T2: c2\=40 То есть write sets не пересекаются

Lost Update: x\=100

T1: s1\=10 T2: s2\=20

T1 reads x\=100 T2 reads x\=100 T2 writes x\=120 \(+20) T1 writes x\=110
\(+10) T1: c1\=30 T2: c2\=40

Получаем LOST UPDATE. Однако он не возможен, потому что в Lost Update
транзакция "перезаписывает" - в нашем примере это T1 writes x\=110
\(+10) - то есть writing sets пересекаются. First-Commiter-Wins решает
эту проблему. В нашем случае T2 должна ABORT.
]

== Assessment
<assessment-9>
`partial`

Correctly recalled:

- Lost Update has overlapping write sets and is rejected;
- disjoint write sets pass First-Committer-Wins.

Missing from the Write Skew example:

- shared reads or a common invariant;
- two locally valid decisions whose combined writes violate that
  invariant.

Normalized canonical example:

```text
x = 1, y = 1, invariant x + y >= 1
T1 reads x,y and writes x=0
T2 reads x,y and writes y=0
```

Canonical model: section 9.

#line(length: 100%, stroke: 0.4pt)

= Round 11 — Incomparability of locking RR and SI
<round-11-incomparability-of-locking-rr-and-si>
== Prompt
<prompt-10>
Produce one history allowed by locking Repeatable Read but prohibited by
SI, and another allowed by SI but prohibited by locking Repeatable Read.

== Learner answer — verbatim
<learner-answer-verbatim-10>
#quote(block: true)[
Не знаю, не помню
]

== Assessment
<assessment-10>
`not_recalled`

Normalized explanation:

- locking RR without predicate locks can allow a phantom; SI’s fixed
  snapshot does not reveal it;
- SI can allow Write Skew; long read locks in locking RR cause blocking
  or a deadlock/abort.

Canonical model: section 11.

#line(length: 100%, stroke: 0.4pt)

= Round 12 — A5A Read Skew versus A5B Write Skew
<round-12-a5a-read-skew-versus-a5b-write-skew>
== Prompt
<prompt-11>
For `A5A` and `A5B`, identify reads, writes, and whether the
inconsistency is in observation or in the final database state.

== Learner answer — verbatim
<learner-answer-verbatim-11>
#quote(block: true)[
A5A — Read Skew - читает состояние, которое невозможно получить при
serializable transactions или serial transactions order. Это как минимум
два объекта. A5B — Write Skew - записывает такое состояние. Для A5A —
Read Skew - в наблюдении и в состоянии базы тоже \(так как Т1 должна
прочитать часть данных записанных T2). Для A5B — Write Skew только в
состоянии базы данных. Обе A5A и A5B нарушают инвариант базы данных.
]

== Assessment
<assessment-11>
`misconception_corrected`

Correctly recalled:

- A5A is an impossible multi-object observation;
- A5B commits a skewed combined state.

Correction:

- canonical A5A need not corrupt the committed database. Every real
  committed state may satisfy the invariant while the reader combines
  parts of two states;
- A5B can violate the invariant in the final committed state;
- the patterns are dangerous when an application invariant actually
  connects the objects.

Canonical model: section 10.

#line(length: 100%, stroke: 0.4pt)

= Block D. Article-adjacent multiversion serializability
<block-d.-article-adjacent-multiversion-serializability>
The following rounds exposed useful prerequisite gaps, but they exceed
the bounded first-pass recall for this paper.

= Round 13 — Meaning of r\_i\[x\_j\]
<round-13-meaning-of-r_ix_j>
== Prompt
<prompt-12>
What does `r_i[x_j]` mean, and what additional structures are needed to
analyze a multiversion history?

== Learner answer — verbatim
<learner-answer-verbatim-12>
#quote(block: true)[
Запись r\_i\[x\_j\] в multiversion history означает "Транзакция T\_i
прочитала версию x\_j объекта x, которую записала транзакция T\_j" Она
отличается тем, что вместо одного объекта x, у нас появляется несколько
версий объекта x: x\_1, x\_2, x\_3, …

Чтобы анализировать serializability multiversion history, нам нужен
multiversion serializability graph. Где появляются связи T\_j — wr —
T\_i \(запись r\_i\[x\_j\]) и T\_j — rw — T\_i \(запись w\_i\[x\_j\])
для каждой версии.
]

== Assessment
<assessment-12>
`partial`

Correctly recalled:

- exact semantics of `r_i[x_j]`;
- need for a multiversion graph;
- writer-to-reader dependency.

Corrections:

- a writer `T_i` normally creates `x_i`, not `x_j`;
- before graph construction, the analysis needs a reads-from relation
  and a per-object version order;
- `rw` direction is from a reader of an older version to a writer of a
  later version.

Canonical model: section 13.

#line(length: 100%, stroke: 0.4pt)

= Round 14 — One-copy serializability
<round-14-one-copy-serializability>
== Prompt
<prompt-13>
What does one-copy serializability mean?

== Learner answer — verbatim
<learner-answer-verbatim-13>
#quote(block: true)[
one-copy serializability означает что мы можем "привести" или "найти"
такой 1VSR \(1 version serialization graph) из MVSR. То есть MVSR будет
эквивалентен \(идентичен? как правильно и аккуратно назвать) обычному
графу без многоверсионности, как будто существует только одна версия
объекта x, а не несколько x\_1, x\_2, x\_3
]

== Assessment
<assessment-13>
`understood_with_terminology_refinement`

Correctly recalled:

- physical versions must be observationally explainable as one logical
  copy;
- an equivalent serial single-version execution must exist.

Terminology refinement:

- histories are one-copy equivalent, not identical;
- the target is a serial single-copy history, not merely a graph;
- reads-from and final logical state must be preserved.

Canonical model: section 14.

#line(length: 100%, stroke: 0.4pt)

= Round 15 — Why writer-before-reader is insufficient
<round-15-why-writer-before-reader-is-insufficient>
== Prompt
<prompt-14>
Why is `T_j -> T_i` insufficient for `r_i[x_j]`, and what prevents
another writer of `x` from being placed between them?

== Learner answer — verbatim
<learner-answer-verbatim-14>
#quote(block: true)[
Если r\_i\[x\_j\] то получаем T\_j —- wr —- T\_i. Если поместить пишущию
транзакцию T\_k между T\_j и T\_i в serial order - то получим
противоречие. Т.к. T\_k запишет версию после T\_j - то она и будет
последней для логического значения x, то есть T\_i прочитает значение
x\_k
]

== Assessment
<assessment-14>
`understood`

Correctly recalled:

- single-copy serial reads observe the most recent preceding writer;
- an intervening writer would change the source of the read;
- additional version-order constraints are required.

Canonical model: sections 13-15.

#line(length: 100%, stroke: 0.4pt)

= Round 16 — MVSG for Write Skew and version-order alternatives
<round-16-mvsg-for-write-skew-and-version-order-alternatives>
== Prompt
<prompt-15>
For canonical Write Skew, explain First-Committer-Wins, derive the two
`rw` edges, and determine how chosen version orders affect graph
construction.

== Learner answer — verbatim
<learner-answer-verbatim-15>
#quote(block: true)[
+ Потому что их множества write sets не пересекаются: T1 записывает
  x\_1, а T2 записывает y\_2 - это два разных логических объекта.
+ Это T\_2 — rw —- T\_1 и T\_1 —- rw —- T\_2, но направление стрелок
  может быть разным - оно зависит от выбранного порядка для x\_0, x\_1 и
  y\_0, y\_2
+ Если x\_0 \< x\_1, тогда T\_2 —\> T\_1 \(Т\_2 прочитала более раннюю
  версию, чем записала T\_1). Но для y\_0 \< y\_2, тогда T\_1 —\> T\_2.
  Получаем цикл.

Однако у меня вопрос по 2 и 3 пункту. Как мы можем нарисовать кто от
кого зависит \(то есть стрелочку в графе MVSG)? Ты раньше говорил что
для каждого логического объекта x и y свой порядок. Мы его фиксируем
произвольно? То есть просто "какой-то фиксируем" и потом строим граф
MVSG и так для всех возможных порядков всех объектов? Просто если x\_0
\< x\_1 то T\_2 — rw —- T\_1, однако если x\_1 \< x\_0 получаем что
сначала записали w1\[x1\], а потом прочитали r2\[x0\] - \(мы же можем
так сделать?) и в таком случае никакой зависимости между T\_2 и T\_1 для
объекта x не будет - я правильно понимаю? Тоже самое для y: если y\_0 \<
y\_2 то T1 —\> T2. Однако, если y\_2 \< y\_0 то опять получается нет
никакой зависимости между T1 и T2? И нет никакого цикла тогда
получается? Или эти "version order" как-то где-то отмечаются на самом
графе? И как они отмечаются, если они влияют на то, будет между
транзакциями зависимость или нет?
]

== Assessment
<assessment-15>
`partial`

Correctly recalled:

- disjoint logical write sets allow both commits;
- natural initial-before-new version orders yield crossing `rw` edges
  and a cycle;
- version order is per logical object and affects edge direction.

Key correction:

- reversing the order does not make the constraint disappear. It selects
  the alternative edge from the other-version writer to the read-version
  writer;
- initial versions are normally constrained to precede later versions;
- the version order is a parameter of `MVSG(H, <<)` and can be written
  beside the graph or included in edge annotations.

Canonical model: section 15.

#line(length: 100%, stroke: 0.4pt)

= Round 17 — Why exactly two rw anti-dependencies?
<round-17-why-exactly-two-rw-anti-dependencies>
== Prompt
<prompt-16>
Why does canonical Write Skew have a cycle of two `rw` anti-dependencies
rather than `wr` or `ww` edges between the transactions?

== Learner answer — verbatim
<learner-answer-verbatim-16>
#quote(block: true)[
Потому что x\_init фиксируется как первая в version order - поэтому
другие варианты - обратные варианты x₁ ≪ x₀ и y₂ ≪ y₀ даже не
рассматриваются как допустимые. В предположении: x₀ ≪ x₁ y₀ ≪ y₂
получаются две rw анти-зависимости
]

== Assessment
<assessment-16>
`partial`

Correctly recalled:

- initial versions precede later versions;
- the two `rw` directions follow from those orders.

Missing structural explanation:

- no mutual `wr` edge exists because neither transaction reads the
  other’s new version;
- no mutual `ww` edge exists because the transactions write different
  logical objects;
- each transaction reads a version later replaced by the other,
  producing the two anti-dependencies.

Canonical model: section 9.

#line(length: 100%, stroke: 0.4pt)

= Round 18 — Reconstructing the SI table row
<round-18-reconstructing-the-si-table-row>
== Prompt
<prompt-17>
For Snapshot Isolation, classify `P0`, `P1`, `P2`, `P3`, `P4`, `A5A`,
and `A5B`, and tie each result to an SI rule.

== Learner answer — verbatim
<learner-answer-verbatim-17>
#quote(block: true)[
P0 - Dirty Write - не допускает, потому что пишущая транзакция создаёт
свою версию логического объекта. Dirty Read - не допускает, потому что
видит только закоммиченные состояния \(другими транзакциями) логического
объекта Lost Update - не допускает, потому что не "перезаписывает
значение" объекта, а создаёт свою версию Non-repeatable Read - не
допускает, видит snapshot во время жизни транзакции Write Skew -
допускает, мы это посмотрели на примере выше Read Skew - наверное
допускает, но уже забыл почему Phantom - не помню, не знаю
]

== Assessment
<assessment-17>
`partial_with_mechanism_corrections`

Correctly recalled:

- Dirty Read is prevented by committed-snapshot visibility;
- repeated reads are stable;
- Write Skew remains possible.

Corrections:

- separate physical versions do not by themselves prevent P0 or P4;
  First-Committer-Wins over the same logical object does;
- `A5A Read Skew` is prevented by one fixed snapshot;
- strict `A3` is prevented, but some broad `P3` predicate histories
  remain possible;
- multiversion interpretation of `P2` requires a formal caveat: stable
  snapshot reads do not imply absence of `rw` anti-dependencies.

Canonical model: section 12.

#line(length: 100%, stroke: 0.4pt)

= Round 19 — Why A3 is prevented but P3 can remain
<round-19-why-a3-is-prevented-but-p3-can-remain>
== Prompt
<prompt-18>
Explain why SI can prevent strict `A3` while allowing broad `P3`, and
construct a predicate Write Skew history.

== Learner answer — verbatim
<learner-answer-verbatim-18>
#quote(block: true)[
Для Snapshot Isolation для A3 будут пересечения по write sets - поэтому
для одной транзакции будет ABORT. P3 - это форма Write Skew, где
записываются разные объекты, поэтому пересечения по write set нет.
Однако инвариант базы данных может нарушиться. Invariant: x + y \< 5 x
\= 1, y \= 1

H: r1\[x0\=1\] r1\[y0\=1\] r2\[x0\=1\] r2\[y0\=1\] \(invariant checked)
w1\[y1\=3\] w2\[x1\=3\] c1 c2 Пересечения по writing set нет - но
инвариант x + y \< 5 будет нарушен
]

== Assessment
<assessment-18>
`misconception_corrected`

Correctly recalled:

- disjoint writes allow invariant-violating Write Skew;
- the numeric example is a valid point-object `A5B` pattern.

Corrections:

- strict `A3` can involve a read-only `T1`; no write-set intersection is
  needed;
- it is prevented by the fixed snapshot, not First-Committer-Wins;
- the supplied `r[x], r[y]` example is point-object Write Skew, not yet
  predicate `P3`;
- predicate `P3` needs `r[P]` and concrete writes affecting the
  predicate.

Canonical model: sections 4 and 12.

#line(length: 100%, stroke: 0.4pt)

= Round 20 — Predicate reads, writes, and MVSG
<round-20-predicate-reads-writes-and-mvsg>
== Prompt
<prompt-19>
Construct `wr`, `rw`, and `ww` dependencies for predicate reads and
writes, and explain version order when the predicate ranges over unknown
or absent objects.

== Learner answer — verbatim
<learner-answer-verbatim-19>
#quote(block: true)[
Мне непонятно как нарисовать MVSG и как рисовать, составлять,
анализировать wr-, rw-, ww- dependencies для predicate reads and writes.
И непонятно как составлять version order для логических объектов, если
мы даже не знает какие конкретно объекты есть в P
]

== Assessment
<assessment-19>
`deferred`

The answer correctly identifies a prerequisite gap rather than
attempting to fake a construction.

Normalized explanation retained from the session:

- a predicate is a query over possible objects, not itself automatically
  a materialized versioned data item;
- a concrete write that changes the query result can be treated as a
  witness for a predicate dependency;
- two inserts of different rows usually have no row-level `ww` conflict
  even if both affect the same predicate;
- negative or absence observations are useful explanatory devices.

Verification boundary:

- a complete predicate-aware MVSG construction, absent-version
  formalism, and witness expansion were not established from the focal
  paper;
- this topic is recorded as `ARTICLE-ADJACENT / DEFERRED` and must be
  studied from a dedicated primary source.

Canonical model: section 16; verification ledger: `../verification.md`.

#line(length: 100%, stroke: 0.4pt)

= Diagnostic summary
<diagnostic-summary>
= Strongly reconstructed without notes
<strongly-reconstructed-without-notes>
- the central critique of ANSI definitions;
- the abort-specific defect in `A1`;
- Dirty Write versus Lost Update;
- overlapping write sets as the reason First-Committer-Wins prevents
  Lost Update;
- disjoint writes and crossing `rw` dependencies in Write Skew;
- semantics of `r_i[x_j]`;
- intuition of one-copy serializability;
- last-writer requirement for a read in a serial single-copy execution.

= Required reconstruction or correction
<required-reconstruction-or-correction>
- `A2` versus broad `P2`;
- the complete serialization contradiction in H2;
- repeated predicate read in `A3` versus broad `P3`;
- the two Dirty Write arguments;
- Cursor Stability current-row semantics;
- formal First-Committer-Wins condition;
- locking RR versus SI incomparability;
- A5A as inconsistent observation without necessary database corruption;
- complete SI summary-table row;
- alternative version-order edge construction.

= Deferred beyond the paper’s first-pass goal
<deferred-beyond-the-papers-first-pass-goal>
- general MVSG theorem and recognition procedure;
- predicate-aware multiversion graph construction;
- absent/tombstone versions as formal objects;
- PostgreSQL implementation details for cursors and SSI.

= Process finding
<process-finding>
The session contained twenty rounds. Diagnostic sufficiency was reached
around rounds 10-12. Later questioning mixed CLOSED-BOOK RECALL, MODEL
construction, and external theory. The YDMP protocol now inserts CAPTURE
after a bounded recall pass and limits the default first pass to eight
core questions.

= Next checkpoint
<next-checkpoint>
Do not replay all twenty rounds. The next focused work is:

+ independently reconstruct `H1-H5`;
+ reproduce Figure 2 and Table 4;
+ run the compact core cards in `../recall-cards.yaml`;
+ study MVSG as a separate primary-source module.
