// Renderer-independent semantic model for newest-to-oldest row-version chains.

#import "common.typ": (
  require, require-non-empty, require-unique, find-by-id,
)

#let version-node(
  id,
  label,
  payload,
  created_by,
  deleted_by,
  generation,
  state,
  note,
) = (
  id: id,
  label: label,
  payload: payload,
  created_by: created_by,
  deleted_by: deleted_by,
  generation: generation,
  state: state,
  note: note,
)

#let version-snapshot(id, label, visible_version, note) = (
  id: id,
  label: label,
  visible_version: visible_version,
  note: note,
)

#let version-chain-model(
  id,
  title,
  caption,
  description,
  subject,
  head,
  head_label,
  snapshot,
  versions,
) = {
  require(type(id) == str and id.len() > 0, "version-chain-model: missing id")
  require(type(title) == str and title.len() > 0, "version-chain-model: missing title")
  require(type(caption) == str and caption.len() > 0, "version-chain-model: missing caption")
  require(type(description) == str and description.len() > 0, "version-chain-model: missing description")
  require-non-empty("version-chain-model versions", versions)
  require-unique("version-chain-model version ids", versions.map(version => version.id))
  require(head == versions.first().id, "version-chain-model: head must name the newest first version")
  let _ = find-by-id("version-chain-model head", versions, head)
  let selected = find-by-id("version-chain-model snapshot", versions, snapshot.visible_version)
  require(
    selected.state == "visible",
    "version-chain-model: snapshot must select the version marked visible",
  )

  let allowed = ("visible", "obsolete", "retired", "uncommitted", "aborted")
  let visible_count = 0
  for version in versions {
    require(version.state in allowed, "version-chain-model: unsupported state " + repr(version.state))
    require(type(version.generation) == int and version.generation >= 0, "version-chain-model: generation must be a non-negative integer")
    if version.state == "visible" { visible_count += 1 }
  }
  require(visible_count == 1, "version-chain-model: exactly one version must be visible")

  (
    kind: "version-chain-model",
    id: id,
    title: title,
    caption: caption,
    description: description,
    subject: subject,
    head: head,
    head_label: head_label,
    snapshot: snapshot,
    versions: versions,
  )
}

#let version-by-id(model, id) = find-by-id("version-chain version", model.versions, id)

#let version-chain-text-lines(model) = {
  let lines = (
    [#model.title],
    [#model.head_label: #model.versions.map(version => version.id).join(" → ")],
  )
  for version in model.versions {
    lines.push([
      #version.label: #version.payload; xmin=#version.created_by;
      xmax=#if version.deleted_by == none { [—] } else { version.deleted_by };
      generation=#version.generation; state=#version.state
      #if version.note != none { [; #version.note] }
    ])
  }
  lines.push([
    #model.snapshot.label → #model.snapshot.visible_version: #model.snapshot.note
  ])
  lines
}
