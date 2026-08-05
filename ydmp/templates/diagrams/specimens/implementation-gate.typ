#import "../../notes/template.typ": paper_notes, note_panel, evidence
#import "../theme.typ": diagram-theme, print-diagram-theme
#import "../primitives.typ": diagram-figure, diagram-panel
#import "../history.typ": (
  history-lane, history-operation, history-marker, history-witness,
  history-model, render-history, render-history-with-witnesses, history-text,
)
#import "../memory.typ": (
  render-queue-state, queue-state-text, michael-scott-gate-states,
)
#import "../dsa.typ": sequential-queue
#import "../chapter3.typ": (
  fig-3-2-lock-execution,
  fig-3-4-register-one-at-a-time,
  fig-3-5-program-order,
  fig-3-6-two-sequential-orders,
  fig-3-7-sc-versus-real-time,
  fig-3-8-compositionality-cycle,
  fig-3-9-pending-completion,
  fig-3-10-progress-matrix,
)

#let theme = diagram-theme()

#show: paper_notes.with(
  title: "Semantic Concurrency Diagram Gate",
  subtitle: "Linearizability histories, Michael–Scott queue states, and TAOMP Chapter 3",
  authors: ("Pinega Labs / YDMP Research Workspace",),
  paper_id: "ydmp-semantic-diagrams-gate-001",
  stage: "DIAGRAM-GATE / VECTOR-1",
  variant: "candidate-strata",
)

#set figure.caption(separator: [ — ])
#show figure.where(kind: "ydmp-diagram"): set block(above: 0.8em, below: 1.0em)

= 1. Architecture and invariants

#note_panel(title: "Boundary", kind: "verification", variant: "candidate-strata")[
  The implementation separates *semantic model*, *validation*, *layout*, and
  *rendering*. Note sources do not place CeTZ primitives directly. The same
  history or queue-state model produces a vector figure and a deterministic
  textual projection.
]

#evidence("CONFIRMED", variant: "candidate-strata")[
  CeTZ 0.5.2 is the custom vector backend. Conventional sequential structures
  and node-edge relation graphs are isolated behind a typed-dsa 0.6.0 adapter;
  concurrent histories and transient queue states remain YDMP-owned semantics.
]

The gate checks these design invariants:

1. operation, process, node, link, and pointer identity are explicit;
2. per-thread histories are well formed and a linearization mark lies inside its operation interval;
3. shared pointers and local observations are distinct semantic records;
4. node positions remain stable across queue-state transitions;
5. status is communicated through labels, line style, shape, and geometry—not colour alone.

= 2. Linearizability history

#let linearizable-history = history-model(
  (
    history-lane("P", label: [P]),
    history-lane("Q", label: [Q]),
    history-lane("R", label: [R]),
  ),
  (
    history-operation("enq-x", "P", [q.enq(x)], 0.2, end: 2.0, result: [ok], linearization: 1.05),
    history-operation("peek", "P", [q.peek()], 5.1, end: none, tone: "pending"),
    history-operation("enq-y", "Q", [q.enq(y)], 0.65, end: 2.45, result: [ok], linearization: 1.75, tone: "inferred"),
    history-operation("deq-x", "R", [q.deq()], 2.75, end: 4.25, result: [x], linearization: 3.35, tone: "event"),
  ),
  markers: (history-marker(4.65, [quiescent], tone: "event"),),
  witnesses: (
    history-witness([FIFO witness], ("enq-x", "enq-y", "deq-x")),
  ),
  title: [Overlapping FIFO operations with explicit linearization evidence],
  horizon: 6.25,
)

#diagram-figure(
  render-history-with-witnesses(linearizable-history, theme: theme, scale: 0.82),
  [A linearizable FIFO history with overlapping enqueues, a dequeue, and a pending call.],
  "Three process lanes. Enqueue x and enqueue y overlap and each has a marked linearization point. A later dequeue returns x. A quiescent cut follows completed operations. Process P then has a pending peek shown as a dashed open interval. Below the timeline, a FIFO witness orders enqueue x, enqueue y, and dequeue x.",
)

The same semantic model has a searchable, diffable textual projection:

#history-text(linearizable-history, theme: theme)

= 3. Michael–Scott queue states

The figures use the original counted-pointer presentation. The enqueue
linearization point is the successful CAS that links the candidate through
`last.next`; advancing `Tail` is cleanup and may be performed by another thread.
A dequeuer that observes `Head == Tail` with `next != NULL` first helps the
lagging tail.

