# Scientific diagram layout profiles

`profiles.json` is versioned presentation configuration for the Pinega
Scientific Diagram Language. It is intentionally separate from the canonical
semantic models under `../models/`.

A profile selects a family-specific layout strategy and renderer metrics without
changing domain meaning. The profile catalogue has its own
`profileSchemaVersion`; it does not change the canonical model
`schemaVersion`.

## Profile states

- `production` — the accepted default used by the website and Typst review
  gates;
- `candidate` — an alternative layout exported in the authoring review artifact
  for visual comparison before promotion.

Exactly one production profile is the default for each family. Candidate
profiles never become production merely because they render successfully.

## Current families and candidates

- history: accepted `production-v0.2` and proof-oriented
  `proof-oriented-v0.3`;
- version chain: accepted `production-v0.2` and compact record-strip
  `compact-records-v0.3`;
- lifecycle: accepted `production-v0.2` and horizontal return-arc
  `horizontal-return-v0.3`.

The accepted defaults intentionally preserve the committed v0.2 visual
baselines. The v0.3 candidates are review surfaces, not silently changed
production output.

## Authoring layers

The catalogue fixes the stable SVG authoring layer order:

1. `background`;
2. `relations`;
3. `objects`;
4. `annotations`;
5. `proof`.

The standalone authoring renderer maps these layers to Inkscape layers and emits
stable `id`, `data-semantic-id`, `data-diagram-role`, and
`data-layout-profile` attributes.

## Renderer contract

A renderer may use renderer-specific numeric metrics inside a shared profile,
but it must preserve the profile's semantic strategy and may not move those
metrics into the canonical model. A profile is presentation data, not a second
semantic schema or authoring format.
