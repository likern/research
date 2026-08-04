// Semantic model and validation for concurrent-operation histories.
//
// A history records only observable operations, lane identity, timing,
// optional linearization evidence, semantic cuts, and sequential witnesses.
// It contains no drawing coordinates.

#import "common.typ": (
  require, require-number, require-non-empty, require-unique,
  find-by-id, ordered-pairs,
)

#let history-lane(id, label: auto) = (
  id: id,
  label: if label == auto { id } else { label },
)

#let history-operation(
  id,
  lane,
  call,
  start,
  end: none,
  result: none,
  linearization: none,
  tone: "primary",
  object: none,
  note: none,
) = (
  id: id,
  lane: lane,
  call: call,
  start: start,
  end: end,
  result: result,
  linearization: linearization,
  tone: tone,
  object: object,
  note: note,
)

#let history-marker(time, label, tone: "muted", pattern: "dashed") = (
  time: time,
  label: label,
  tone: tone,
  pattern: pattern,
)

#let history-witness(label, operations, tone: "inferred") = (
  label: label,
  operations: operations,
  tone: tone,
)

#let history-precedence(from, to, label: none, tone: "primary") = (
  from: from,
  to: to,
  label: label,
  tone: tone,
)

#let _min-number(values) = {
  let result = values.first()
  for value in values.slice(1) {
    if value < result { result = value }
  }
  result
}

#let _max-number(values) = {
  let result = values.first()
  for value in values.slice(1) {
    if value > result { result = value }
  }
  result
}

#let _linearization-bounds(operation) = {
  if operation.linearization == none {
    return none
  }
  if type(operation.linearization) in (int, float) {
    return (operation.linearization, operation.linearization)
  }
  require(
    type(operation.linearization) == array and operation.linearization.len() == 2,
    "history operation " + repr(operation.id) + ": linearization must be a number, a (start, end) interval, or none",
  )
  require-number(
    "history operation " + repr(operation.id) + " linearization start",
    operation.linearization.first(),
  )
  require-number(
    "history operation " + repr(operation.id) + " linearization end",
    operation.linearization.last(),
  )
  require(
    operation.linearization.first() <= operation.linearization.last(),
    "history operation " + repr(operation.id) + ": reversed linearization interval",
  )
  operation.linearization
}

#let _validate-operation(operation, lanes) = {
  let _ = find-by-id("history operation lane", lanes, operation.lane)
  require-number("history operation " + repr(operation.id) + " start", operation.start)
  if operation.end != none {
    require-number("history operation " + repr(operation.id) + " end", operation.end)
    require(
      operation.end > operation.start,
      "history operation " + repr(operation.id) + ": response must follow invocation",
    )
  }

  let bounds = _linearization-bounds(operation)
  if bounds != none {
    require(
      bounds.first() >= operation.start,
      "history operation " + repr(operation.id) + ": linearization precedes invocation",
    )
    if operation.end != none {
      require(
        bounds.last() <= operation.end,
        "history operation " + repr(operation.id) + ": linearization follows response",
      )
    }
  }
}

#let _validate-well-formed-lanes(operations) = {
  for (left, right) in ordered-pairs(operations) {
    if left.lane != right.lane { continue }
    let earlier = if left.start <= right.start { left } else { right }
    let later = if left.start <= right.start { right } else { left }
    require(
      earlier.end != none and earlier.end <= later.start,
      "history lane " + repr(left.lane) + ": operations " + repr(left.id) + " and " + repr(right.id) + " overlap",
    )
  }
}

#let history-model(
  lanes,
  operations,
  markers: (),
  witnesses: (),
  precedence: (),
  title: none,
  horizon: auto,
) = {
  require-non-empty("history-model lanes", lanes)
  require-non-empty("history-model operations", operations)
  require-unique("history-model lane ids", lanes.map(lane => lane.id))
  require-unique("history-model operation ids", operations.map(operation => operation.id))

  let times = ()
  for operation in operations {
    _validate-operation(operation, lanes)
    times.push(operation.start)
    if operation.end != none { times.push(operation.end) }
    let bounds = _linearization-bounds(operation)
    if bounds != none {
      times.push(bounds.first())
      times.push(bounds.last())
    }
  }
  _validate-well-formed-lanes(operations)

  for marker in markers {
    require-number("history marker time", marker.time)
    require(
      marker.pattern in ("solid", "dashed", "dotted"),
      "history marker pattern must be solid, dashed, or dotted",
    )
    times.push(marker.time)
  }

  let operation-ids = operations.map(operation => operation.id)
  for witness in witnesses {
    require-non-empty("history witness operations", witness.operations)
    require-unique("history witness operation ids", witness.operations)
    for operation-id in witness.operations {
      require(
        operation-id in operation-ids,
        "history witness " + repr(witness.label) + ": unknown operation " + repr(operation-id),
      )
    }
  }

  for edge in precedence {
    require(edge.from in operation-ids, "history precedence: unknown source " + repr(edge.from))
    require(edge.to in operation-ids, "history precedence: unknown target " + repr(edge.to))
    require(edge.from != edge.to, "history precedence cannot be reflexive")
  }

  let first-time = _min-number(times)
  let last-time = _max-number(times)
  let actual-horizon = if horizon == auto { last-time + 0.65 } else { horizon }
  require-number("history-model horizon", actual-horizon)
  require(actual-horizon >= last-time, "history-model horizon does not cover every event")

  (
    kind: "history-model",
    lanes: lanes,
    operations: operations,
    markers: markers,
    witnesses: witnesses,
    precedence: precedence,
    title: title,
    start: calc.min(0, first-time),
    horizon: actual-horizon,
  )
}

#let operation-by-id(history, id) = find-by-id(
  "history operation",
  history.operations,
  id,
)

#let history-text-lines(history) = {
  let lines = ()
  for lane in history.lanes {
    let lane-operations = history.operations
      .filter(operation => operation.lane == lane.id)
      .sorted(key: operation => operation.start)
    let rendered = lane-operations.map(operation => {
      let response = if operation.end == none {
        [pending]
      } else if operation.result == none {
        [ok]
      } else {
        operation.result
      }
      [#operation.call #sym.arrow.r #response]
    })
    lines.push([#lane.label: #rendered.join([  ·  ])])
  }
  lines
}
