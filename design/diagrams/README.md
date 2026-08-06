# Pinega semantic diagram models

This directory is the renderer-independent source of truth for technical
diagrams shared by the Pinega website and the Typst/CeTZ publication system.

```text
versioned JSON model
        ↓ validation
normalized semantic model
        ↓ deterministic layout
        ├── accessible inline SVG + textual transcript
        └── Typst/CeTZ vector figure + Typst alt text
```

The JSON files contain domain facts only. They do not contain pixels, CSS
classes, Typst lengths, fonts, colours, or renderer-specific coordinates.

## Schema

`schema/diagram.schema.json` describes the versioned discriminated union. The
current schema version is `1` and supports:

- `history` — concurrent operation intervals, linearization evidence,
  precedence, and sequential witnesses;
- `version-chain` — newest-to-oldest row versions, transaction metadata, and a
  snapshot-selected version;
- `lifecycle` — named states and guarded transitions for a concurrent object.

The TypeScript validator enforces cross-reference and temporal invariants that
JSON Schema cannot express conveniently. The Typst adapter repeats the
renderer-critical invariants so a malformed model cannot silently produce a
publication figure.

## Accessibility contract

The web renderer emits inline SVG with a direct-child `<title>` and `<desc>`,
`role="img"`, a stable `aria-labelledby` relationship, visible `figcaption`, and
a generated textual representation. Colour is never the only carrier of state.

The Typst renderer uses the same model title, caption, description, and generated
text representation for figure metadata and fallback content.

## Adding a model

1. choose a stable kebab-case `id`;
2. validate it through `npm run test:unit` in `web/`;
3. add a `<!-- PINEGA_DIAGRAM:<id> -->` placeholder to a source page when the
   model should appear on the website;
4. load the same file through `shared-model.typ` when it should appear in Typst;
5. run both the web and research gates.

Generated SVG is build output and is never committed as the canonical model.
