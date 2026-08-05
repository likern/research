// Small validation and lookup primitives shared by semantic diagram models.
//
// Domain modules validate identities and invariants before layout begins. This
// keeps renderer code focused on geometry and turns malformed figures into
// precise compile-time diagnostics rather than partially rendered diagrams.

#let require(condition, message) = {
  if not condition { panic(message) }
}

#let require-number(where, value) = {
  require(
    type(value) in (int, float),
    where + ": expected a number, got " + repr(value),
  )
}

#let require-non-empty(where, values) = {
  require(
    type(values) == array and values.len() > 0,
    where + ": expected a non-empty array",
  )
}

#let require-unique(where, values) = {
  let seen = (:)
  for value in values {
    let key = repr(value)
    require(
      key not in seen,
      where + ": duplicate value " + key,
    )
    seen.insert(key, true)
  }
}

#let find-by-id(where, values, id) = {
  for value in values {
    if value.id == id { return value }
  }
  panic(where + ": unknown id " + repr(id))
}

#let contains-id(values, id) = {
  for value in values {
    if value.id == id { return true }
  }
  false
}

#let ordered-pairs(values) = {
  let pairs = ()
  for left-index in range(values.len()) {
    for right-index in range(left-index + 1, values.len()) {
      pairs.push((values.at(left-index), values.at(right-index)))
    }
  }
  pairs
}
