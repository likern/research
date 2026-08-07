# Scientific Diagram Language changelog

This changelog tracks the complete diagram subsystem. Canonical model
compatibility is tracked separately by each model's `schemaVersion`; layout
profile compatibility is tracked by `profileSchemaVersion`.

## 0.3.0 — 2026-08-06

Layout and authoring separation without a semantic-model migration.

- introduced a versioned family-specific layout-profile catalogue;
- preserved the accepted v0.2 production layouts and committed visual baselines
  as the defaults;
- added proof-oriented history, compact record-strip version-chain, and
  horizontal lifecycle candidate profiles;
- added a renderer-side scene plan with stable semantic identities and authoring
  layers;
- added standalone, layered, raster-free authoring SVG for manual refinement in
  Inkscape-compatible editors;
- added per-profile scene JSON and provenance metadata;
- expanded immutable review artifacts with authoring SVG, PNG previews,
  comparison HTML/PDF, profile catalogue, manifest, checksums, and build
  metadata;
- exposed artifact ID, URL, and SHA-256 digest in the GitHub Actions job summary;
- kept canonical model `schemaVersion: 1` unchanged.

## 0.2.1 — 2026-08-06

Post-merge consolidation of the accepted v0.2 academic visual language.

- marked the first MVCC and Linearizability refinement iteration as accepted;
- documented one canonical authoring surface under `design/diagrams/`;
- removed superseded prototype renderers, duplicate IR schema, and temporary
  review scaffolding;
- made the GitHub Actions review workflow permanent for pull requests and
  relevant changes on `main`;
- changed the review workflow from rewriting snapshots to verifying committed
  visual baselines;
- introduced version-driven, immutable artifact names and build metadata;
- made Web and Typst review specimens consume the system version dynamically;
- added regression tests for the consolidated architecture and workflow.

## 0.2.0 — 2026-08-06

First accepted academic renderer refinement.

- separated row-head references, version chains, and snapshot visibility
  evaluation in MVCC figures;
- promoted linearization points to first-class markers;
- separated the time axis from real-time precedence relations;
- promoted legal sequential witnesses to proof-oriented blocks;
- aligned Web SVG and Typst/CeTZ output with the Strata academic design system;
- added deterministic visual-review artifacts and cross-browser validation.

## 0.1.0

Initial shared semantic-diagram architecture with renderer-independent JSON
models and Web/Typst output for history, version-chain, and lifecycle families.
