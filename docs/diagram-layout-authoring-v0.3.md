# Scientific Diagram Language v0.3 — Layout and Authoring Separation

## Status

Draft visual-review implementation. The architecture is implemented; the three
new candidate profiles are not production defaults until their generated
artifacts are reviewed and accepted.

## Objective

Version 0.2 established correct semantic distinctions and deterministic Web and
Typst renderers. Version 0.3 makes those diagrams usable as an evolving visual
framework rather than treating the first renderings as final pictures.

The change separates five responsibilities:

```text
semantic truth
  → layout profile
    → deterministic scene plan
      → production renderer
      → layered authoring SVG
```

## Non-goals

- no semantic `schemaVersion` migration;
- no raster-to-vector conversion;
- no automatic acceptance of aesthetically different layouts;
- no silent refresh of committed production snapshots;
- no claim of lossless arbitrary SVG-to-model round trip.

## Profile candidates

### Linearizability history

`proof-oriented-v0.3` keeps time on the horizontal axis and processes on stable
lanes. It routes real-time precedence above the operation field, uses a thinner
operation rail, promotes the LP to a compact tick, and presents the legal
sequential witness as a proof sequence rather than a panel.

### Version chain

`compact-records-v0.3` gives the stable row head its own reference slot and
renders versions as compact records. Newest-to-oldest links remain the dominant
axis; snapshot visibility remains a separate evaluation rail.

### Buffer-frame lifecycle

`horizontal-return-v0.3` turns the lifecycle into one continuous horizontal
trajectory. The reuse transition is an outer return path. State identity,
transition labels, and guards remain independent editable objects.

## Manual editing contract

The authoring SVG is suitable for Inkscape-style editing because it contains:

- five named layers;
- stable semantic group IDs;
- live text;
- vector primitives only;
- embedded styling;
- no scripts or remote references;
- provenance metadata and a profile identity.

The expected workflow is:

```text
canonical model + candidate profile
              ↓
       generated authoring SVG
              ↓
        visual review / manual study
              ↓
  changes returned to profile or renderer
```

A manually edited SVG may also be retained as a curated deliverable, but it must
not replace the model as the source of scientific meaning.

## Artifact acceptance checklist

Review the immutable GitHub Actions artifact rather than the code diff alone.
For each profile compare:

- semantic correctness;
- hierarchy and readability;
- arrow routing and label collisions;
- editability of logical groups;
- text remaining as text;
- absence of raster content;
- production and candidate differences;
- Web, print, and Typst consistency;
- manifest, metadata, and checksum completeness.

The artifact contains one profile-comparison PDF plus individual SVG, scene JSON,
metadata JSON, and PNG files. Production visual baselines must remain unchanged
in this PR.

## Promotion rule

After visual review, a selected candidate may become the family default in a
follow-up PR. That promotion must update both Web and Typst renderers as needed,
refresh visual baselines deliberately, regenerate review artifacts, and record a
new changelog entry. Rejected candidates may remain as named alternatives or be
removed explicitly.
