// Long-form Strata validation fixture.
//
// Content is derived from the identical ten-page Herlihy-Wing specimen used in
// the Pinega shortlist content test. This file intentionally exercises the
// repository's shared switchable renderer rather than a standalone brand theme.

#import "../template.typ" as notes

#let variant = sys.inputs.at("variant", default: "candidate-strata")
#let base = notes.resolve_theme(variant: variant)
#let t = (
  deep: base.accent,
  accent: base.at("accent_secondary", default: base.accent),
  signal: base.at("accent_tertiary", default: base.accent),
  ice: base.metadata_fill,
  paper: base.at("page_fill", default: base.panel_fill),
  ink: base.text_fill,
  muted: base.muted,
  ui-font: base.heading_font,
  heading-font: base.heading_font,
  mono-font: base.at("mono_font", default: base.heading_font),
  radius: base.panel_radius,
)

#let motif() = stack(
  dir: ttb,
  spacing: 1.6pt,
  rect(width: 100%, height: 4pt, fill: t.deep),
  rect(width: 100%, height: 3pt, fill: t.accent),
  rect(width: 100%, height: 3pt, fill: t.signal),
  rect(width: 100%, height: 2pt, fill: t.ice),
)

#let evidence = notes.evidence.with(variant: variant)

#let thought(body, kind: "Мои мысли", mark: "◆") = {
  let mapped = if kind == "Главная мысль" {
    "main-idea"
  } else if kind == "Связь с определением" or kind == "Связь с реализацией" {
    "formal-link"
  } else if kind == "Свой пример" {
    "example"
  } else if kind == "Неясность" {
    "uncertainty"
  } else {
    "default"
  }
  notes.my_thought(
    body,
    kind: mapped,
    title: kind,
    variant: variant,
  )
}

#let section-kicker(body) = notes.research_kicker(body, variant: variant)

#let state(name, description, fill: t.ice) = box(
  width: 100%,
  inset: 7pt,
  radius: t.radius,
  fill: fill,
  stroke: (paint: t.muted.lighten(42%), thickness: 0.5pt),
)[
  #text(
    font: t.mono-font,
    size: 7.2pt,
    weight: "bold",
    fill: t.deep,
  )[#name]
  #linebreak()
  #text(size: 0.88em)[#description]
]

#show: notes.paper_notes.with(
  title: "Linearizability — guided-reading dossier",
  subtitle: "Long-form validation: formal model, learner layers, evidence and transfer questions",
  authors: ("Maurice P. Herlihy", "Jeannette M. Wing"),
  paper_id: "herlihy-wing-1990-linearizability",
  doi: "10.1145/78969.78972",
  stage: "ANNOTATE / READ-2 · STRATA VALIDATION",
  variant: variant,
)

#evidence("BOUNDARY")[
  This is a visual-validation fixture. The focal paper and the persisted YDMP
  artifacts remain the source of truth; this specimen does not promote
  hypotheses or learner interpretations to canonical claims.
]

#pagebreak()
#section-kicker[PAGE 02 · EVENTS AND HISTORIES]
= Events before operations
A concurrent history does not begin with atomic method calls. It begins with invocation and response events. This distinction preserves the interval during which another process may observe an effect, help complete the operation, or race with a state transition.

#evidence("CONFIRMED")[In the Herlihy–Wing model, a history is a finite sequence of invocation and response events. A well-formed process subhistory alternates matching invocations and responses.]

#grid(columns: (1fr, auto, 1fr), gutter: 8pt,
  state("INVOCATION", [process requests $"write"(1)$], fill: t.ice),
  align(center)[#text(size: 16pt, fill: t.accent)[→]],
  state("RESPONSE", [process receives $"ok"$], fill: t.ice.lighten(25%)),
)

The operation interval is the part of the history between those events. Non-overlapping operations induce a real-time precedence relation. Overlapping operations remain unordered by real time and may admit more than one legal sequential explanation.

#thought(kind: "Главная мысль")[The model refuses to assume atomicity at the point where atomicity must be proved. Splitting invocation from response is therefore not notation overhead; it is the space in which concurrency exists.]

== Reading checkpoint
- Identify which events belong to one process.
- Pair each response with its invocation.
- Mark operations that are pending at the end of the prefix.
- Only then reason about candidate linearizations.

