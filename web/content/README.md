# Pinega Web content contract

`content-index.json` is the versioned logical content registry for public
routes, internal web surfaces, navigation, maturity, audience, discovery
metadata, locale variants, and the documentation information architecture. It
does not own article body content: native HTML remains the durable semantic
source for each localized page.

The build validates that every registered page agrees with the registry on:

- BCP 47 locale, route prefix, source, and output identity;
- document title and meta description;
- canonical URL policy;
- one visible `h1`;
- `data-page` identity;
- locale-specific public-navigation destinations;
- sitemap and searchability flags;
- reviewed logical revision freshness;
- documentation section, purpose, order, applicability, and related-content
  references for locale-specific documentation routes.

The registry is intentionally useful beyond the current build. Later gates may
consume the same metadata to generate blog indexes, RSS/Atom feeds, paper
catalogues, JSON-LD, related-content links, and a static full-text search index.
Those systems must not introduce a second manually maintained route catalogue.

## Schema v3 logical and localized fields

Each entry has a stable `id`, shared classification/discovery fields, a logical
`revision`, and a `locales` object. A locale variant contains all fields that
must be authored and reviewed in that language: route, source/output path,
title, summary, dates, publication flags, `reviewed_revision`, and localized
documentation applicability. Variants are either complete and publishable or
absent; there is no `fallback`, `pending`, or partially translated state.

English sources live under `pages/en/` while preserving their existing public
URLs. Russian sources live under `pages/ru/` and can only publish under `/ru/`.
The only Russian HTML committed by Gate 3A is the genuine localized 404 page;
Gate 3B will add and review the Russian content corpus.

## Documentation metadata

Every `/docs/` route has a `documentation` record:

```text
section      landing | start | tutorials | how-to | concepts | reference | contributing
purpose      index | start | tutorial | how-to | explanation | reference | contributing
order        stable integer ordering within the section
applies_to   locale-specific visible scope/version boundary
related      content IDs of real related documentation pages
```

`section` controls the documentation hierarchy. `purpose` describes what the
page is for. They are deliberately separate: a tutorial can live in the Start
section, and future hierarchies do not have to mirror the four Diátaxis kinds
mechanically.

At build time this metadata generates:

- the grouped card catalogue on `/docs/`;
- documentation side navigation with `aria-current`;
- hierarchical breadcrumbs;
- the visible provenance block on every nested docs page;
- `dist/content/<locale>/documentation-manifest.json`, the locale-specific
  search-ready docs projection for later publishing/search gates;
- the `documentation` field in each localized `site-manifest.json` variant.

The page body remains authored as semantic HTML. Build-time metadata generation
owns repeated discovery/navigation chrome, not article prose.

## Locale and discovery contract

The registry declares `en` as the default unprefixed locale and reserves `/ru/`
for Russian. The static build generates `<html lang>`/`dir`, self canonical,
`og:locale`, and `hreflang` from registered variants. A language-switcher link
is generated only for a real canonical counterpart. The development/static
server does not use `Accept-Language` redirects.

Localized UI strings live in `messages/<locale>.json`. They are limited to
shared navigation and component behaviour; article prose remains first-class
HTML and is never translated in the browser.

## Documentation provenance contract

Every nested docs page exposes visibly:

- content purpose;
- evidence/maturity status;
- applicable programme/workspace/version scope;
- last-updated date;
- owner/programme;
- registry ID;
- source and edit links;
- related documentation when declared.

A disabled version selector is intentionally not used. Version UI should be
introduced only when multiple maintained versions actually exist.

## Current public navigation

```text
Technology | Research | Documentation | About | GitHub
```

The blog is deliberately absent until a real blog route and content pipeline
exist. The component laboratory remains an internal validation route and is not
part of public navigation or the sitemap.

## Working brand line

The current homepage uses `Correctness under concurrency.` as a working Pinega
brand line. It expresses the programme's central technical concern without
claiming that every proposed technology has already been implemented or
verified.
