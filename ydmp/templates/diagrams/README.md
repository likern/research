# Semantic concurrency diagrams

This directory implements the Strata vector-diagram system for concurrent and
versioned database-system explanations.

## Module boundaries

```text
common.typ                 validation and identity lookup primitives
history-model.typ          concurrent-history records and invariants
version-chain-model.typ    row-version-chain records and invariants
lifecycle-model.typ        state-transition records and reachability checks
queue-model.typ            linked queue state, pointer, and lifetime invariants
relation-model.typ         generic node-edge relation model
theme.typ                  Strata screen and print design tokens
primitives.typ             shared CeTZ geometry and figure wrappers
history.typ                deterministic history layout and text projection
version-chain.typ          deterministic version-chain layout and text projection
lifecycle.typ              deterministic lifecycle layout and text projection
queue.typ                  generic linked-queue layout and text projection
memory.typ                 Michael–Scott queue semantic state sequences
shared-model.typ           adapter from canonical JSON to Typst models/renderers
dsa.typ                    narrow typed-dsa 0.6.0 adapter
chapter3.typ               original Strata reconstructions of TAOMP Chapter 3
specimens/                 registered PDF compilation gates
```

The architecture is deliberately one-way:

```text
semantic records
        ↓
domain validation
        ↓
deterministic layout
        ↓
vector renderer + textual projection + alternative description
```

## Cross-platform model boundary

Canonical shared models live in `design/diagrams/models/`. They contain stable
identity, domain facts, captions, and descriptions but no renderer coordinates.
`shared-model.typ` loads the same JSON files used by the website build and
converts them to the existing Typst semantic model layer.

The first shared gate covers:

- a linearizability history with overlap, real-time precedence, and a witness;
- a newest-to-oldest row-version chain selected by a snapshot;
- a buffer-frame publication, retirement, and reclamation lifecycle.

This is not a promise that every Typst-specific note model must be JSON. Shared
JSON is used when an artefact must be rendered consistently across web and
publication environments; local one-off figures may remain native Typst models.

## Dependency boundary

Custom renderers pin CeTZ explicitly:

```typst
#import "@preview/cetz:0.5.2"
```

Classic sequential structures and generic relation graphs are accessed only
through `dsa.typ`, which pins typed-dsa. `typed-dsa` is not used to imitate
transient concurrent states: pointer lag, local observations, publication,
helping, retirement, and reclamation remain YDMP-owned semantics.

## Gates

```nu
^nu research.nu build document strata-diagram-implementation-gate
^nu research.nu build document strata-shared-semantic-diagram-gate
^nu research.nu check
```

Both gates compile PDF. HTML remains disabled until the paged research workspace
has a separately validated HTML renderer.