#table(columns: (1fr, 1.7fr, 1.5fr), inset: 5pt,
  [*Term*], [*What is observed*], [*What is not yet implied*],
  [Invocation], [A process requested an operation.], [The operation already took effect.],
  [Response], [A result became visible to the caller.], [The effect happened exactly at response time.],
  [Pending], [The invocation has no matching response in this prefix.], [The operation had no externally visible effect.],
)

== Micro-analysis
In the prefix below, `deq()` is pending while `enq(x)` is complete. The prefix can still be part of a linearizable execution, but its completion choices must remain consistent with the queue specification.
```text
P: inv enq(x) · rsp ok
Q: inv deq()
```
#pagebreak()

#section-kicker[PAGE 03 · PROJECTIONS AND EQUIVALENCE]
= What equivalence preserves
For a process $P$, the projection $H|P$ keeps only events issued by or returned to that process. For an object $x$, the projection $H|x$ keeps only events targeting that object.

Two histories are equivalent when every process observes the same local subhistory:
$ H equiv S quad "iff" quad forall P: H|P = S|P. $

#evidence("CONFIRMED")[Equivalence is process-local. It preserves each process's issued calls and received results, but it does not by itself preserve real-time order between different processes.]

#grid(columns: (1fr, 1fr), gutter: 10pt,
  block(inset: 8pt, fill: t.ice)[
    *History $H$*
    ```text
    inv P: write(1)
    inv Q: read()
    rsp Q: 0
    rsp P: ok
    ```
  ],
  block(inset: 8pt, fill: t.ice)[
    *Process projections*
    ```text
    H|P = write(1) → ok
    H|Q = read() → 0
    ```
  ],
)

#thought(kind: "Связь с определением", mark: "≡")[Equivalence answers “does every process receive the same personal story?” Real-time precedence adds the separate question “may those personal stories be assembled in this global order?”]

== Object boundaries
Locality later permits object-wise verification, but only after the object boundary is chosen correctly. A tablet, actor, file or cache line is not automatically one abstract object.

#table(columns: (1.15fr, 1.6fr, 1.7fr), inset: 5pt,
  [*Relation*], [*Preserves*], [*Does not establish*],
  [Process equivalence], [Calls and returns seen by each process.], [Cross-process real-time order or object legality.],
  [Object legality], [A behavior admitted by the sequential specification.], [That client-local histories are unchanged.],
  [Real-time precedence], [Order of non-overlapping operations.], [An order between overlapping operations.],
)

#thought(kind: "Проверка понимания", mark: "✓")[If two histories have the same object projection but different return values for one process, they are not equivalent. Object-level resemblance cannot replace process-local observation.]
#pagebreak()

#section-kicker[PAGE 04 · DEFINITION SKELETON]
= Linearizability in two obligations
A history $H$ is linearizable when it can be extended to $H'$ by appending responses to some pending invocations, and $"complete"(H')$ is equivalent to a legal sequential history $S$ that respects real-time precedence.

#block(width: 100%, inset: 12pt, radius: t.radius, fill: t.ice, stroke: (paint: t.deep, thickness: 1pt))[
  #align(center)[#text(font: t.heading-font, size: 16pt, weight: "bold", fill: t.deep)[
    $ exists H', S: "complete"(H') equiv S quad and quad <_H subset.eq <_S $
  ]]
]

#grid(columns: (1fr, 1fr), gutter: 10pt,
  state("L1 · LEGALITY", [The completed behavior must be admitted by the sequential specification.], fill: t.ice.lighten(25%)),
  state("L2 · REAL TIME", [If one operation returns before another begins, the sequential order may not reverse them.], fill: t.ice.lighten(25%)),
)

#evidence("INFERRED")[The existential quantifier permits several candidate orders for overlapping operations. It does not claim that one such order physically existed as a global log inside the implementation.]

#thought(kind: "Причинная цепочка", mark: "→")[Completion handles unfinished interfaces; equivalence preserves process-visible behavior; legality connects the history to the abstract data type; real time rules out explanations already contradicted by observation.]

== Diagnostic question
Which conjunct fails when a completed `write(1)` is followed by a non-overlapping `read()` that returns `0`?

#table(columns: (1.1fr, 1.25fr, 1.8fr), inset: 5pt,
  [*Candidate explanation*], [*Real time*], [*Sequential register legality*],
  [`read < write`], [Rejected: write completed before read began.], [Would explain `0`, but violates L2.],
  [`write < read`], [Required by L2.], [Read must return `1`; observed `0` violates L1.],
)

