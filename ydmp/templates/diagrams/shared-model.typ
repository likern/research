// Adapter from the canonical JSON semantic models to Typst/CeTZ renderers.
//
// JSON is the cross-platform interchange and identity layer. Existing Typst
// domain models remain responsible for renderer-side validation and layout.

#import "common.typ": require
#import "history.typ" as history
#import "version-chain.typ" as versions
#import "lifecycle.typ" as lifecycle
#import "theme.typ": diagram-theme
#import "primitives.typ": diagram-figure

#let _model_root = "../../../design/diagrams/models"

#let load-shared-diagram(id) = {
  require(type(id) == str and id.len() > 0, "shared diagram: missing model id")
  let source = json(_model_root + "/" + id + ".json")
  require(source.schemaVersion == 1, "shared diagram: unsupported schema version")
  require(source.id == id, "shared diagram: file id does not match requested id")
  require(source.kind in ("history", "version-chain", "lifecycle"), "shared diagram: unsupported kind " + repr(source.kind))

  let semantic = if source.kind == "history" {
    history.history-model(
      source.lanes.map(lane => history.history-lane(lane.id, label: lane.label)),
      source.operations.map(operation => history.history-operation(
        operation.id,
        operation.lane,
        operation.call,
        operation.start,
        end: operation.end,
        result: operation.result,
        linearization: operation.linearization,
        tone: operation.tone,
        object: operation.object,
        note: operation.note,
      )),
      markers: source.markers.map(marker => history.history-marker(
        marker.time,
        marker.label,
        tone: marker.tone,
        pattern: marker.pattern,
      )),
      witnesses: source.witnesses.map(witness => history.history-witness(
        witness.label,
        witness.operations,
        tone: witness.tone,
      )),
      precedence: source.precedence.map(edge => history.history-precedence(
        edge.from,
        edge.to,
        label: edge.label,
        tone: edge.tone,
      )),
      title: source.title,
      horizon: source.horizon,
    )
  } else if source.kind == "version-chain" {
    versions.version-chain-model(
      source.id,
      source.title,
      source.caption,
      source.description,
      source.subject,
      source.head,
      source.headLabel,
      versions.version-snapshot(
        source.snapshot.id,
        source.snapshot.label,
        source.snapshot.visibleVersion,
        source.snapshot.note,
      ),
      source.versions.map(version => versions.version-node(
        version.id,
        version.label,
        version.payload,
        version.createdBy,
        version.deletedBy,
        version.generation,
        version.state,
        version.note,
      )),
    )
  } else {
    lifecycle.lifecycle-model(
      source.id,
      source.title,
      source.caption,
      source.description,
      source.subject,
      source.initial,
      source.states.map(state => lifecycle.lifecycle-state(
        state.id,
        state.label,
        state.description,
        state.tone,
      )),
      source.transitions.map(transition => lifecycle.lifecycle-transition(
        transition.id,
        transition.from,
        transition.to,
        transition.label,
        transition.guard,
        transition.tone,
      )),
    )
  }

  (
    kind: source.kind,
    id: source.id,
    title: source.title,
    caption: source.caption,
    description: source.description,
    source: source,
    model: semantic,
  )
}

#let render-shared-diagram(diagram, theme: diagram-theme()) = {
  if diagram.kind == "history" {
    history.render-history-with-witnesses(diagram.model, theme: theme, scale: 1.18)
  } else if diagram.kind == "version-chain" {
    versions.render-version-chain(diagram.model, theme: theme, scale: 1.28)
  } else {
    lifecycle.render-lifecycle(diagram.model, theme: theme, scale: 1.18)
  }
}

#let shared-diagram-text(diagram, theme: diagram-theme()) = {
  if diagram.kind == "history" {
    history.history-text(diagram.model, theme: theme)
  } else if diagram.kind == "version-chain" {
    versions.version-chain-text(diagram.model, theme: theme)
  } else {
    lifecycle.lifecycle-text(diagram.model, theme: theme)
  }
}

#let shared-diagram-figure(diagram, theme: diagram-theme()) = diagram-figure(
  render-shared-diagram(diagram, theme: theme),
  diagram.caption,
  diagram.description,
)
