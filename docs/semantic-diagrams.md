# Shared semantic diagram architecture

## Status

System version: `0.3.0`

The first academic visual-language iteration was accepted and merged in PR #17.
Version 0.3 separates semantic authorship, layout selection, renderer scene
planning, production output, and manually editable SVG working copies:

```text
design/diagrams/models/*.json          canonical semantic model
                  +
design/diagrams/layouts/profiles.json  presentation profile
                  ↓
       schema + domain/profile validation
                  ↓
        renderer-side scene plan
                  ↓
        ├── web: build-time inline SVG + HTML transcript
        ├── authoring: layered standalone SVG + scene JSON
        └── Typst: semantic adapter + CeTZ + text fallback
```

The canonical models are versioned JSON records. They own identity, domain
facts, captions, long descriptions, and relationships. They do not own layout
coordinates, CSS classes, SVG paths, Typst content, fonts, or colours.

The subsystem, model, and presentation contracts are deliberately separate:

- `design/diagrams/VERSION` versions the complete authoring/rendering system;
- `schemaVersion` inside each JSON model versions the canonical data contract;
- `profileSchemaVersion` versions layout-profile configuration.

A renderer, workflow, or visual-language refinement can therefore advance the
system version without forcing a model migration.

## Canonical and implementation boundaries

The only canonical source is `design/diagrams/models/*.json`, validated against
`design/diagrams/schema/diagram.schema.json` plus domain invariants.

Layout profiles are versioned presentation configuration. They select a
family-specific strategy and renderer metrics, but they are not a second schema
or authoring format. Renderer-side scene JSON and authoring SVG are derived
artefacts.

Production renderers live in:

- `web/src/diagrams/` for build-time SVG/HTML output and authoring SVG export;
- `ydmp/templates/diagrams/` for Typst/CeTZ output.

TypeScript and Typst may construct normalized records internally, but those
records are derived implementation details, not a second schema or authoring
format.

## Layout-profile lifecycle

Each family has exactly one accepted default and one or more candidates:

```text
production profile ── used by website / committed visual baselines
candidate profile  ── exported only for authoring review
                         ↓ visual approval
                    deliberate promotion PR
```

Version 0.3 intentionally keeps `production-v0.2` as the default for all three
families. This means architectural separation and new review surfaces can be
validated without silently replacing accepted website or publication figures.
Candidate promotion must be a separate reviewed change.

## Supported model families

### Concurrent history

A history records lanes, invocation/response intervals, pending operations,
point or interval linearization evidence, markers, real-time precedence, and
sequential witnesses.

The accepted academic renderer gives separate visual roles to:

- the real-time axis;
- invocation and response endpoints;
- operation intervals;
- linearization-point markers;
- real-time precedence relations;
- the legal sequential witness.

The v0.3 candidate moves precedence routing outside operation lanes, reduces the
weight of interval rails, replaces halo-style LP emphasis with a proof-oriented
tick, and removes the card-like witness panel.

### Version chain

A version chain records a stable row-head reference, newest-to-oldest versions,
transaction metadata, generation identity, lifecycle state, and the version
selected by a named snapshot.

The row head is rendered as a reference rather than another version object. A
snapshot is rendered as a visibility-evaluation context rather than a pointer
to the selected version.

The v0.3 candidate uses a separate row-head slot and compact record cells rather
than equal-size UI cards while retaining the independent visibility-evaluation
rail.

### Lifecycle

A lifecycle records named states and guarded transitions. The current shared
model covers buffer-frame publication, eviction, retirement, quiescence,
reclamation, and reuse.

The v0.3 candidate renders the primary lifecycle as a horizontal trajectory of
state stops and gives reuse a separate outer return path. The guarded
`retired → reclaimable` transition remains a first-class safety boundary.

## Web pipeline

The website build bundles `web/src/diagrams/index.ts` as a temporary Node-only
renderer. It validates every model, resolves the accepted default layout,
generates complete `<figure>` markup with inline SVG, injects the figure into
explicit HTML placeholders, copies the canonical model/profile sources to
`dist/diagrams/`, and then deletes the temporary renderer bundle.

The renderer is not shipped in the browser bundle. Public pages contain the
finished semantic figure before client-side JavaScript executes.

Each web figure contains:

- an SVG `viewBox` and deterministic scene geometry;
- the resolved layout-profile identity;
- explicit `role="img"` and `aria-labelledby`;
- direct-child `<title>` and `<desc>` elements;
- a visible `<figcaption>`;
- a keyboard-reachable horizontally scrollable viewport;
- a generated textual transcript;
- a download link to the canonical JSON model.

The visual subtree is hidden from the accessibility tree because the atomic
image name, long description, caption, and transcript already expose the same
meaning without forcing assistive technologies through hundreds of geometric
nodes.

## Authoring SVG pipeline

For each model/profile pair, the review workflow exports:

- a standalone SVG with embedded Strata styling;
- a renderer-side scene plan in JSON;
- provenance metadata;
- a PNG preview;
- an HTML/PDF comparison surface.

The SVG retains live text, semantic groups, and the following stable Inkscape
layers:

```text
background → relations → objects → annotations → proof
```

Groups carry stable `id`, `data-semantic-id`, and `data-diagram-role`
attributes. The root identifies the layout profile and authoring format. No
scripts, remote assets, or raster images are emitted.

A generated authoring SVG is intentionally marked `canonical=false`. Manual
changes may be used to explore or curate a final figure, but semantic changes
must be reflected in the canonical model. A later round-trip importer may turn
selected geometry changes into explicit layout overrides; v0.3 does not pretend
that arbitrary SVG edits can already be losslessly translated back.

## Typst pipeline

`ydmp/templates/diagrams/shared-model.typ` loads the same JSON files. It adapts
them into validated Typst semantic records and dispatches to the history,
version-chain, and lifecycle renderers.

The registered `strata-shared-semantic-diagram-gate` document compiles all three
models, their text projections, and a monochrome print projection. Version 0.3
keeps the accepted production CeTZ layouts unchanged while the new candidates
are reviewed through the layered authoring SVG artifact. Candidate promotion to
Typst is deliberately deferred until visual selection.

## Validation and review artifacts

The web gate checks model graph invariants, profile catalogue invariants,
deterministic rendering, escaping, accessible names, transcripts, browser
behaviour, axe results, dark mode, forced colours, committed production visual
baselines, copied model endpoints, and build budgets.

The research gate compiles the same JSON records with the pinned Typst version.
A change to a canonical model, layout profile, renderer, or authoring exporter
triggers the corresponding web, research, and review workflows.

The permanent review workflow produces an immutable GitHub Actions artifact
containing:

- canonical models and schema;
- layout profiles and profile documentation;
- Web production SVG, PNG, HTML, and PDF review surfaces;
- layered authoring SVG for every model/profile pair;
- scene plans, provenance metadata, and an authoring manifest;
- candidate PNG previews and a comparison HTML/PDF;
- Typst PDF and PNG review surfaces;
- portable checksums and build metadata.

The workflow records the uploaded artifact ID, URL, and digest in the job
summary. The artifact name remains revision- and attempt-specific.

## Extension rule

A new renderer may consume the canonical JSON or normalized semantic records,
but it may not add renderer coordinates to the canonical models. New domain
facts require a deliberate schema revision; presentation remains a layout
profile and renderer responsibility.
