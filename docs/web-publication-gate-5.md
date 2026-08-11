# Pinega Web Gate 5 — Research publication integration

Gate 5.1 status: **IMPLEMENTATION UNDER REVIEW**.

## Decision

Gate 5.1 introduces the first deployable research-publication vertical slice.
One target-neutral Typst source is the canonical article body. The build
projects that source into two intentionally different reading contracts:

- semantic, responsive HTML inside the existing Pinega static site shell;
- an exact A4 PDF with paged typography and running furniture.

The projections preserve the same claims, headings, mathematics, table, code,
citations, footnote, evidence states, bibliography, and shared scientific
diagram. They do not promise pixel-equivalent layout.

Typst 0.15.1 HTML export is experimental. Pinega therefore keeps global HTML
compilation disabled and permits it only for documents whose
`publication_profile` is explicitly allowlisted as `dual-target`. This is a
narrow compiler adapter, not a general Typst-to-Web conversion service. See
the official Typst [HTML reference](https://typst.app/docs/reference/html/)
and [target reference](https://typst.app/docs/reference/foundations/target/).

## Deployable routes

| Locale | Catalogue | Responsive reader | Exact PDF |
|---|---|---|---|
| English | `/research/publications/` | `/research/publications/dual-target-contract/` | `/research/publications/dual-target-contract/paper.pdf` |
| Russian | `/ru/research/publications/` | `/ru/research/publications/dual-target-contract/` | `/ru/research/publications/dual-target-contract/paper.pdf` |

Every HTML route is a complete static document. JavaScript may enhance
same-document navigation and the semantic-diagram inspector, but it does not
create or recover the article body. Each PDF is an ordinary stable URL in the
same exact release inventory as the HTML reader.

## Registry and build ownership

The contract is a closed one-to-one join:

```text
web/content/content-index.json (schema v4)
  publication profile + localized document ID + public route
                         │
                         ▼
research.toml (schema v1)
  allowlisted profile + locale + Typst source + [html, pdf]
                         │
                         ▼
Typst 0.15.1, one job, SOURCE_DATE_EPOCH=0
        ┌────────────────┴────────────────┐
        ▼                                 ▼
standalone experimental HTML          exact paged PDF
        │                                 │
        ▼                                 │
validated inert <article>                 │
        └───────────────┬─────────────────┘
                        ▼
Pinega static build + release manifest + commit preview
```

The build fails if a localized Web route references an unknown document, if
the profile or locale differs, if either output format is absent, if an
allowlisted document has no Web route, or if arbitrary Typst HTML has been
enabled globally.

## HTML adapter boundary

Typst currently emits standalone HTML rather than a fragment. Pinega parses
that document and accepts exactly one publication `<article>`. The adapter:

- verifies language, publication identity, profile, locale, and exact title;
- verifies the compiler-emitted MathML support rules against the checked-in
  0.15.1 adapter stylesheet;
- moves Typst endnotes into the article reading boundary;
- rejects scripts, forms, embedded documents, event handlers, unsafe URL
  schemes, unexpected inline style, and duplicate IDs;
- requires the Gate 5.1 specimen surface: MathML, semantic table, code block,
  bibliography, endnote, and one shared diagram placeholder;
- replaces the diagram placeholder with the same validated JSON-backed Pinega
  SVG/transcript projection used by the Research landing.

The Pinega shell continues to own route metadata, canonical and `hreflang`
links, primary navigation, language selection, theme, focus, and enhanced
navigation. Pinega Strata CSS owns reflow, dark mode, forced-colour behaviour,
prose measure, and local overflow for wide mathematics, code, and tables.

## Reproducibility and release evidence

The exact versions remain in `.nushell-version` and `.typst-version`. Website
CI reads those files, installs pinned actions by commit SHA, runs
`nu research.nu doctor`, builds the complete site twice, and rejects any byte
difference. The exact artifact is then tested, archived, attested, uploaded to
Cloudflare Pages, and compared byte-for-byte over HTTPS for both HTML readers
and both PDFs.

`content/publications-manifest.json` records the compiler policy, Strata token
source digest, localized source identity, article digest, and PDF bytes and
SHA-256. `site-manifest.json` schema v9 joins those artifacts back to their Web
routes. `/.well-known/pinega-release.json` remains the authoritative complete
deployment inventory.

Run the local acceptance path from the repository root:

```nu
nu research.nu doctor
nu research.nu check
cd web
^npm ci --ignore-scripts
^npm run test
```

## Gate 5.1 acceptance boundary

Gate 5.1 includes one bilingual specimen, catalogue and reader routes,
responsive light/dark presentation, direct/no-JavaScript delivery,
direct-versus-enhanced semantic equivalence, accessibility scans, visual
baselines, deterministic compiler output, exact PDF release inventory, and
commit-preview verification.

It deliberately excludes arbitrary Typst documents, a full publication
catalogue generator, exact-layout Web islands, embedded PDF.js, site-wide
search, citation graphs, and migration of the existing YDMP corpus. Those
remain separate later Gate 5 changes.
