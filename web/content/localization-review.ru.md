# Gate 3B Russian corpus review

Review date: 2026-08-08
Scope: 18 canonical public pages, the Russian 404 page, three semantic diagrams,
locale messages, metadata, discovery outputs, and documentation manifests.

This record documents two distinct authoring passes completed for the pull
request. Repository reviewers still provide the final human approval through
the normal pull-request process.

## Technical review

- Compared every Russian page with the current English logical entry and its
  `revision`; all published variants set `reviewed_revision` to that revision.
- Preserved the accepted PostgreSQL 19, extension-only Table Access Method,
  out-of-place version storage, Pinega-owned buffer pool, and single PostgreSQL
  WAL boundaries without promoting research or design contracts to released
  product claims.
- Preserved commands, paths, identifiers, API names, version numbers, numerical
  diagram facts, transition topology, tones, state identity, and witness order.
- Added build-time structural-equivalence checks between canonical and Russian
  diagram models.
- Checked internal links, reciprocal locale peers, self-canonical metadata,
  `hreflang`, sitemap/searchability flags, documentation manifests, and Russian
  primary navigation.

Result: no technical boundary, maturity label, command, link target, or diagram
fact differs from the canonical source except for intentional localization.

## Linguistic review

- Reviewed titles, descriptions, navigation, headings, body copy, tables,
  callouts, accessible names, diagram captions, transcripts, and 404 copy.
- Replaced literal calques and accidental English prose with natural Russian;
  retained product names, API names, identifiers, commands, standards, and
  established protocol acronyms according to `terminology.ru.json`.
- Preserved `Correctness under concurrency.` as the English brand line and
  marked it with `lang="en" translate="no"` wherever it appears in Russian UI.
- Verified Russian pluralization and locale-aware filtering on the documentation
  landing page.
- Reviewed representative desktop visual baselines for the Russian home page,
  documentation catalogue, research diagram, and 404 page.

Result: the published corpus contains no known untranslated English prose;
remaining English or Latin-script text is deliberate technical notation, code,
an identifier, a proper name, or the preserved brand line.

## Validation evidence

- `npm run tokens:check`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `npm run check:build`
- Chromium browser and accessibility scenarios for the Russian corpus
- Russian visual regression scenarios and committed baselines