The history therefore has no sequential witness satisfying both obligations. This two-column rejection method is often more reliable than trying to guess a single “linearization point” immediately.

#thought(kind: "Рабочий алгоритм")[First enumerate orders allowed by real time. Then execute the abstract sequential specification in each order. Reject a history only after every permitted candidate fails.]
#pagebreak()

#section-kicker[PAGE 05 · PENDING INVOCATIONS]
= Why complete(H′) is not merely cleanup
A pending invocation has no matching response in the observed history. Its internal effect may nevertheless have become visible. The definition therefore does not simply delete every pending call.

The construction has two choices:
1. append a matching response to selected pending invocations in $H'$;
2. remove the invocations that remain pending when taking $"complete"(H')$.

#grid(columns: (1fr, auto, 1fr), gutter: 8pt,
  state("PENDING", [invocation exists; response absent], fill: t.ice),
  align(center)[#text(size: 15pt, fill: t.accent)[↠]],
  state("ACCOUNTED FOR", [complete it in $H'$ or omit it from $"complete"(H')$], fill: t.ice.lighten(22%)),
)

#evidence("INFERRED")[The extension step allows the abstract history to include an operation whose linearization point may already have occurred even though its caller has not observed a response.]

#thought(kind: "Моя рабочая модель")[As an external observer I see invocation and response, not a private “effect happened” bit. The definition must therefore permit an abstract completion consistent with visible effects rather than deciding solely from response delivery.]

== Failure semantics
This safety definition does not promise that every pending operation eventually returns. Progress conditions—blocking, lock-free and wait-free—must be stated separately.

#table(columns: (1.35fr, 1.45fr, 1.6fr), inset: 5pt,
  [*Observed prefix*], [*Possible abstract treatment*], [*Additional information needed*],
  [Call pending; no later operation observes its effect.], [Omit it from $"complete"(H')$.], [Nothing forces an abstract completion.],
  [Call pending; a later read observes the new value.], [Append a response in $H'$ and include it.], [The sequential specification must permit the observed read.],
  [Response lost after effect and crash.], [Include or omit only if the rest of the history remains legal.], [The API's retry/idempotency contract is outside linearizability alone.],
)

== Prefix discipline
Because linearizability is prefix-closed, a legal explanation for the complete execution cannot repair an already illegal earlier prefix. This is why online history checkers can reject some executions before the workload ends.
#pagebreak()

#section-kicker[PAGE 06 · REGISTER EXAMPLES]
= Real time changes the answer
Let a register initially contain $0$.

#table(columns: (1.1fr, 1fr, 1.1fr), inset: 6pt,
  [*History*], [*Candidate order*], [*Result*],
  [$"write"(1)$ completes before $"read"()$ begins; read returns $0$], [$"write" < "read"$], [Illegal: the sequential register must return $1$],
  [write and read overlap; read returns $0$], [$"read" < "write"$], [Potentially legal],
  [write and read overlap; read returns $1$], [$"write" < "read"$], [Potentially legal],
)

#evidence("CONFIRMED")[Real-time precedence orders only non-overlapping operations. Overlap leaves room for multiple sequential explanations, subject to the object's specification.]

#thought(kind: "Свой пример", mark: "◇")[A timeout does not automatically mean “operation never happened.” If a retry can duplicate an externally visible effect, the API needs an idempotency or operation-identity contract in addition to linearizability.]

== A useful reconstruction method
For each operation, draw its interval. Add an edge only when one response precedes another invocation. Then enumerate topological orders and reject those that violate the sequential specification.

```text
P: |---- write(1) ----|
Q:          |---- read() -> 0 ----|
              overlap: either abstract order may remain possible
```

#table(columns: (1fr, 1.1fr, 1.5fr), inset: 5pt,
  [*Read result*], [*Sequential witness*], [*Required abstract state*],
  [`0`], [`read < write`], [Register remains at its initial value until the read.],
  [`1`], [`write < read`], [The write changes the abstract state before the read.],
)

== Retry boundary
A client that receives no response cannot infer which witness was chosen. A robust write API may therefore need operation identifiers, duplicate suppression or an at-least-once/at-most-once contract in addition to a linearizable object specification.
#pagebreak()

#section-kicker[PAGE 07 · FIFO QUEUE]
= Sequential specification still owns meaning
Linearizability does not define a queue. The sequential specification does. For a FIFO queue, an enqueue appends an item and a successful dequeue removes the oldest available item.

#grid(columns: (1fr, 1fr), gutter: 10pt,
  block(inset: 8pt, fill: t.ice)[
    *Candidate A*
    ```text
    enq(x) completes
    enq(y) completes
    deq() -> y
    ```
    Real time forces $x$ before $y$; returning $y$ first is illegal.
  ],
  block(inset: 8pt, fill: t.ice)[
    *Candidate B*
    ```text
    enq(x) overlaps enq(y)
    deq() -> y
    ```
    If the enqueues overlap, $y$ may be linearized first.
  ],
)

