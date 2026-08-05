# Pinega Web Foundation v0.1

This directory is the first production implementation gate for the Pinega
Strata web design system. It uses semantic HTML, modern CSS, native Custom
Elements, and Web Awesome as the generic interaction kernel.

## Architectural boundary

```text
canonical Pinega tokens
        ↓
Pinega CSS + Web Awesome theme adapter
        ↓
semantic Pinega components
        ↓
website and documentation compositions
```

Web Awesome is intentionally not the canonical design system. Vendor tokens are
mapped from `design/tokens/strata.tokens.json`; research roles such as
`confirmed`, `inferred`, and `hypothesis` remain Pinega domain semantics.

## Run locally

```bash
cd web
npm install
npm run build
npm run serve
```

Then open `http://127.0.0.1:4173`.

## Purchased Web Awesome Pro project

The public repository contains no project URL, license key, kit code, or Pro
asset. To activate the purchased project locally or in deployment, provide:

```bash
PINEGA_WEB_AWESOME_PROJECT_URL='https://…' npm run build
```

The URL is injected as a `<meta name="webawesome-project-url">` configuration
value. At runtime Pinega loads the project instead of importing duplicate Core
components. `pinega-benchmark` then upgrades its semantic table and native SVG
fallback to `<wa-line-chart>` when the Pro component becomes available.

Without Pro, the page remains complete, readable, and testable.

## Implemented compositions

- `pinega-site-header`: light-DOM semantic header/navigation enhancement;
- `pinega-hero`: responsive marketing composition;
- `pinega-evidence`: YDMP provenance semantics with explicit text labels;
- `pinega-code-example`: native code plus isolated Web Awesome Copy Button;
- `pinega-benchmark`: canonical table, native SVG fallback, optional Pro chart.

## Validation

```bash
npm run tokens:check
npm run typecheck
npm run test:unit
npm run build
npx playwright install chromium firefox webkit
npm run test:browser
npm run test:visual
```

The browser suite covers desktop and mobile Chromium, Firefox, and WebKit,
semantic landmarks, keyboard behavior, theme switching, progressive Pro
upgrade, horizontal overflow, and automated accessibility. Chromium screenshots
provide the initial visual-regression contract.
