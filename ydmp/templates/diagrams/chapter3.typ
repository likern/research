// Original Strata reconstructions of the principal diagrams in TAOMP Chapter 3.
//
// The executions and order constraints follow the chapter's examples. Layout,
// typography, colour, and geometry are native to the YDMP workspace; this file
// does not reproduce or embed the book artwork.

#import "history.typ": (
  history-lane, history-operation, history-marker, history-witness,
  history-precedence, history-model, render-history,
  render-history-with-witnesses,
)
#import "dsa.typ": (
  relation-node, relation-edge, relation-graph, render-relation-graph,
)
#import "theme.typ": diagram-theme
#import "primitives.typ": diagram-panel

#let fig-3-2-lock-execution(theme: diagram-theme()) = {
  let execution = history-model(
    (
      history-lane("A", label: [A]),
      history-lane("B", label: [B]),
      history-lane("C", label: [C]),
    ),
    (
      history-operation("c-empty", "C", [q.deq()], 0.1, end: 0.95, result: [Empty], linearization: 0.52, tone: "warning"),
      history-operation("b-enq", "B", [q.enq(b)], 1.15, end: 2.0, result: [ok], linearization: 1.57, tone: "inferred"),
      history-operation("a-enq", "A", [q.enq(a)], 2.2, end: 3.05, result: [ok], linearization: 2.62),
      history-operation("c-deq", "C", [q.deq()], 3.25, end: 4.15, result: [b], linearization: 3.70, tone: "event"),
    ),
    title: [Lock-based FIFO execution: one critical section at a time],
    horizon: 4.55,
  )
  render-history(execution, theme: theme, scale: 0.78)
}

#let fig-3-4-register-one-at-a-time(theme: diagram-theme()) = {
  let execution = history-model(
    (
      history-lane("A", label: [A]),
      history-lane("B", label: [B]),
      history-lane("C", label: [C]),
    ),
    (
      history-operation("write-minus", "A", [r.write(-3)], 0.2, end: 2.45),
      history-operation("write-seven", "B", [r.write(7)], 0.65, end: 2.75, tone: "inferred"),
      history-operation("read-torn", "C", [r.read()], 3.15, end: 4.35, result: [-7], tone: "danger", note: [not a legal register value]),
    ),
    title: [One-at-a-time order rejects a torn value],
    horizon: 4.75,
  )
  render-history(execution, theme: theme, scale: 0.78)
}

#let fig-3-5-program-order(theme: diagram-theme()) = {
  let execution = history-model(
    (history-lane("A", label: [A]),),
    (
      history-operation("write-seven", "A", [r.write(7)], 0.2, end: 1.2),
      history-operation("write-minus", "A", [r.write(-3)], 1.55, end: 2.55),
      history-operation("read-seven", "A", [r.read()], 2.9, end: 3.95, result: [7], tone: "danger", note: [last write was -3]),
    ),
    title: [Program-order violation],
    horizon: 4.35,
  )
  render-history(execution, theme: theme, scale: 0.82)
}

#let fig-3-6-two-sequential-orders(theme: diagram-theme()) = {
  let execution = history-model(
    (
      history-lane("A", label: [A]),
      history-lane("B", label: [B]),
    ),
    (
      history-operation("a-enq-x", "A", [q.enq(x)], 0.2, end: 1.75),
      history-operation("a-deq-y", "A", [q.deq()], 2.35, end: 3.75, result: [y]),
      history-operation("b-enq-y", "B", [q.enq(y)], 0.5, end: 2.0, tone: "inferred"),
      history-operation("b-deq-x", "B", [q.deq()], 2.25, end: 3.60, result: [x], tone: "inferred"),
    ),
    witnesses: (
      history-witness([S₁], ("a-enq-x", "b-enq-y", "b-deq-x", "a-deq-y")),
      history-witness([S₂], ("b-enq-y", "a-enq-x", "a-deq-y", "b-deq-x"), tone: "inferred"),
    ),
    title: [Two legal sequential explanations],
    horizon: 4.15,
  )
  render-history-with-witnesses(execution, theme: theme, scale: 0.78)
}

