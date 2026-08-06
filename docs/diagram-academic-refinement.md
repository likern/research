# Scientific Diagram Language v0.2 — Academic Renderer Refinement

This document defines the first implementation pass for improving research diagrams.

## Scope

The refinement starts with two diagram families:

- MVCC version-chain and snapshot visibility
- Linearizability history and proof witness

The semantic model remains independent from renderer layout.

## Rendering contract

```text
semantic model
      |
      v
semantic IR
      |
 +----+----+
 |         |
 v         v
SVG      Typst/CeTZ
```

The renderer must not encode domain meaning only through geometry or colour.

## Semantic primitives

The academic renderer introduces explicit concepts:

- reference edge — object identity or pointer relation
- temporal edge — ordering in a chain or timeline
- marker — a significant event such as a linearization point
- evaluation — a decision process such as MVCC visibility
- witness — an explanatory proof artefact
- precedence relation — real-time ordering constraints

## MVCC goals

The renderer must distinguish:

- row head reference
- version nodes
- visibility evaluation
- temporal ordering
- version state

A snapshot is an evaluation context, not a pointer to a version.

## Linearizability goals

The renderer must distinguish:

- invocation and response intervals
- linearization points
- timeline ordering
- real-time precedence
- legal sequential witness

The generated review artifacts are the primary design review surface.
