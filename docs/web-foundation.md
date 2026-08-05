# Pinega Web architecture

## Status

Version: `0.2`

The `0.1` gate established canonical cross-platform tokens, the Web Awesome
integration boundary, the component laboratory, five representative Pinega
compositions, and executable quality gates.

Version `0.2` adds the first public information architecture:

```text
/                         product homepage
/docs/                    documentation landing
/docs/getting-started/    first documentation article
/research/                research programme
/component-lab/           design-system validation surface
```

The public pages remain research-stage communications. They explicitly
separate available artefacts, validated design contracts, research hypotheses,
and planned engine work.

## Principles

1. Native HTML owns document semantics and durable content.
2. CSS owns presentation, layout, responsive adaptation, and visual state.
3. JavaScript owns domain state, lifecycle, and interaction orchestration.
4. Web Awesome supplies generic interaction primitives, not Pinega semantics.
5. Pinega custom elements wrap only stable domain concepts or intentional
   vendor isolation boundaries.
6. Licensed Pro components progressively enhance complete semantic fallbacks.
7. Canonical Pinega tokens generate CSS, TypeScript, and Typst adapters.
8. Product maturity is expressed with text and structure, never colour alone.
9. Public claims distinguish implemented, validated, proposed, and planned work.

## Layers

```text
@layer vendor,
       pinega.tokens,
       pinega.base,
       pinega.layout,
       pinega.webawesome,
       pinega.components,
       pinega.utilities,
       pinega.overrides;
```

Web Awesome retains its internal layers inside `vendor`. The Pinega adapter
maps canonical tokens after vendor defaults, and component styling remains
above that adapter.

## Page and build model

The site is a static multi-page build. Source HTML is not generated from a
client-side framework and is useful before Custom Elements register.

`web/scripts/build.mjs`:

- bundles the shared CSS and JavaScript entrypoint;
- copies each explicit page to a clean directory route;
- injects the private Web Awesome project boundary when configured;
- emits canonical URLs from `PINEGA_SITE_ORIGIN`;
- generates `robots.txt`, `sitemap.xml`, and `site-manifest.json`;
- copies Web Awesome assets and static Pinega assets.

`web/scripts/serve.mjs` resolves directory indexes, rejects path traversal,
supports `GET` and `HEAD`, and returns the generated not-found page with HTTP
status 404.

## Component decision rule

```text
native element
    when HTML already owns the semantics and behavior

direct wa-* element
    for a stable generic interaction primitive

Pinega composition
    when multiple generic primitives form a stable product pattern

Pinega custom element
    for domain semantics, lifecycle, or vendor API isolation
```

`pinega-doc-search` follows this rule: documentation cards are durable HTML;
the Custom Element adds filtering and an aria-live result count without
constructing or replacing the cards.

## Pro boundary

The licensed project is deployment configuration, not public source. No Pro
assets or project credentials are committed. `pinega-benchmark` always retains
an accessible HTML table. It renders a native SVG chart first and upgrades to
Web Awesome Pro only after `wa-line-chart` is registered.

## Gate exit criteria

- generated token artifacts are deterministic and current;
- no purchased project URL or license material is present in the repository;
- TypeScript passes strict checking;
- all public routes and the component laboratory build from the pinned dependency set;
- local links, canonical metadata, sitemap entries, and 404 handling are validated;
- semantic and keyboard browser tests pass in Chromium, Firefox, and WebKit;
- serious and critical axe violations are absent on every public route;
- mobile and desktop layouts have no horizontal overflow;
- committed screenshots protect the homepage, docs, research, component lab,
  and representative dark-mode compositions;
- public pages remain meaningful without the Pro project and without client-side content generation.
