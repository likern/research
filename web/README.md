# Pinega Website and Strata Web System

This directory contains the production-oriented web implementation of Pinega
Strata. It uses semantic HTML, modern CSS, native Custom Elements, and Web
Awesome as the generic interaction kernel.

## Architecture

```text
canonical Pinega tokens
        ↓
Pinega CSS + Web Awesome theme adapter
        ↓
semantic Pinega components
        ↓
multi-page website and documentation compositions
```

Web Awesome is intentionally not the canonical design system. Vendor tokens are
mapped from `design/tokens/strata.tokens.json`; research roles such as
`confirmed`, `inferred`, and `hypothesis` remain Pinega domain semantics.

## Routes

The build emits a static multi-page site:

```text
/                         product homepage
/docs/                    documentation landing
/docs/getting-started/    first documentation article
/research/                research programme
/component-lab/           design-system validation surface
/404.html                 explicit not-found page
```

Source pages live under `pages/`. The component laboratory remains a separate
source under `component-lab/` so production pages do not become test-fixture
markup.

## Run locally with Nushell

```nu
cd web
^npm ci --ignore-scripts
^npm run build
^npm run serve
```

Then open:

```nu
start 'http://127.0.0.1:4173'
```

The development server resolves clean directory routes such as `/docs/` and
returns the generated `404.html` with an HTTP 404 status for unknown paths.

## Deployment origin

Canonical URLs, `robots.txt`, and `sitemap.xml` are generated from
`PINEGA_SITE_ORIGIN`. The default is the reserved validation origin
`https://pinega.example`; deployment must provide the real public origin.

```nu
with-env { PINEGA_SITE_ORIGIN: 'https://www.example.com' } {
  ^npm run build
}
```

The origin must contain only scheme and host, with no path, query, or fragment.

## Purchased Web Awesome Pro project

The public repository contains no project URL, license key, kit code, or Pro
asset. To activate the purchased project locally or in deployment, provide the
private module URL at build time:

```nu
with-env {
  PINEGA_WEB_AWESOME_PROJECT_URL: 'https://…'
  PINEGA_SITE_ORIGIN: 'https://www.example.com'
} {
  ^npm run build
}
```

The URL is injected as a `<meta name="webawesome-project-url">` value. Without
Pro, every public page remains complete, readable, and testable.

## Implemented compositions

- `pinega-site-header`: light-DOM semantic header/navigation enhancement;
- `pinega-hero`: responsive product narrative;
- `pinega-evidence`: YDMP provenance semantics with explicit text labels;
- `pinega-code-example`: native code plus isolated Web Awesome copy action;
- `pinega-benchmark`: canonical table, native SVG fallback, optional Pro chart;
- `pinega-doc-search`: progressive client-side filtering over durable docs cards.

## Validation

Native checks:

```nu
^npm run tokens:check
^npm run typecheck
^npm run test:unit
^npm run build
```

The complete browser matrix should use the version-matched Playwright container
on unsupported Linux distributions. Browser tests cover the public routes,
component laboratory, keyboard behavior, theme switching, docs search,
not-found handling, horizontal overflow, metadata, local links, and automated
accessibility. Chromium screenshots provide the visual-regression contract.
