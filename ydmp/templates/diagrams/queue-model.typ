// Semantic model and validation for linked concurrent queue states.
//
// Nodes, next links, shared counted pointers, local observations, and lifecycle
// states are represented independently. This is intentionally more expressive
// than a sequential linked-list model because transient concurrent states are
// first-class facts rather than drawing annotations.

#import "common.typ": (
  require, require-non-empty, require-unique, find-by-id,
)

#let queue-node(
  id,
  value,
  next: none,
  state: "live",
  sentinel: false,
  note: none,
) = (
  id: id,
  value: value,
  next: next,
  state: state,
  sentinel: sentinel,
  note: note,
)

#let queue-pointer(
  id,
  target,
  label: auto,
  count: none,
  scope: "shared",
  side: "above",
  slot: 0,
  tone: "primary",
  note: none,
) = (
  id: id,
  label: if label == auto { id } else { label },
  target: target,
  count: count,
  scope: scope,
  side: side,
  slot: slot,
  tone: tone,
  note: note,
)

#let queue-state(
  id,
  nodes,
  order,
  pointers,
  title: none,
  transition: none,
  focus-edge: none,
  focus-node: none,
  focus-pointer: none,
  focus-label: none,
) = {
  require-non-empty("queue-state nodes", nodes)
  require-non-empty("queue-state order", order)
  require-unique("queue-state node ids", nodes.map(node => node.id))
  require-unique("queue-state order", order)
  require-unique("queue-state pointer ids", pointers.map(pointer => pointer.id))

  let node-ids = nodes.map(node => node.id)
  require(
    order.len() == nodes.len(),
    "queue-state " + repr(id) + ": order must include every node exactly once",
  )
  for node-id in order {
    require(node-id in node-ids, "queue-state " + repr(id) + ": unknown node in order " + repr(node-id))
  }
  for node in nodes {
    if node.next != none {
      require(node.next in node-ids, "queue-state " + repr(id) + ": unknown next target " + repr(node.next))
      require(node.next != node.id, "queue-state " + repr(id) + ": self-loop at node " + repr(node.id))
    }
    require(
      node.state in ("live", "candidate", "new", "retired", "marked", "unlinked"),
      "queue-state " + repr(id) + ": unknown node state " + repr(node.state),
    )
  }
  for pointer in pointers {
    require(pointer.target in node-ids, "queue-state " + repr(id) + ": unknown pointer target " + repr(pointer.target))
    require(pointer.scope in ("shared", "local"), "queue-state pointer scope must be shared or local")
    require(pointer.side in ("above", "below"), "queue-state pointer side must be above or below")
    require(type(pointer.slot) == int, "queue-state pointer slot must be an integer")
    if pointer.count != none {
      require(type(pointer.count) == int and pointer.count >= 0, "queue-state pointer count must be a non-negative integer")
    }
  }
  if focus-edge != none {
    require(
      type(focus-edge) == array and focus-edge.len() == 2,
      "queue-state focus-edge must be a (from, to) pair",
    )
    require(focus-edge.first() in node-ids, "queue-state focus-edge has an unknown source")
    require(focus-edge.last() in node-ids, "queue-state focus-edge has an unknown target")
    let source = find-by-id("queue-state focus-edge source", nodes, focus-edge.first())
    require(
      source.next == focus-edge.last(),
      "queue-state focus-edge must name an existing next link",
    )
  }
  if focus-node != none {
    require(focus-node in node-ids, "queue-state focus-node refers to an unknown node")
  }
  if focus-pointer != none {
    require(
      focus-pointer in pointers.map(pointer => pointer.id),
      "queue-state focus-pointer refers to an unknown pointer",
    )
  }

  (
    kind: "queue-state",
    id: id,
    nodes: nodes,
    order: order,
    pointers: pointers,
    title: title,
    transition: transition,
    focus-edge: focus-edge,
    focus-node: focus-node,
    focus-pointer: focus-pointer,
    focus-label: focus-label,
  )
}

#let node-by-id(state, id) = find-by-id("queue node", state.nodes, id)

#let queue-text-lines(state) = {
  let lines = ()
  for node-id in state.order {
    let node = node-by-id(state, node-id)
    let target = if node.next == none { [NULL] } else { node.next }
    let sentinel = if node.sentinel { [ · dummy] } else { [] }
    lines.push([#node.id: value=#node.value · next=#target · #node.state#sentinel])
  }
  for pointer in state.pointers {
    let count = if pointer.count == none { [] } else { [,#pointer.count] }
    lines.push([#pointer.scope #pointer.label<#pointer.target#count>])
  }
  lines
}
