# Pinega Website and Strata Web System

This directory contains Pinega's production-oriented static Web platform. It
uses semantic HTML, modern CSS, native Custom Elements, and Web Awesome as the
generic interaction kernel. Pinega Strata remains the canonical design system.

## Public information architecture

The public site presents Pinega as an umbrella database-systems research and
engineering programme. Pinega Engine is the first active implementation
programme beneath that master brand.

```text
/                                           master-brand homepage
/technology/                                technology programmes and maturity boundaries
/research/                                  research-area catalogue and active studies
/docs/                                      documentation corpus and topic filter
/docs/getting-started/                      orientation router
/docs/start/project-overview/               programme/status orientation
/docs/start/research-workspace/              first-run research tutorial
/docs/how-to/build-the-site/                 Web build procedure
/docs/how-to/run-validation/                 Web validation procedure
/docs/concepts/*                             programme, architecture, evidence, workflow explanations
/docs/reference/*                            repository, environment, and metadata reference
/docs/contributing/review-and-release-gates/ contributor/review contract
/about/                                     Pinega / Pinega Labs identity and principles
/component-lab/                             internal design-system validation surface
/404.html                                   explicit not-found page
```

`/component-lab/` remains buildable and testable but is excluded from primary
public navigation, the sitemap, and future site search.

## Documentation Gate 2

Gate 2 decomposes the former all-in-one Getting Started article into a real
purpose-specific corpus. The hierarchy currently publishes:

```text
Start
How-to
Concepts
Reference
Contributing
```

The content schema also reserves `tutorials`; no empty Tutorials destination is
published until there is enough substantive tutorial content to justify it.

Documentation purpose and evidence maturity are independent. A how-to may be
`available` because its commands run today, while an architecture explanation
may be a `validated` design contract without claiming a production engine
implementation.

Every nested documentation page exposes generated:

- documentation side navigation with `aria-current`;
- hierarchical breadcrumbs;
- purpose and evidence maturity;
- applicable programme/workspace/version scope;
- last-updated and owner metadata;
- registry identity and source/edit links;
- declared related content.

The disabled pseudo-version selector from the earlier foundation has been
removed. A real version switcher should appear only when multiple maintained
versions exist.

## Content and route contract

`content/content-index.json` is the versioned route and discovery registry. Gate
2 uses schema version 2 and adds per-documentation-page metadata:

```text
documentation.section
documentation.purpose
documentation.order
documentation.applies_to
documentation.related
```

Native HTML under `pages/` remains the durable semantic article body. The build
checks that each page agrees with the registry on title, description,
`data-page`, canonical URL policy, one `h1`, and public navigation.

For documentation, build-time generation owns repeated discovery/navigation
chrome rather than prose:

```text
content/content-index.json
        ↓ validation
registered native HTML pages
        ↓ static build
cards + docs navigation + breadcrumbs + provenance
        ↓
site-manifest.json + content/documentation-manifest.json + sitemap
```

`content/documentation-manifest.json` is the current search-readiness projection
for the docs corpus. It exposes stable metadata that later Blog, paper/PDF, and
site-wide-search gates can consume without adding a second manually maintained
route catalogue.

## Topic filter versus search

`pinega-doc-search` is intentionally a progressive metadata/topic filter, not a
full-text search engine. `/docs/` contains real canonical documentation cards in
static HTML before JavaScript runs. Enhancement performs Unicode-normalised AND
matching and hides groups with no matching pages.

Site-wide full-text search remains a later gate, after documentation, blog, and
paper content share a stable publishing/discovery model.

## Working brand line

The current master-brand line is:

```text
Correctness under concurrency.
```

It describes the programme's technical centre of gravity. It does not claim
that every proposed Pinega technology is already implemented, verified, or
commercially available.

## Web architecture

```text
canonical Pinega tokens
        ↓
Pinega CSS + Web Awesome theme adapter
        ↓
semantic Pinega components
        ↓
registered static pages and documentation compositions
```