#evidence("CONFIRMED")[A legal sequential history belongs to the prefix-closed sequential specification of the object. The correctness condition does not replace object semantics.]

#thought(kind: "Главная мысль")[“Looks atomic” is incomplete. We must state: atomic with respect to which operations, which object boundary, and which legal sequential behaviors?]

== Implementation transfer
A Pinega buffer mapping is not a FIFO queue, but the proof discipline transfers: define the abstract mapping and frame lifecycle first; only then choose candidate linearization points for lookup, publication, pinning and eviction.

#table(columns: (1.15fr, 1.55fr, 1.55fr), inset: 5pt,
  [*Queue question*], [*General proof obligation*], [*Pinega analogue*],
  [Which item may `deq` return?], [Apply the legal sequential specification.], [Which logical page may a handle denote?],
  [When can two enqueues be reordered?], [Use operation overlap and real time.], [Can publication and eviction be reordered?],
  [What is a completed operation?], [Resolve pending invocation treatment.], [Has a frame become externally usable or only privately initialized?],
)

#thought(kind: "Дизайн спецификации")[The abstract state should not mention hash buckets, pointer widths or PostgreSQL buffer descriptors unless those details are part of the client-visible contract.]
#pagebreak()

#section-kicker[PAGE 08 · LOCALITY]
= Verification can compose by object
The locality theorem states that a history is linearizable if and only if every object subhistory is linearizable.

#block(width: 100%, inset: 12pt, fill: t.ice, stroke: (paint: t.deep, thickness: 1pt))[
  #align(center)[#text(font: t.heading-font, size: 15pt, weight: "bold", fill: t.deep)[
    $ H " is linearizable" quad "iff" quad forall x: H|x " is linearizable" $
  ]]
]

#grid(columns: (1fr, auto, 1fr, auto, 1fr), gutter: 6pt,
  state("OBJECT x", [choose legal $S_x$], fill: t.ice.lighten(22%)),
  align(center)[+],
  state("OBJECT y", [choose legal $S_y$], fill: t.ice.lighten(22%)),
  align(center)[+],
  state("REAL TIME", [preserve cross-object order], fill: t.ice.lighten(22%)),
)

#evidence("CONFIRMED")[Locality is a compositional property of linearizability. It supports independent object implementations and proofs while preserving a global history.]

#thought(kind: "Неясность", mark: "?")[The difficult direction is not “project a global linearization.” It is “merge independently selected object orders without creating a cycle with process and real-time edges.” I need the proof construction, not only the theorem statement.]

== Pinega implication
Object boundaries become an architectural decision. A frame slot, logical page, mapping partition and transaction are different candidates; choosing one merely because it matches a C struct would be unsound.

== Proof-construction skeleton
1. Choose a legal sequential history $S_x$ for each object projection.
2. Form a relation containing object-order edges, process-order edges and real-time edges.
3. Prove that the combined relation is acyclic.
4. Take a topological extension to obtain one global sequential history.
5. Verify that each process projection and object projection is preserved.

#evidence("PROOF GAP")[The crucial acyclicity argument must be reconstructed from the primary proof. The checklist above records the intended construction, not a substitute proof.]

#table(columns: (1.1fr, 1.6fr, 1.55fr), inset: 5pt,
  [*Candidate object*], [*Advantage*], [*Boundary risk*],
  [Logical page mapping], [Natural lookup/update specification.], [Lifetime of physical frames is a separate object.],
  [Frame slot], [Matches reuse and pin operations.], [One logical page may move between slots.],
  [Transaction], [Captures multi-page invariants.], [Requires serializability, not only object linearizability.],
)
#pagebreak()

