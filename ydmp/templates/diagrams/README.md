# Semantic concurrency diagrams

This directory implements the first vector-diagram gate for the Strata design
system. It targets concurrent-algorithm explanations rather than generic
freehand drawing.

## Module boundaries

```text
common.typ           validation and identity lookup primitives
history-model.typ    concurrent-history records and well-formedness invariants
queue-model.typ      linked queue state, pointer, and lifetime invariants
relation-model.typ   generic node-edge relation model
theme.typ            Strata screen and print design tokens
primitives.typ       shared CeTZ geometry and accessible figure wrappers
history.typ          deterministic history layout and textual projection
queue.typ            generic linked-queue layout and textual projection
memory.typ           Michael–Scott queue semantic state sequences
dsa.typ              narrow typed-dsa 0.6.0 adapter
chapter3.typ         original Strata reconstructions of TAOMP Chapter 3 examples
specimens/           registered PDF compilation gates
```

The architecture is deliberately one-way:

```text
semantic constructors
        ↓
domain validation
        ↓
deterministic layout
        ↓
vector renderer + textual projection + alternative description
```

A note supplies operation intervals, node links, shared pointers, local
observations, and order constraints—not low-level coordinates. Identity is
separate from display labels: operations, nodes, pointers, and relation vertices
have stable IDs while renderers remain free to localize or restyle their labels.

## Dependency boundary

Custom concurrency renderers pin CeTZ explicitly:

```typst
#import "@preview/cetz:0.5.2"
```

Classic sequential structures and generic relation graphs are accessed only
through `dsa.typ`, which pins:

```typst
#import "@preview/typed-dsa:0.6.0" as dsa
```

This keeps package API churn, Strata styling, and future localization outside
individual research notes. `typed-dsa` is not used to imitate transient
concurrent states: Michael–Scott pointer lag, local observations, publication,
helping, retirement, and reclamation boundaries remain YDMP-owned semantics.

## Implemented gate

The registered specimen exercises:

- concurrent histories with completed and pending operations;
- point and interval linearization evidence;
- sequential witnesses and explicit precedence edges;
- Michael–Scott enqueue publication, Tail lag/helping, dequeue linearization,
  and retirement without premature reclamation;
- a conventional sequential queue through the typed-dsa adapter;
- original Strata reconstructions of the principal examples from Chapter 3 of
  *The Art of Multiprocessor Programming*;
- an explicit textual projection and a monochrome print rendering.

```bash
nu research.nu build document strata-diagram-implementation-gate
nu research.nu check
```

The gate compiles PDF only. HTML remains disabled until the paged research
workspace has a separately validated HTML renderer.
