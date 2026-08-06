# Shared semantic diagram architecture

## Status

System version: `0.2.1`

The first academic visual-language iteration was accepted and merged in PR #17.
The current system has one renderer-independent model layer and two production
output families:

```text
design/diagrams/models/*.json
        ↓ schema + domain validation
normalized renderer-side records
        ↓ deterministic layout
        ├── web: build-time inline SVG + HTML transcript
        └── Typst: semantic adapter + CeTZ + Typst text fallback
```

The canonical models are versioned JSON records. They own identity, domain
facts, captions, long descriptions, and relationships. They do not own layout
coordinates, CSS classes, SVG paths, Typst content, fonts, or colours.

The subsystem version and the model schema version are deliberately separate:

- `design/diagrams/VERSION` versions the complete authoring/rendering system;
- `schemaVersion` inside each JSON model versions the canonical data contract.

A renderer, workflow, or visual-language refinement can therefore advance the
system version without forcing a model migration.

## Canonical and implementation boundaries

The only canonical source is `design/diagrams/models/*.json`, validated against
`design/diagrams/schema/diagram.schema.json` plus domain invariants.

Production renderers live in:

- `web/src/diagrams/` for build-time SVG/HTML output;
- `ydmp/templates/diagrams/` for Typst/CeTZ output.

TypeScript and Typst may construct normalized records internally, but those
records are derived implementation details, not a second schema or authoring
format.

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

### Version chain

A version chain records a stable row-head reference, newest-to-oldest versions,
transaction metadata, generation identity, lifecycle state, and the version
selected by a named snapshot.

The row head is rendered as a reference rather than another version object. A
snapshot is rendered as a visibility-evaluation context rather than a pointer
to the selected version.

### Lifecycle

A lifecycle records named states and guarded transitions. The current shared
model covers buffer-frame publication, eviction, retirement, quiescence,
reclamation, and reuse. It also acts as the third-family consistency check for
shared typography, edge weights, state tones, and print behaviour.

## Web pipeline

The website build bundles `web/src/diagrams/index.ts` as a temporary Node-only
renderer. It validates every model, generates complete `<figure>` markup with
inline SVG, injects the figure into explicit HTML placeholders, copies the
canonical JSON and schema to `dist/diagrams/`, and then deletes the temporary
renderer bundle.

The renderer is not shipped in the browser bundle. Public pages contain the
finished semantic figure before client-side JavaScript executes.

Each web figure contains:

- an SVG `viewBox` and deterministic scene geometry;
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

## Typst pipeline

`ydmp/templates/diagrams/shared-model.typ` loads the same JSON files. It adapts
them into validated Typst semantic records and dispatches to the history,
version-chain, and lifecycle renderers.

The registered `strata-shared-semantic-diagram-gate` document compiles all three
models, their text projections, and a monochrome print projection.

## Validation and review artifacts

The web gate checks model graph invariants, deterministic rendering, escaping,
accessible names, transcripts, browser behaviour, axe results, dark mode,
forced colours, committed visual baselines, copied model endpoints, and build
budgets.

The research gate compiles the same JSON records with the pinned Typst version.
A change to a canonical model or either renderer triggers the corresponding
web, research, and academic-review workflows.

The permanent academic-review workflow produces immutable GitHub Actions
artifacts containing:

- canonical models and schema;
- Web SVG, PNG, HTML, and PDF review surfaces;
- Typst PDF and PNG review surfaces;
- checksums and build metadata.

## Extension rule

A new renderer may consume the canonical JSON or normalized semantic records,
but it may not add renderer coordinates to the canonical models. New domain
facts require a deliberate schema revision; presentation remains a renderer
responsibility.
