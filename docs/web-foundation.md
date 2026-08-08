# Pinega Web architecture

## Status

Version: `0.4`

Version 0.1 established canonical cross-platform tokens, the Web Awesome
integration boundary, the component laboratory, representative Pinega
compositions, and executable quality gates. Version 0.2 introduced the first
public multi-page site. Version 0.3 implemented the accepted Information
Architecture Foundation: Pinega as master programme, Pinega Engine as the first
active implementation programme, substantive Technology/About surfaces, and a
versioned route/discovery registry.

Version 0.4 implements **Gate 2 — Documentation Reorganisation and Review**:

- the former mixed Getting Started article is decomposed by user purpose;
- the public docs corpus contains real Start/Tutorial, How-to, Concepts,
  Reference, and Contributing pages;
- content-registry schema v2 owns documentation hierarchy and discovery
  metadata while native HTML remains the durable article-body source;
- the docs landing catalogue, side navigation, breadcrumbs, provenance, related
  content, and search-readiness manifest are generated from that contract;
- the topic control remains a progressive filter and does not claim full-text
  search;
- the fake disabled version selector is removed;
- Blog, paper/PDF integration, Typst-to-HTML publication, and site-wide search
  remain later gates;
- Scientific Diagram Language families and accepted layouts remain unchanged.

Delivery Gate 1 is a separate infrastructure contract rather than a public-site
information-architecture version. It adds build-once/test/deploy-exact-artifact
Cloudflare Pages commit previews, deployment provenance, artifact attestation,
GitHub `View deployment`, and remote HTTPS/browser verification. Production
delivery remains out of scope. See `docs/web-delivery-gate-1.md`.

The working master-brand line remains:

```text
Correctness under concurrency.
```

## Public hierarchy

```text
Pinega / Pinega Labs          programme and organisation boundary
        ↓
Technology programmes        what may become maintained software
        ↓
Pinega Engine                 first active implementation programme

Research                      questions, evidence, models, and experiments
Documentation                 task- and understanding-oriented technical corpus
About                         identity, principles, and commercial boundary
```

Current documentation routes:

```text
/docs/
├── getting-started/
├── start/
│   ├── project-overview/
│   └── research-workspace/
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

The schema reserves Tutorials as a first-class section but does not publish an
empty destination. The blog likewise remains absent until a real content model
and route exist.

## Content contract

`web/content/content-index.json` is the only route and public-discovery
registry. Schema v2 records the Gate 1 page metadata plus documentation-specific
fields:

```text
id, route, source/output paths, content type, titles, summary, audience,
programme, research area, topics, maturity, dates, authors, sitemap,
searchability, structured-data intent, public/canonical status

documentation.section
documentation.purpose
documentation.order
documentation.applies_to
documentation.related
```

Page bodies remain native semantic HTML. The build validates agreement between
registry and source pages, then derives repeated navigation/discovery surfaces.
For nested documentation it generates:

- documentation side navigation with `aria-current`;
- hierarchical breadcrumbs;
- visible provenance: purpose, maturity, applicability, update date, owner,
  registry ID, source/edit links;
- related-content links declared by stable registry ID.

The build also emits `content/documentation-manifest.json`, a documentation-only
metadata projection designed for later search/publishing consumers.

## Principles

1. Native HTML owns document semantics and durable article content.
2. CSS owns presentation, layout, responsive adaptation, and visual state.
3. JavaScript owns lifecycle and interaction enhancement.
4. Build-time generation may own repeated navigation/discovery chrome when the
   canonical facts already live in the content registry.
5. Web Awesome supplies generic interaction primitives, not Pinega semantics.
6. Pinega custom elements wrap only stable domain concepts or intentional
   vendor-isolation boundaries.
7. Licensed Pro components progressively enhance complete semantic fallbacks.
8. Canonical Pinega tokens generate CSS, TypeScript, and Typst adapters.
9. Content purpose and evidence maturity are independent metadata dimensions.
10. Public claims distinguish implemented, validated, experimental, proposed,
    and planned work.
11. Public navigation follows user intent and programme ownership, not repository
    directories or internal validation surfaces.
12. A version UI is introduced only when multiple maintained versions actually
    exist.

## Page and build model

The site is a static multi-page build. Source HTML is not generated from a
client-side application framework and remains meaningful before Custom Elements
register.

`web/scripts/build.mjs`:

- validates content-registry schema v2 and cross-entry references;
- verifies title, description, page identity, canonical policy, heading count,
  and public navigation for every registered source page;
- bundles shared CSS and JavaScript;
- injects semantic diagrams and the private Web Awesome project boundary;
- injects documentation navigation, breadcrumbs, provenance, and related links;
- generates the registry-backed card catalogue on `/docs/`;
- emits clean directory routes from the registry;
- copies canonical content, diagram, and static sources needed by consumers;
- generates `robots.txt`, `sitemap.xml`, `site-manifest.json`, and
  `content/documentation-manifest.json`.

## Documentation information architecture

Gate 2 uses Diátaxis-style purpose distinctions as a design constraint, not as a
requirement to expose four literal root folders. The public hierarchy is shaped
around Pinega's current readers and corpus:

```text
Start          orientation plus the current first-run research tutorial
How-to         goal-oriented Web procedures
Concepts       explanation and architecture
Reference      exact lookup contracts
Contributing   PR, CI, visual-review, and maturity gates
```

`documentation.purpose` records whether a page behaves as start, tutorial,
how-to, explanation, reference, or contributing content. `section` records where
it belongs in Pinega's public hierarchy. Keeping these dimensions separate lets
the hierarchy evolve without changing the meaning of a page.

## Documentation UX and search boundary

`pinega-doc-search` filters registry-generated cards for real canonical pages.
The initial static HTML contains the full corpus; JavaScript enhancement performs
Unicode-normalised AND matching, updates the result count, and collapses empty
sections. The control is therefore labelled **Filter documentation topics**.

This is intentionally not full-text search. Site-wide indexing follows after
documentation, blog, and paper/PDF publishing surfaces share stable discovery
metadata. Gate 2 prepares that future consumer through
`content/documentation-manifest.json` rather than adding a search dependency
prematurely.

## Review and quality gates

Gate 2 expands executable checks for:

- registry v2 uniqueness, documentation fields, related IDs, and generated
  manifest consistency;
- all registered local routes and fragments;
- complete static docs catalogue with JavaScript absent;
- generated documentation navigation, breadcrumbs, provenance, and current-page
  state;
- absence of a disabled fake version selector;
- representative cross-browser documentation behaviour;
- complete documentation accessibility sweep in Chromium plus existing broader
  browser/accessibility coverage;
- responsive overflow and committed Chromium visual baselines;
- continued Scientific Diagram Language rendering compatibility.

A Gate 2 PR is review-ready only when those checks pass on the current head and
GitHub Actions provides the website/visual artefacts for inspection.
