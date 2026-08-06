# Shared semantic diagram architecture

## Status

Version: `0.1`

The diagram system now has one renderer-independent model layer and two output
families:

```text
design/diagrams/models/*.json
        ↓
validation + deterministic layout
        ├── web: build-time inline SVG + HTML transcript
        └── Typst: semantic adapter + CeTZ + Typst text fallback
```

The canonical models are versioned JSON records. They own identity, domain
facts, captions, and long descriptions. They do not own layout coordinates,
CSS classes, SVG paths, Typst content, fonts, or colours.

## Supported model families

### Concurrent history

A history records lanes, invocation/response intervals, pending operations,
point or interval linearization evidence, markers, real-time precedence, and
sequential witnesses.

### Version chain

A version chain records a stable head, newest-to-oldest versions, transaction
metadata, generation identity, lifecycle state, and the version selected by a
named snapshot.

### Lifecycle

A lifecycle records named states and guarded transitions. The initial gate uses
it for buffer-frame publication, eviction, retirement, quiescence, and reuse.

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
them into validated Typst semantic records and dispatches to:

- the existing history renderer;
- the new version-chain renderer;
- the new lifecycle renderer.

The registered `strata-shared-semantic-diagram-gate` document compiles all three
models, their text projections, and a monochrome print projection.

## Validation

The web gate checks model graph invariants, deterministic rendering, escaping,
accessible names, transcripts, browser behaviour, axe results, dark mode,
forced colours, visual baselines, copied model endpoints, and build budgets.

The research gate compiles the same JSON records with the pinned Typst version.
A change to any shared model triggers both web and research workflows.

## Extension rule

A new renderer may consume the canonical JSON or normalized semantic records,
but it may not add renderer coordinates to the canonical models. Domain-specific
facts belong in a schema revision; presentation belongs in a renderer.
