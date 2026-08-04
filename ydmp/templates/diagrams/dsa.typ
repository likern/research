// Stable YDMP adapter around typed-dsa 0.6.0.
//
// Notes import this module rather than the Universe package directly. The
// adapter pins the dependency, maps Strata roles onto its style system, and
// exposes only structures whose semantics are genuinely sequential or
// node-edge relational.

#import "@preview/typed-dsa:0.6.0" as dsa
#import "relation-model.typ" as relation
#import "common.typ": require
#import "theme.typ": diagram-theme, tone-paint, tone-fill
#import "primitives.typ": text-fallback

#let relation-node = relation.relation-node
#let relation-edge = relation.relation-edge
#let relation-graph = relation.relation-graph

#let strata-graph-style(theme: diagram-theme(), scale: 0.72) = dsa.graph-style(
  scale: scale,
  node-shape: "rounded",
  node-radius: 0.32,
  node-fill: theme.paper,
  node-stroke: theme.edge + theme.primary,
  edge-stroke: theme.edge + theme.ink,
  edge-arrow: "end",
  edge-arrow-fill: theme.ink,
  node-text: dsa.text-style(
    font: theme.mono-font,
    size: 6.3pt,
    fill: theme.ink,
    weight: "bold",
  ),
  edge-label-text: dsa.text-style(
    font: theme.sans-font,
    size: 5.2pt,
    fill: theme.muted,
  ),
  label-text: dsa.text-style(
    font: theme.sans-font,
    size: 5.1pt,
    fill: theme.muted,
  ),
)

#let strata-queue-style(theme: diagram-theme(), scale: 0.76) = dsa.queue-style(
  scale: scale,
  box-shape: "rounded",
  box-fill: theme.paper,
  box-stroke: theme.edge + theme.primary,
  value-text: dsa.text-style(
    font: theme.mono-font,
    size: 6.6pt,
    fill: theme.ink,
    weight: "bold",
  ),
  pointer-text: dsa.text-style(
    font: theme.mono-font,
    size: 5.4pt,
    fill: theme.muted,
  ),
  label-text: dsa.text-style(
    font: theme.sans-font,
    size: 5.2pt,
    fill: theme.muted,
  ),
)

#let sequential-queue(values, theme: diagram-theme(), scale: 0.76) = {
  require(type(values) == array, "sequential-queue: values must be an array")
  dsa.queue(
    ..values,
    style: strata-queue-style(theme: theme, scale: scale),
  ).diagram
}

#let _graph-adjacency(graph) = {
  let adjacency = (:)
  for node in graph.nodes { adjacency.insert(node.id, ()) }
  for edge in graph.edges {
    let outgoing = adjacency.at(edge.from)
    let entry = if edge.label == none { edge.to } else { (edge.to, edge.label) }
    adjacency.insert(edge.from, outgoing + (entry,))
  }
  adjacency
}

#let _graph-labels(graph) = {
  let labels = (:)
  for node in graph.nodes { labels.insert(node.id, node.label) }
  labels
}

#let _graph-positions(graph) = {
  let positions = (:)
  for node in graph.nodes {
    if node.position != none { positions.insert(node.id, node.position) }
  }
  positions
}

#let _node-customizations(graph, theme) = graph.nodes.map(node => {
  let paint = tone-paint(node.tone, theme: theme)
  (
    node.id,
    (
      shape: "rounded",
      fill: tone-fill(node.tone, theme: theme),
      stroke: theme.edge + paint,
      node-radius: 0.32,
      text: (fill: theme.ink, weight: "bold"),
    ),
  )
})

#let _edge-customizations(graph, theme) = graph.edges.map(edge => {
  let paint = tone-paint(edge.tone, theme: theme)
  (
    edge.from,
    edge.to,
    (
      stroke: if edge.tone == "event" {
        theme.strong-edge + paint
      } else {
        theme.edge + paint
      },
      pattern: edge.pattern,
      arrow: if graph.directed { "end" } else { none },
      label: (fill: paint, weight: "bold"),
    ),
  )
})

#let _node-labels(graph, theme) = {
  let labels = (:)
  for node in graph.nodes {
    if node.note != none {
      labels.insert(
        node.id,
        (
          content: node.note,
          position: "bottom",
          gap: 0.18,
          fill: theme.muted,
          font: theme.sans-font,
          size: 5pt,
        ),
      )
    }
  }
  labels
}

#let render-relation-graph(graph, theme: diagram-theme(), scale: 0.72) = {
  require(graph.kind == "relation-graph", "render-relation-graph: expected relation-graph()")
  dsa.graph(
    _graph-adjacency(graph),
    directed: graph.directed,
    labels: _graph-labels(graph),
    positions: _graph-positions(graph),
    layout: graph.layout,
    layout-options: graph.layout-options,
    node-customizations: _node-customizations(graph, theme),
    edge-customizations: _edge-customizations(graph, theme),
    node-labels: _node-labels(graph, theme),
    style: strata-graph-style(theme: theme, scale: scale),
  ).diagram
}

#let relation-text(graph, theme: diagram-theme()) = {
  require(graph.kind == "relation-graph", "relation-text: expected relation-graph()")
  text-fallback(relation.relation-text-lines(graph), theme: theme)
}
