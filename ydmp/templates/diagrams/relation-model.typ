// Semantic node-edge relation model used by the typed-dsa adapter.
//
// The model owns graph identity and reference validation. Layout and drawing
// remain replaceable, and note sources never construct typed-dsa dictionaries.

#import "common.typ": require, require-non-empty, require-unique

#let relation-node(id, label, position: none, tone: "primary", note: none) = (
  id: id,
  label: label,
  position: position,
  tone: tone,
  note: note,
)

#let relation-edge(
  from,
  to,
  label: none,
  tone: "primary",
  pattern: "normal",
) = (
  from: from,
  to: to,
  label: label,
  tone: tone,
  pattern: pattern,
)

#let relation-graph(
  nodes,
  edges,
  directed: true,
  layout: "manual",
  layout-options: (:),
  title: none,
) = {
  require-non-empty("relation-graph nodes", nodes)
  require-unique("relation-graph node ids", nodes.map(node => node.id))
  require(
    layout in ("manual", "auto", "linear", "force", "layered"),
    "relation-graph: unsupported layout " + repr(layout),
  )

  let ids = nodes.map(node => node.id)
  let edge-identities = ()
  for edge in edges {
    require(edge.from in ids, "relation-graph: unknown source " + repr(edge.from))
    require(edge.to in ids, "relation-graph: unknown target " + repr(edge.to))
    require(edge.from != edge.to, "relation-graph: reflexive edges are not supported by this adapter")
    require(
      edge.pattern in ("normal", "solid", "dashed", "dotted", "wavy"),
      "relation-graph: unsupported edge pattern " + repr(edge.pattern),
    )
    edge-identities.push((edge.from, edge.to))
  }
  require-unique("relation-graph edge identities", edge-identities)

  if layout == "manual" {
    for node in nodes {
      require(
        type(node.position) == array and node.position.len() == 2,
        "relation-graph manual layout requires a position for " + repr(node.id),
      )
      require(
        node.position.all(component => type(component) in (int, float)),
        "relation-graph position must contain numeric coordinates for " + repr(node.id),
      )
    }
  }

  (
    kind: "relation-graph",
    nodes: nodes,
    edges: edges,
    directed: directed,
    layout: layout,
    layout-options: layout-options,
    title: title,
  )
}

#let relation-text-lines(graph) = {
  let lines = ()
  for edge in graph.edges {
    let label = if edge.label == none { [] } else { [ · #edge.label] }
    lines.push([#edge.from #sym.arrow.r #edge.to#label])
  }
  lines
}
