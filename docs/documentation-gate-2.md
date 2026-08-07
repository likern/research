# Pinega Web Gate 2 — Documentation Reorganisation and Review

Status: **CURRENT IMPLEMENTATION — PR review**  
Date: 2026-08-07  
Accepted baseline: `main@b4e897e0056202ef1df083358d21e1bb9389fbfc` (merged Web IA Foundation, PR #21)

## Purpose

Gate 2 converts the documentation landing from a curated map of anchors into a
real corpus of purpose-specific pages. It deliberately does **not** implement the
blog, paper/PDF publishing, Typst-to-HTML publishing, or site-wide full-text
search. Those later gates need stable routes and metadata first.

## Accepted inputs

This implementation follows the accepted `docs/web-content-audit.md` Gate 2
requirements:

- split the mixed Getting Started article by purpose;
- establish Start / How-to / Concepts / Reference / Contributing hierarchy;
- add visible page provenance and update metadata;
- generate documentation cards from the content registry;
- derive documentation navigation and breadcrumbs consistently;
- create search-readiness metadata without prematurely adding full-text search.

## External design criteria

The external criteria are constraints, not templates copied mechanically.

- Diátaxis distinguishes tutorials, how-to guides, reference, and explanation by
  the user's need. It also explicitly notes that complex documentation does not
  have to expose exactly four top-level divisions; product/topic/user hierarchy
  may be layered around those content purposes. <https://diataxis.fr/start-here/>
  <https://diataxis.fr/complex-hierarchies/>
- W3C's breadcrumb pattern models the trail as a labelled navigation landmark
  containing the hierarchy of parent pages. <https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/>
- W3C guidance for navigation landmarks requires distinct labels when multiple
  navigation regions serve different purposes. <https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/navigation.html>

## Documentation architecture

Gate 2 publishes only sections that contain substantive pages:

```text
/docs/
├── getting-started/                         orientation router
├── start/
│   ├── project-overview/
│   └── research-workspace/                 tutorial
├── how-to/
│   ├── build-the-site/
│   └── run-validation/
├── concepts/
│   ├── pinega-programme/
│   ├── pinega-engine-architecture/
│   ├── maturity-and-evidence-labels/
│   └── research-to-product-workflow/
├── reference/
│   ├── repository-layout/
│   ├── web-build-and-environment/
│   └── content-metadata-schema/
└── contributing/
    └── review-and-release-gates/
```

The schema reserves `tutorials` for later use, but no empty `/docs/tutorials/`
landing is published just to complete a taxonomy.

## Decomposition of the old Getting Started article

| Old responsibility | Gate 2 owner |
|---|---|
| programme boundary + current status | `/docs/start/project-overview/` |
| research workspace commands | `/docs/start/research-workspace/` |
| Web build/serve procedure | `/docs/how-to/build-the-site/` |
| validation procedure | `/docs/how-to/run-validation/` |
| Pinega/Pinega Labs/Pinega Engine model | `/docs/concepts/pinega-programme/` |
| Engine architecture + WAL boundary | `/docs/concepts/pinega-engine-architecture/` |
| evidence/maturity semantics | `/docs/concepts/maturity-and-evidence-labels/` |
| research → verification → implementation → measurement | `/docs/concepts/research-to-product-workflow/` |
| repository directory lookup | `/docs/reference/repository-layout/` |
| exact Web scripts/environment | `/docs/reference/web-build-and-environment/` |
| content/discovery metadata contract | `/docs/reference/content-metadata-schema/` |
| PR/CI/visual review discipline | `/docs/contributing/review-and-release-gates/` |

`/docs/getting-started/` remains as a short durable orientation page so existing
links keep a meaningful target without continuing to mix all purposes.

## Content registry v2

Every documentation route has:

```text
documentation.section
documentation.purpose
documentation.order
documentation.applies_to
documentation.related
```

The body remains native semantic HTML. Build-time generation owns only repeated
navigation/discovery surfaces:

- grouped cards on `/docs/`;
- documentation side navigation;
- breadcrumb hierarchy;
- visible provenance block;
- related-content links;
- `content/documentation-manifest.json`;
- documentation metadata in `site-manifest.json`.

This avoids two manually maintained route/catalogue systems while preserving the
accepted Native HTML → semantics/content, CSS → presentation, JavaScript →
behaviour/lifecycle boundary.

## UX decisions

### Topic filter remains a filter

`pinega-doc-search` still performs progressive client-side filtering rather than
full-text search. Gate 2 improves its corpus and semantics:

- all cards correspond to real documentation routes;
- card metadata comes from the registry;
- groups with no matching cards collapse during enhancement;
- status reports pages rather than topics;
- all cards remain visible in server/static HTML when JavaScript is absent.

Full-text indexing stays in a later gate after docs, blog, and paper content
share a stable publishing/discovery contract.

### No fake version selector

The disabled documentation-version `<select>` is removed. Nested pages show a
plain `Documentation stage / Research-stage corpus` label instead. A version
control should appear only when multiple maintained versions are real.

### Provenance is visible

Every nested documentation page exposes purpose, maturity, applicability,
updated date, owner/programme, registry ID, source/edit links, and declared
related content.

## Visual review surface

The Gate 2 visual corpus covers:

- the documentation landing hero, content model, and complete grouped catalogue;
- Getting Started as an orientation page;
- Project Overview with generated side navigation and breadcrumbs;
- Pinega Engine architecture header and provenance block;
- the validation how-to composition;
- existing Gate 1 homepage, Technology, Research, About, and dark-mode surfaces.

Baseline candidates are generated only when the visual change is intentional;
the normal Web gate verifies committed baselines without rewriting them.

## Review and acceptance criteria

Gate 2 is ready only when:

- every registered documentation card points to a real canonical page;
- the mixed Getting Started content has clear owners by purpose;
- no nested docs page contains a disabled pseudo-version selector;
- docs navigation, breadcrumbs, cards, provenance, sitemap, and manifests derive
  from the same registry contract;
- the topic filter remains meaningful with JavaScript disabled and does not
  claim full-text search;
- route/fragment, metadata, heading, browser, accessibility, and visual gates
  pass on the final PR head;
- generated website/visual artifacts are available for review;
- Gate 1 master-brand and Scientific Diagram Language contracts remain intact.

Until those checks are green on the current PR head, this document remains
**CURRENT IMPLEMENTATION — PR review**, not an accepted baseline.