#section-kicker[PAGE 09 · PROGRESS]
= Safety does not say who finishes
Linearizability is a safety property. A system can remain linearizable while every operation waits forever. Progress conditions describe what completion guarantee is added under continued execution.

#table(columns: (1fr, 1.55fr, 1.55fr), inset: 6pt,
  [*Condition*], [*System guarantee*], [*Possible starvation*],
  [Blocking], [Progress may depend on a delayed owner of a lock or resource.], [Any waiting participant may be stalled by that owner.],
  [Lock-free], [After finitely many system steps, some operation completes.], [A particular operation may retry forever.],
  [Wait-free], [Every operation completes after a bounded number of its own steps.], [No starvation under the stated model.],
)

#evidence("INFERRED")[“At least one thread makes progress” is the key lock-free distinction. It does not imply that every participating thread finishes.]

#thought(kind: "Связь с реализацией")[A fast-path CAS loop may be lock-free yet exhibit unbounded per-operation retries. A product claim must specify scheduler assumptions, process failure semantics and whether helping is available across PostgreSQL backends.]

== Review checklist
- Is memory reclamation itself lock-free?
- Can a crashed process retain a pin or hazard indefinitely?
- Does fallback to a heavyweight lock change the advertised guarantee?
- Are bounded retries measured in system steps or the operation's own steps?

#table(columns: (1.2fr, 1.55fr, 1.55fr), inset: 5pt,
  [*Execution pattern*], [*Lock-free interpretation*], [*Wait-free interpretation*],
  [One process repeatedly loses CAS while others complete.], [Permitted: system progress exists.], [Rejected if its own bound is exceeded.],
  [Owner is descheduled while holding a mutex.], [Blocking.], [Not wait-free.],
  [Helping completes another descriptor.], [May establish system progress.], [Still needs a per-operation bound.],
)

== PostgreSQL process caveat
A backend can fail while shared metadata remains. State whether another backend can clean up its descriptor, pin or hazard slot without waiting for the failed owner.

#thought(kind: "Interview formulation")[Lock-free guarantees completion of some operation; wait-free bounds every operation. Lock-free therefore permits starvation of one unlucky participant.]
#pagebreak()

#section-kicker[PAGE 10 · COMPARISON AND NEXT ACTIONS]
= Keep models at the right granularity
Sequential consistency preserves process program order but not the same real-time precedence between processes. Serializability orders transactions rather than individual object operations. Strict serializability adds a real-time constraint at transaction granularity.

#table(columns: (1.15fr, 1fr, 1fr, 1.15fr), inset: 5pt,
  [*Model*], [*Unit*], [*Real time*], [*Compositional by object*],
  [Linearizability], [operations], [yes], [yes],
  [Sequential consistency], [operations], [no], [not generally],
  [Serializability], [transactions], [no], [not by independent objects],
  [Strict serializability], [transactions], [yes], [transaction model required],
)

#evidence("EXTERNAL / COMPARISON")[The table is a study aid. Exact equivalence notions and failure models must be verified from the primary source for each condition.]

#thought(kind: "Главная мысль")[For Pinega, a linearizable internal mapping does not automatically make a SQL transaction strictly serializable. Internal object correctness and transaction-level isolation are separate proof obligations.]

== Open verification queue
1. Reconstruct the locality proof and its acyclicity argument.
2. Define a Pinega abstract buffer mapping independently of the PostgreSQL structs.
3. Assign candidate linearization points to lookup, publication, pin and retirement.
4. Choose an SMR/lifetime protocol compatible with process crashes.
5. Test histories generated from the real implementation against the specification.

#grid(columns: (1fr, 1fr), gutter: 10pt,
  block(inset: 8pt, fill: t.ice)[
    *Already stable*
    - invocation/response model
    - L1 legality versus L2 real time
    - lock-free versus wait-free distinction
    - internal object versus transaction granularity
  ],
  block(inset: 8pt, fill: t.ice)[
    *Requires source-level verification*
    - locality merge construction
    - exact nonblocking theorem assumptions
    - candidate Pinega object boundaries
    - process-compatible lifetime protocol
  ],
)

#v(5mm)
#motif()
#align(center)[#text(font: t.ui-font, size: 9pt, weight: "bold", fill: t.accent)[END OF IDENTICAL TEN-PAGE SPECIMEN]]
