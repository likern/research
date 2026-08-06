# Scientific Diagram Language v0.2 — Academic Renderer Refinement

## Status

Accepted after visual review and merged in PR #17.

The v0.2 milestone established the first production academic visual language for
shared Pinega/YDMP semantic diagrams. The follow-up v0.2.1 consolidation keeps
the accepted rendering unchanged while closing temporary documentation,
workflow, naming, and prototype boundaries.

## Accepted scope

The refinement covered two primary diagram families:

- MVCC version-chain and snapshot visibility;
- Linearizability history and proof witness.

The buffer-frame lifecycle remained in the review corpus as a third-family
consistency check.

## Rendering contract

```text
canonical semantic model
          |
          v
schema + domain validation
          |
   +------+------+
   |             |
   v             v
Web SVG       Typst/CeTZ
```

The semantic model remains independent from renderer layout. Domain meaning may
not be encoded only through geometry or colour.

## Accepted semantic distinctions

The academic renderers distinguish:

- reference edge — object identity or pointer relation;
- temporal edge — ordering in a chain or timeline;
- marker — a significant event such as a linearization point;
- evaluation — a decision context such as MVCC visibility;
- witness — a proof-oriented explanatory artefact;
- precedence relation — a real-time ordering constraint.

These are semantic roles expressed by the canonical family-specific models and
normalized renderer-side records. They do not define a second canonical schema.

## MVCC result

The accepted renderer distinguishes:

- the row-head reference;
- version nodes;
- newest-to-oldest temporal ordering;
- version lifecycle state;
- snapshot visibility evaluation;
- selected and rejected versions.

A snapshot is an evaluation context, not a pointer to a version.

## Linearizability result

The accepted renderer distinguishes:

- invocation and response endpoints;
- operation intervals;
- linearization-point markers;
- the real-time axis;
- real-time precedence relations;
- quiescent boundaries where present;
- the legal sequential witness.

The witness is presented as a proof artefact rather than a minor footer label.

## Review and validation

The accepted result was reviewed through generated GitHub Actions artifacts,
not only through the code diff. The corpus includes Web SVG/PNG/PDF output,
Typst PDF/PNG output, canonical JSON models, textual fallbacks, and checksum
metadata.

Regression coverage includes deterministic layout, committed visual baselines,
accessibility, keyboard navigation, responsive overflow, dark mode, forced
colours, monochrome print, and pinned Typst compilation.

## Closure

The v0.2 visual-language milestone is closed. Further work should either:

1. improve authoring and lifecycle tooling without changing accepted semantics;
2. adopt the language in real research documents; or
3. introduce a deliberately versioned model-family/schema extension.