#for (index, state) in michael-scott-gate-states.enumerate() [
  #diagram-figure(
    diagram-panel(
      render-queue-state(state, theme: theme, scale: 0.77),
      title: state.title,
      theme: theme,
    ),
    [Michael–Scott queue state #(index + 1): #state.title.],
    if state.id == "enqueue-candidate" {
      "Shared Head points to dummy S and shared Tail points to A. Candidate B is shown below the chain through a dashed local new pointer; B is private and unreachable from Head."
    } else if state.id == "enqueue-linked-tail-lag" {
      "A highlighted link from A.next to B has been published by the successful E9 compare-and-swap, which linearizes enqueue. Shared Tail still points to A and is explicitly labelled as lagging."
    } else if state.id == "enqueue-tail-advanced" {
      "The chain is dummy S to A to B. Shared Tail, highlighted above B, has advanced to B with an incremented count; this is cleanup after the enqueue linearization point."
    } else if state.id == "dequeue-help-required" {
      "Shared Head and Tail both point to dummy A while A.next points to B. A dashed local next observation points to B. The reachable link and lagging Tail are highlighted; the dequeuer must help Tail first."
    } else if state.id == "dequeue-tail-helped" {
      "Shared Head still points to dummy A, but the D10 helping CAS has advanced shared Tail to B. The local next observation and the highlighted Tail both name B."
    } else {
      "Shared Head and Tail point to B, the new dummy whose value b was copied before the CAS. Old dummy A is drawn with a dashed retired state and awaits safe memory reclamation."
    },
  )
]

A canonical textual state remains available for search, review, and terminal use:

#queue-state-text(michael-scott-gate-states.at(1), theme: theme)

= 4. typed-dsa integration boundary

The adapter is intentionally narrow. It is used when the semantic object is a
conventional sequential structure or a generic relation graph; it is not used
to fake transient concurrent state.

#diagram-figure(
  diagram-panel(
    sequential-queue(([x], [y], [z]), theme: theme),
    title: [Reference sequential FIFO state rendered by typed-dsa],
    theme: theme,
  ),
  [Reference sequential queue used as a contrast for the custom concurrent-state renderer.],
  "A conventional sequential FIFO queue contains x, y, and z in front-to-rear order.",
)

= 5. TAOMP Chapter 3 reconstructed specimens

These figures reconstruct the executions and correctness arguments described in
Chapter 3. They share one semantic history model and the Strata visual grammar;
none embeds or traces the book artwork.

== 5.1 Lock-based execution

#diagram-figure(
  fig-3-2-lock-execution(theme: theme),
  [A lock-based FIFO execution in which C first observes an empty queue, B enqueues b, A enqueues a, and C dequeues b.],
  "Three process lanes show four globally non-overlapping queue operations. C first dequeues from an empty queue, then B enqueues b, A enqueues a, and C dequeues b. Each operation contains a linearization mark.",
)

== 5.2 One-at-a-time order and program order

#diagram-figure(
  fig-3-4-register-one-at-a-time(theme: theme),
  [Two overlapping writes cannot justify a later read of a torn register value.],
  "Threads A and B concurrently write minus three and seven. Thread C later reads minus seven, which is marked invalid because it is not a value written by either operation.",
)

#diagram-figure(
  fig-3-5-program-order(theme: theme),
  [One process writes 7, writes minus 3, and then reads 7, violating its own program order.],
  "A single process performs write seven, write minus three, and read. The read returns seven and is marked invalid because the most recent write in program order was minus three.",
)

== 5.3 Sequential consistency and real time

#diagram-figure(
  fig-3-6-two-sequential-orders(theme: theme),
  [Overlapping queue operations admit two legal sequential explanations.],
  "Two process lanes contain overlapping enqueues of x and y followed by dequeues returning y to A and x to B. Two witness rows show alternative legal sequential orders S1 and S2.",
)

#diagram-figure(
  fig-3-7-sc-versus-real-time(theme: theme),
  [Sequential consistency can preserve program order while reversing non-overlapping operations from different processes.],
  "Enqueue x completes before enqueue y begins, and a labelled real-time constraint points from the first operation to the second. The sequential-consistency witness orders enqueue y first so a later dequeue can return y.",
)

== 5.4 Non-compositionality

#diagram-figure(
  fig-3-8-compositionality-cycle(theme: theme),
  [Two FIFO projections are sequentially consistent, but their queue and program-order constraints form a global directed cycle.],
  "The left panel shows operations on queues p and q by processes A and B. The right panel contains four rounded nodes in a directed cycle: two FIFO edges for p and q and two program-order edges for A and B. The cycle prevents one global sequential order.",
)

== 5.5 Pending invocation and completion

#diagram-figure(
  fig-3-9-pending-completion(theme: theme),
  [A pending enqueue must be completed in an extension H-prime to justify a dequeue returning x.],
  "Process A has a pending enqueue x with a linearization point inside its dashed interval. Process B completes a dequeue returning x. A later vertical marker says append response in H-prime, and the witness orders enqueue before dequeue.",
)

== 5.6 Progress-condition taxonomy

#figure(
  fig-3-10-progress-matrix(theme: theme),
  caption: [Progress conditions classified by progress scope, blocking behaviour, and scheduling assumptions.],
  kind: table,
)

= 6. Print and monochrome check

The renderer accepts a theme record rather than reading global colours. A
monochrome publication figure therefore preserves distinctions through line
style, endpoint geometry, labels, and layout.

#diagram-figure(
  fig-3-9-pending-completion(theme: print-diagram-theme),
  [The pending-completion history rendered with the monochrome print theme.],
  "A monochrome timeline shows a pending enqueue with a linearization mark, a completed dequeue returning x, an appended-response marker, and a sequential witness. Distinctions remain visible without colour.",
)
