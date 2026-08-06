// Renderer-independent state-transition model for concurrent object lifecycles.

#import "common.typ": (
  require, require-non-empty, require-unique, find-by-id,
)

#let lifecycle-state(id, label, description, tone) = (
  id: id,
  label: label,
  description: description,
  tone: tone,
)

#let lifecycle-transition(id, from, to, label, guard, tone) = (
  id: id,
  from: from,
  to: to,
  label: label,
  guard: guard,
  tone: tone,
)

#let lifecycle-model(
  id,
  title,
  caption,
  description,
  subject,
  initial,
  states,
  transitions,
) = {
  require(type(id) == str and id.len() > 0, "lifecycle-model: missing id")
  require(type(title) == str and title.len() > 0, "lifecycle-model: missing title")
  require(type(caption) == str and caption.len() > 0, "lifecycle-model: missing caption")
  require(type(description) == str and description.len() > 0, "lifecycle-model: missing description")
  require-non-empty("lifecycle-model states", states)
  require-non-empty("lifecycle-model transitions", transitions)
  require-unique("lifecycle-model state ids", states.map(state => state.id))
  require-unique("lifecycle-model transition ids", transitions.map(transition => transition.id))
  let _ = find-by-id("lifecycle-model initial state", states, initial)

  for transition in transitions {
    let _ = find-by-id("lifecycle-model transition source", states, transition.from)
    let _ = find-by-id("lifecycle-model transition target", states, transition.to)
    require(transition.from != transition.to, "lifecycle-model: transitions must change state")
  }

  let reachable = (initial,)
  for _ in range(states.len()) {
    for transition in transitions {
      if transition.from in reachable and transition.to not in reachable {
        reachable.push(transition.to)
      }
    }
  }
  for state in states {
    require(state.id in reachable, "lifecycle-model: unreachable state " + repr(state.id))
  }

  (
    kind: "lifecycle-model",
    id: id,
    title: title,
    caption: caption,
    description: description,
    subject: subject,
    initial: initial,
    states: states,
    transitions: transitions,
  )
}

#let state-by-id(model, id) = find-by-id("lifecycle state", model.states, id)

#let lifecycle-text-lines(model) = {
  let initial = state-by-id(model, model.initial)
  let lines = (
    [#model.title],
    [initial: #initial.label],
  )
  for transition in model.transitions {
    let from = state-by-id(model, transition.from)
    let to = state-by-id(model, transition.to)
    lines.push([
      #from.label --#transition.label#if transition.guard != none { [ [#transition.guard]] }→ #to.label
    ])
  }
  lines
}
