# Pinega Web localization policy

This policy governs authored locale variants in `web/pages/<locale>/` and the
localized metadata in `content-index.json`. It complements schema v3: the
schema establishes whether a variant is structurally publishable, while this
policy establishes whether its language and technical meaning are ready for
publication.

## Publication gate

A locale variant is published only when all of the following are true:

- the complete article body, metadata, navigation labels, captions, table
  headings, text alternatives, and diagram transcript have been localized;
- technical review confirms that maturity and evidence boundaries have not
  changed in translation;
- linguistic review confirms natural professional language and consistent
  terminology;
- `reviewed_revision` equals the logical entry `revision`;
- the locale route passes build, link, browser, accessibility, and visual
  validation.

An incomplete variant is omitted from the registry. Pinega does not publish a
placeholder, inherit English prose into a Russian page, or translate article
content in client-side JavaScript.

## Russian editorial rules

- Prefer natural Russian technical prose over word-for-word translation.
- Preserve the distinction among available artefacts, validated design
  contracts, research, accepted decisions, experiments, proposals, and plans.
- Keep product and project names such as Pinega, Pinega Labs, Pinega Engine,
  PostgreSQL, YDMP, Pinega Strata, and Scientific Diagram Language unchanged.
- Keep API names, identifiers, commands, code, file paths, standards, and
  protocol acronyms unchanged. Use `<code>` where the source is executable or
  identifier-like.
- Mark a genuine English phrase or passage with `lang="en"`. Proper names,
  technical terms, and code do not require language switching merely because
  they use Latin characters.
- Use Russian quotation marks and punctuation in prose. Preserve mathematical
  and programming notation exactly.
- Localize visible diagram labels, captions, accessibility descriptions, and
  transcript prose without changing the canonical topology, identifiers,
  values, ordering, states, or evidence semantics.

## Brand line

`Correctness under concurrency.` is the working Pinega brand line. It remains
in English in every locale and is marked `lang="en" translate="no"`. Russian
prose may explain its meaning, but must not silently replace the brand line
with another slogan.

## Review record

Gate 3B records both reviews in the pull request:

1. **Technical review** checks PostgreSQL/versioning/concurrency terminology,
   architecture decisions, maturity labels, commands, links, and diagram
   semantics against the current English source and accepted Pinega baseline.
2. **Linguistic review** checks Russian grammar, terminology, navigation,
   metadata, summaries, headings, and the absence of accidental English prose.

Future changes to an English logical entry increment `revision`. Every locale
variant must then be reviewed against the new revision before it can remain
published.

## Standards basis

- W3C WCAG 2.2, Language of Parts:
  <https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html>
- W3C Internationalization Tag Set 2.0, translation and localization QA:
  <https://www.w3.org/TR/its20/>
- Google Search Central, localized page variants and reciprocal `hreflang`:
  <https://developers.google.com/search/docs/specialty/international/localized-versions>