Web Awesome is intentionally not the canonical design system. Vendor tokens are
mapped from `design/tokens/strata.tokens.json`; research roles such as
`confirmed`, `inferred`, and `hypothesis` remain Pinega domain semantics.

Native HTML owns content and document semantics. CSS owns presentation,
responsive adaptation, and visual state. JavaScript owns lifecycle and
interaction enhancement. Public pages remain meaningful before Custom Elements
register and without the licensed Web Awesome Pro project.

## Shared semantic diagrams

Canonical renderer-independent models live under `design/diagrams/models/`.
The build creates a temporary Node-only renderer bundle, validates and lays out
each model, and replaces explicit `PINEGA_DIAGRAM` placeholders with complete
accessible inline SVG figures.

The temporary renderer is deleted before the build completes. Generated figures
retain captions, direct SVG titles/descriptions, keyboard-reachable viewports,
text transcripts, layout-profile identity, and links to canonical JSON. The
Documentation Gate 2 milestone adds no new diagram family or promoted layout
profile.

## Run locally with Nushell

```nu
cd web
^npm ci --ignore-scripts
^npm run build
^npm run check:build
^npm run serve
```

Then open:

```nu
start 'http://127.0.0.1:4173'
```

For browser validation on RHEL, use the Playwright image matching the committed
Web dependency (`1.62.1` at this milestone):

```nu
^podman run --rm --network host -v $"(pwd):/work" -w /work/web \
  mcr.microsoft.com/playwright:v1.62.1-noble npm run test:browser
```

## Deployment origin

Canonical URLs, `robots.txt`, and `sitemap.xml` are generated from
`PINEGA_SITE_ORIGIN`. The default is the reserved validation origin
`https://pinega.example`; deployment must provide the real public origin.

```nu
with-env { PINEGA_SITE_ORIGIN: 'https://www.example.com' } {
  ^npm run build
}
```

## Cloudflare commit previews

Pull requests are prepared for preview-only Cloudflare Pages Direct Upload.
GitHub Actions builds `web/dist` once, validates that exact directory, embeds
`/.well-known/pinega-deployment.json`, archives it deterministically, records
SHA-256, attests the archive, deploys it without a second checkout or build, and
then tests the immutable HTTPS URL.

The live path is controlled by `CLOUDFLARE_PREVIEW_ENABLED` and remains disabled
until the GitHub Environment is configured. Production deployment is not part
of this workflow. The complete delivery, trust-boundary, configuration, and
retention contract is documented in
[`docs/web-delivery-gate-1.md`](../docs/web-delivery-gate-1.md).

## Purchased Web Awesome Pro project

The public repository contains no project URL, license key, kit code, or Pro
asset. To activate the purchased project locally or in deployment, provide the
private module URL at build time. Every public page retains a complete
accessible fallback without Pro.

```nu
with-env {
  PINEGA_WEB_AWESOME_PROJECT_URL: 'https://…'
  PINEGA_SITE_ORIGIN: 'https://www.example.com'
} {
  ^npm run build
}
```

## Implemented compositions

- `pinega-site-header`: light-DOM semantic header/navigation enhancement;
- `pinega-hero`: responsive programme or technology narrative;
- `pinega-evidence`: YDMP provenance semantics with explicit text labels;
- `pinega-code-example`: native code plus isolated copy enhancement;
- `pinega-benchmark`: canonical table, native SVG fallback, optional Pro chart;
- `pinega-doc-search`: progressive filtering over registry-generated real docs
  cards; it is not site-wide full-text search;
- build-time documentation navigation/breadcrumb/provenance projections;
- build-time semantic diagrams: histories, version chains, and lifecycles with
  accessible SVG and textual projections.

## Validation

```nu
^npm run tokens:check
^npm run typecheck
^npm run test:unit
^npm run build
^npm run check:build
^npm run test:browser
^npm run test:visual
```

Tests cover registered routes and fragments, content-registry v2 contracts,
master-brand and maturity claims, public navigation, component-lab isolation,
documentation decomposition and generated discovery surfaces, no-JavaScript
catalogue completeness, browser behaviour, keyboard interaction, accessibility,
responsive overflow, and committed visual baselines.
