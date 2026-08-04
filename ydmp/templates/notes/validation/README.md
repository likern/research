# Strata long-form validation corpus

This directory contains **visual-validation fixtures**, not new canonical study
artifacts. They exercise the shared switchable Typst renderer with
`variant=candidate-strata`.

## Why this corpus exists

The short `thoughts-example.typ` preview is useful for API smoke testing, but it
is too small to judge a long-form research system. Strata is therefore tested
against sustained documents containing:

- dense prose over many pages;
- formal notation and operation histories;
- code and text blocks;
- learner-authored annotations;
- verbatim answers and assessment records;
- evidence-scope vocabulary;
- MODEL hierarchy;
- VERIFY corrections and unresolved queues;
- print headers, footers, page numbers, and navigation rhythm.

No HTML artifact is part of this gate. The earlier standalone HTML prototypes
were visually invalid, and the repository already keeps Typst HTML export
disabled. This validation is deliberately PDF-only.

## Registered fixtures

| File | Role | Canonical source |
|---|---|---|
| `strata-linearizability-notes.typ` | Ten-page guided-reading notes, compiled with and without learner annotations | Herlihy-Wing guided-reading/content-test material |
| `strata-session-berenson.typ` | Long append-only recall session snapshot with verbatim learner answers | `study/sessions/closed-book-recall-001.md` |
| `strata-model-berenson.typ` | Canonical MODEL snapshot | `study/model.md` |
| `strata-verify-berenson.typ` | VERIFY ledger snapshot | `study/verification.md` |

The three Berenson snapshots record the SHA-256 of their canonical Markdown
source both in source comments and in `../registry.yaml`. They are intentionally
not generated at build time: the workspace remains Nushell + Typst only and does
not add Pandoc as a required tool.

## Build

Build all registered artifacts through the workspace:

```bash
nu research.nu check --keep
```

Build one fixture:

```bash
nu research.nu build document strata-validation-model
```

Direct Typst examples:

```bash
typst compile \
  --root . \
  --input variant=candidate-strata \
  ydmp/templates/notes/validation/strata-model-berenson.typ \
  model.pdf

typst compile \
  --root . \
  --input variant=candidate-strata \
  --input show-thoughts=false \
  ydmp/templates/notes/validation/strata-linearizability-notes.typ \
  notes-clean.pdf
```

## Acceptance criteria

A Strata revision is acceptable only when:

1. all original Candidate A-D previews still compile;
2. Candidate C remains the default;
3. annotated and clean long notes both compile and clean output contains no
   reserved annotation gaps;
4. the session, MODEL, and VERIFY fixtures compile with the exact pinned Typst
   version;
5. PDF renders show no clipped text, overlaps, missing glyphs, or unreadable
   tables;
6. source provenance remains visible in the body, not only in page headers;
7. Strata-specific decoration does not overwhelm code, formulas, or evidence
   labels;
8. no HTML result is claimed or evaluated.

## Update policy

When a canonical Markdown source changes, refresh its Typst snapshot in a
dedicated change and update the recorded SHA-256. A changed hash without a
refreshed snapshot is a validation failure. Snapshot updates must not rewrite
the canonical Markdown merely to improve layout.
