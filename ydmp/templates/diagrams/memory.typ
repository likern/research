// Michael–Scott queue specimens over the generic linked-queue model.
//
// `queue-model.typ` owns semantic records and invariants; `queue.typ` owns
// deterministic layout. This module contributes only algorithm-specific state
// sequences and re-exports the stable queue API used by research notes.

#import "queue-model.typ" as model
#import "queue.typ" as queue

#let queue-node = model.queue-node
#let queue-pointer = model.queue-pointer
#let queue-state = model.queue-state
#let render-queue-state = queue.render-queue-state
#let queue-state-text = queue.queue-state-text
#let queue-state-figure = queue.queue-state-figure

// Enqueue publishes the candidate at E9 by changing the predecessor's `next`
// pointer from NULL to the new node. Moving Tail at E13/E17 is cleanup and can
// be performed by a helper after the operation has already linearized.
#let michael-scott-enqueue-states = (
  queue-state(
    "enqueue-candidate",
    (
      queue-node("S", [∅], next: "A", sentinel: true),
      queue-node("A", [a]),
      queue-node("B", [b], state: "candidate", note: [private node]),
    ),
    ("S", "A", "B"),
    (
      queue-pointer("head", "S", label: [Head], count: 12, slot: -1),
      queue-pointer("tail", "A", label: [Tail], count: 16, slot: 1),
      queue-pointer("new", "B", label: [new], scope: "local", side: "below", tone: "event"),
    ),
    title: [E1–E8 · candidate prepared],
    transition: [B.next = NULL; B is private and unreachable from Head],
    focus-node: "B",
  ),
  queue-state(
    "enqueue-linked-tail-lag",
    (
      queue-node("S", [∅], next: "A", sentinel: true),
      queue-node("A", [a], next: "B"),
      queue-node("B", [b], state: "new"),
    ),
    ("S", "A", "B"),
    (
      queue-pointer("head", "S", label: [Head], count: 12, slot: -1),
      queue-pointer("tail", "A", label: [Tail], count: 16, slot: 1, tone: "warning", note: [lags]),
      queue-pointer("new", "B", label: [new], scope: "local", side: "below", tone: "event"),
    ),
    title: [E9 · link CAS succeeds],
    transition: [linearization · CAS(&A.next, NULL, B)],
    focus-edge: ("A", "B"),
    focus-label: [E9 · LINK CAS],
  ),
  queue-state(
    "enqueue-tail-advanced",
    (
      queue-node("S", [∅], next: "A", sentinel: true),
      queue-node("A", [a], next: "B"),
      queue-node("B", [b]),
    ),
    ("S", "A", "B"),
    (
      queue-pointer("head", "S", label: [Head], count: 12, slot: -1),
      queue-pointer("tail", "B", label: [Tail], count: 17, slot: 1, tone: "inferred"),
    ),
    title: [E13 / E17 · Tail advanced],
    transition: [helping or cleanup; enqueue was already complete at E9],
    focus-node: "B",
    focus-pointer: "tail",
  ),
)

// When a dequeuer observes Head == Tail and next != NULL, Tail is stale. D10
// advances it before D13 can swing Head. The successful Head CAS linearizes the
// dequeue; the old dummy is retired but remains allocated until an SMR protocol
// permits reclamation and address reuse.
#let michael-scott-dequeue-states = (
  queue-state(
    "dequeue-help-required",
    (
      queue-node("A", [∅], next: "B", sentinel: true),
      queue-node("B", [b]),
    ),
    ("A", "B"),
    (
      queue-pointer("head", "A", label: [Head], count: 21, slot: -1),
      queue-pointer("tail", "A", label: [Tail], count: 30, slot: 1, tone: "warning", note: [lags]),
      queue-pointer("next", "B", label: [next], scope: "local", side: "below", tone: "event"),
    ),
    title: [D6–D10 · lagging Tail detected],
    transition: [Head == Tail and next != NULL ⇒ help Tail first],
    focus-edge: ("A", "B"),
    focus-pointer: "tail",
    focus-label: [REACHABLE],
  ),
  queue-state(
    "dequeue-tail-helped",
    (
      queue-node("A", [∅], next: "B", sentinel: true),
      queue-node("B", [b]),
    ),
    ("A", "B"),
    (
      queue-pointer("head", "A", label: [Head], count: 21, slot: -1),
      queue-pointer("tail", "B", label: [Tail], count: 31, slot: 1, tone: "event"),
      queue-pointer("next", "B", label: [next], scope: "local", side: "below", tone: "inferred"),
    ),
    title: [D10 · Tail helped forward],
    transition: [shared Tail now names the reachable last node],
    focus-node: "B",
    focus-pointer: "tail",
  ),
  queue-state(
    "dequeue-head-swung",
    (
      queue-node("A", [∅], next: "B", state: "retired", note: [old dummy; await SMR]),
      queue-node("B", [b], sentinel: true, note: [new dummy; value copied before CAS]),
    ),
    ("A", "B"),
    (
      queue-pointer("head", "B", label: [Head], count: 22, slot: -1, tone: "event"),
      queue-pointer("tail", "B", label: [Tail], count: 31, slot: 1, tone: "inferred"),
      queue-pointer("value", "B", label: [return b], scope: "local", side: "below", tone: "inferred"),
    ),
    title: [D13 · Head CAS succeeds],
    transition: [linearization · CAS(&Head, A, B); A enters retirement],
    focus-node: "B",
    focus-pointer: "head",
  ),
)

#let michael-scott-gate-states = michael-scott-enqueue-states + michael-scott-dequeue-states
