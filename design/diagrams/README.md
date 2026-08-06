# Pinega Scientific Diagram Language

This directory is the renderer-independent source of truth for technical
diagrams shared by the Pinega website and the Typst/CeTZ publication system.

## Status and versioning

- system version: [`VERSION`](VERSION) (`0.2.1`);
- canonical JSON model schema: `schemaVersion: 1`;
- first academic visual-language iteration: accepted and merged in PR #17.

The system version describes the maturity of the complete authoring and
rendering subsystem. `schemaVersion` is an independent compatibility contract
stored in every canonical model. A visual or workflow refinement can therefore
advance the system version without forcing a model migration.

## Canonical architecture

```text
design/diagrams/models/*.json
        ↓ schema + domain validation
normalized renderer-side records
        ↓ deterministic layout
        ├── web/src/diagrams/: accessible inline SVG + HTML transcript
        └── ydmp/templates/diagrams/: Typst/CeTZ vector figure + text fallback
```

The JSON files contain domain facts only. They do not contain pixels, CSS
classes, Typst lengths, fonts, colours, SVG paths, or renderer coordinates.
There is no second canonical semantic-IR schema: normalized TypeScript and Typst
records are implementation details derived from the same JSON source.

## Supported model families

`schema/diagram.schema.json` defines the current discriminated union:

- `history` — concurrent operation intervals, invocation and response events,
  linearization evidence, markers, real-time precedence, and sequential
  witnesses;
- `version-chain` — a stable row-head reference, newest-to-oldest row versions,
  transaction and generation metadata, lifecycle state, and snapshot visibility
  evaluation;
- `lifecycle` — named states and guarded transitions for publication, eviction,
  retirement, quiescence, reclamation, and reuse.

The TypeScript validator enforces cross-reference and temporal invariants that
JSON Schema cannot express conveniently. The Typst adapter repeats the
renderer-critical invariants so malformed input cannot silently produce a
publication figure.

## Visual-language contract

The accepted v0.2 academic language distinguishes semantic roles rather than
representing every fact as a generic card or arrow:

- references are distinct from temporal and precedence relations;
- linearization points are first-class event markers;
- snapshots are visibility-evaluation contexts, not pointers;
- witnesses are proof-oriented blocks;
- primary state, secondary metadata, and explanatory annotations have separate
  visual weights;
- colour is never the sole carrier of meaning.

## Accessibility contract

The web renderer emits inline SVG with a direct-child `<title>` and `<desc>`,
`role="img"`, a stable `aria-labelledby` relationship, a visible `figcaption`,
and a generated textual representation. The Typst renderer uses the same model
title, caption, description, and text projection for figure metadata and
fallback content.

## Adding or changing a model

1. choose a stable kebab-case `id`;
2. add or update the canonical JSON file under `models/`;
3. extend `schema/diagram.schema.json` only when a new domain fact cannot be
   represented by the current schema;
4. validate through `npm run test:unit` in `web/`;
5. add a `<!-- PINEGA_DIAGRAM:<id> -->` placeholder when the figure belongs on
   the website;
6. load the same model through `shared-model.typ` when it belongs in Typst;
7. run both the web/research gates and review the generated GitHub Actions
   artifact.

Generated SVG, PNG, and PDF files are review or build output. They are never the
canonical model.
