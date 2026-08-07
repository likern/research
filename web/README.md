# Pinega Website and Strata Web System

This directory contains Pinega's production-oriented static Web platform. It
uses semantic HTML, modern CSS, native Custom Elements, and Web Awesome as the
generic interaction kernel. Pinega Strata remains the canonical design system.

## Public information architecture

The public site presents Pinega as an umbrella database-systems research and
engineering programme. Pinega Engine is the first active implementation
programme beneath that master brand.

```text
/                         master-brand homepage
/technology/              technology programmes and maturity boundaries
/research/                research-area catalogue and active studies
/docs/                    documentation topics and content-type map
/docs/getting-started/    first guided contributor path
/about/                   Pinega / Pinega Labs identity and principles
/component-lab/           internal design-system validation surface
/404.html                 explicit not-found page
```

`/component-lab/` remains buildable and testable but is excluded from primary
public navigation, the sitemap, and future site search.

## Content and route contract

`content/content-index.json` is the versioned route and discovery registry. It
owns page identity, route/output mapping, navigation, title, summary, audience,
programme, topics, maturity, author/update metadata, sitemap policy,
searchability, and future structured-data intent.

Native HTML under `pages/` remains the durable semantic body content. The build
checks that each page agrees with the registry on title, description,
`data-page`, canonical URL policy, one `h1`, and public navigation.

```text
content/content-index.json
        ↓ validation
registered native HTML pages
        ↓ static build
routes + sitemap + site-manifest.json + future publishing indexes
```

The registry is designed to support later blog, paper/library, RSS, JSON-LD,
related-content, and static full-text search gates without creating another
manual route catalogue.

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
same models feed the Typst/CeTZ publication renderer.

The Web IA milestone adds no new diagram family or promoted layout profile.

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

## Deployment origin

Canonical URLs, `robots.txt`, and `sitemap.xml` are generated from
`PINEGA_SITE_ORIGIN`. The default is the reserved validation origin
`https://pinega.example`; deployment must provide the real public origin.

```nu
with-env { PINEGA_SITE_ORIGIN: 'https://www.example.com' } {
  ^npm run build
}
```

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
- `pinega-doc-search`: progressive filtering over durable documentation-topic
  cards; it is not yet site-wide full-text search;
- build-time semantic diagrams: histories, version chains, and lifecycles with
  accessible SVG and textual projections.

## Validation

```nu
^npm run tokens:check
^npm run typecheck
^npm run test:unit
^npm run build
^npm run check:build
```

The complete browser matrix should use the version-matched Playwright container
on unsupported Linux distributions. Tests cover registered routes, route and
fragment integrity, master-brand and maturity claims, public navigation,
component-lab isolation, metadata generation, documentation filtering, browser
behaviour, keyboard interaction, accessibility, responsive overflow, and
committed visual baselines.
