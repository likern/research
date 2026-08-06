# Pinega Scientific Diagram Language

This directory is the renderer-independent source of truth and versioned
presentation configuration for technical diagrams shared by the Pinega website
and the Typst/CeTZ publication system.

## Status and versioning

- system version: [`VERSION`](VERSION) (`0.3.0`);
- canonical JSON model schema: `schemaVersion: 1`;
- layout profile schema: `profileSchemaVersion: 1`;
- first academic visual-language iteration: accepted and merged in PR #17;
- v0.3 layout and authoring separation: candidate profiles require visual
  review before promotion.

The system version describes the maturity of the complete authoring and
rendering subsystem. Model and layout-profile schema versions are independent
compatibility contracts. A visual or workflow refinement can therefore advance
the system version without forcing a semantic model migration.

## Canonical architecture

```text
design/diagrams/models/*.json         canonical domain facts
                  +
design/diagrams/layouts/profiles.json versioned presentation profiles
                  ↓
       schema + domain/profile validation
                  ↓
         renderer-side scene plan
                  ↓
        ├── web: accessible inline SVG + HTML transcript
        ├── authoring: layered standalone SVG + scene JSON
        └── Typst/CeTZ: publication vector figure + text fallback
```

The JSON files under `models/` contain domain facts only. They do not contain
pixels, CSS classes, Typst lengths, fonts, colours, SVG paths, or renderer
coordinates. The profile catalogue is presentation configuration and is not a
second canonical semantic-IR schema.

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

The accepted academic language distinguishes semantic roles rather than
representing every fact as a generic card or arrow:

- references are distinct from temporal and precedence relations;
- linearization points are first-class event markers;
- snapshots are visibility-evaluation contexts, not pointers;
- witnesses are proof-oriented artefacts;
- primary state, secondary metadata, and explanatory annotations have separate
  visual weights;
- colour is never the sole carrier of meaning.

Layout profiles may change composition, spacing, routing, and presentation
strategy. They may not mutate these semantic distinctions.

## Authoring SVG contract

The v0.3 authoring renderer emits standalone, raster-free SVG suitable for
Inkscape and other SVG editors:

- stable semantic groups and element identifiers;
- explicit authoring layers;
- live SVG text rather than outlined glyphs;
- embedded Strata styling with no external stylesheet dependency;
- metadata identifying the semantic model, layout profile, system version, and
  non-canonical status;
- no scripts, remote assets, or raster `<image>` elements.

A generated authoring SVG is an editable working copy. The model remains the
source of domain truth. A manually curated SVG must be accompanied by metadata
that records its model and profile provenance.

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

## Adding or changing a layout profile

1. keep canonical models unchanged unless the domain meaning changed;
2. add the profile to `layouts/profiles.json`;
3. keep the existing production profile as default until visual approval;
4. implement the family strategy in the scene/layout layer;
5. inspect the authoring SVG, scene JSON, PNG, HTML, and PDF comparison surfaces
   in the immutable review artifact;
6. promote a candidate only in a deliberate follow-up change with refreshed and
   reviewed production baselines.

Generated SVG, PNG, scene JSON, and PDF files are review or build output. They
are never the canonical semantic model.