#let fig-3-7-sc-versus-real-time(theme: diagram-theme()) = {
  let execution = history-model(
    (
      history-lane("A", label: [A]),
      history-lane("B", label: [B]),
    ),
    (
      history-operation("a-enq-x", "A", [q.enq(x)], 0.15, end: 1.05),
      history-operation("a-deq-y", "A", [q.deq()], 2.85, end: 3.85, result: [y]),
      history-operation("b-enq-y", "B", [q.enq(y)], 1.50, end: 2.40, tone: "inferred"),
    ),
    markers: (history-marker(1.27, [real-time gap], tone: "event"),),
    witnesses: (
      history-witness([SC witness], ("b-enq-y", "a-enq-x", "a-deq-y"), tone: "inferred"),
    ),
    precedence: (
      history-precedence("a-enq-x", "b-enq-y", label: [real time], tone: "event"),
    ),
    title: [Sequential consistency need not preserve real-time order],
    horizon: 4.25,
  )
  render-history-with-witnesses(execution, theme: theme, scale: 0.78)
}

#let _fig-3-8-cycle-model() = relation-graph(
  (
    relation-node("p-y", [B · p.enq(y)], position: (0, 1.7), tone: "event"),
    relation-node("p-x", [A · p.enq(x)], position: (3.4, 1.7)),
    relation-node("q-x", [A · q.enq(x)], position: (3.4, -0.9), tone: "event"),
    relation-node("q-y", [B · q.enq(y)], position: (0, -0.9)),
  ),
  (
    relation-edge("p-y", "p-x", label: [FIFO p], tone: "event"),
    relation-edge("p-x", "q-x", label: [program A]),
    relation-edge("q-x", "q-y", label: [FIFO q], tone: "event"),
    relation-edge("q-y", "p-y", label: [program B]),
  ),
  title: [Required order constraints],
)

#let fig-3-8-compositionality-cycle(theme: diagram-theme()) = {
  let execution = history-model(
    (
      history-lane("A", label: [A]),
      history-lane("B", label: [B]),
    ),
    (
      history-operation("a-p-enq-x", "A", [p.enq(x)], 0.15, end: 0.95),
      history-operation("a-q-enq-x", "A", [q.enq(x)], 1.20, end: 2.00),
      history-operation("a-p-deq-y", "A", [p.deq()], 2.25, end: 3.20, result: [y]),
      history-operation("b-q-enq-y", "B", [q.enq(y)], 0.35, end: 1.15, tone: "inferred"),
      history-operation("b-p-enq-y", "B", [p.enq(y)], 1.40, end: 2.20, tone: "inferred"),
      history-operation("b-q-deq-x", "B", [q.deq()], 2.45, end: 3.40, result: [x], tone: "inferred"),
    ),
    title: [Each queue projection is sequentially consistent],
    horizon: 3.80,
  )

  grid(
    columns: (1.24fr, 1fr),
    gutter: 8pt,
    diagram-panel(
      render-history(execution, theme: theme, scale: 0.55, legend: false),
      title: [Execution on p and q],
      theme: theme,
      inset: 6pt,
    ),
    diagram-panel(
      render-relation-graph(_fig-3-8-cycle-model(), theme: theme, scale: 0.64),
      title: [No global sequential order],
      theme: theme,
      inset: 6pt,
    ),
  )
}

#let fig-3-9-pending-completion(theme: diagram-theme()) = {
  let execution = history-model(
    (
      history-lane("A", label: [A]),
      history-lane("B", label: [B]),
    ),
    (
      history-operation("pending-enq", "A", [q.enq(x)], 0.2, end: none, linearization: 1.25, tone: "pending", note: [response not yet observed]),
      history-operation("deq-x", "B", [q.deq()], 1.55, end: 2.65, result: [x], linearization: 2.05, tone: "event"),
    ),
    markers: (history-marker(3.05, [append response in H′], tone: "event"),),
    witnesses: (history-witness([linearization], ("pending-enq", "deq-x")),),
    title: [A pending enqueue must take effect to justify dequeue(x)],
    horizon: 3.55,
  )
  render-history-with-witnesses(execution, theme: theme, scale: 0.82)
}

#let fig-3-10-progress-matrix(theme: diagram-theme()) = table(
  columns: (1.18fr, 0.85fr, 0.85fr, 1.35fr),
  inset: 5.3pt,
  stroke: (paint: theme.rule, thickness: theme.hairline),
  fill: (x, y) => if y == 0 {
    theme.surface-alt
  } else if calc.even(y) {
    theme.paper
  } else {
    theme.surface
  },
  table.header(
    [*Condition*], [*Progress*], [*Blocking?*], [*Assumption*],
  ),
  [Wait-free], [maximal], [nonblocking], [calling thread takes steps],
  [Lock-free], [minimal], [nonblocking], [system continues taking steps],
  [Obstruction-free], [maximal], [nonblocking], [eventual isolation],
  [Starvation-free], [maximal], [blocking], [fair scheduling],
  [Deadlock-free], [minimal], [blocking], [fair scheduling],
)
