# Pinega Web content contract

`content-index.json` is the versioned registry for public routes, internal web
surfaces, page identity, navigation, maturity, audience, discovery metadata, and
the documentation information architecture. It does not own article body
content: native HTML remains the durable semantic source for each page.

The build validates that every registered page agrees with the registry on:

- route, source, and output identity;
- document title and meta description;
- canonical URL policy;
- one visible `h1`;
- `data-page` identity;
- public-navigation destinations;
- sitemap and searchability flags;
- documentation section, purpose, order, applicability, and related-content
  references for `/docs/` routes.

The registry is intentionally useful beyond the current build. Later gates may
consume the same metadata to generate blog indexes, RSS/Atom feeds, paper
catalogues, JSON-LD, related-content links, and a static full-text search index.
Those systems must not introduce a second manually maintained route catalogue.

## Schema v2 documentation metadata

Every `/docs/` route has a `documentation` record:

```text
section      landing | start | tutorials | how-to | concepts | reference | contributing
purpose      index | start | tutorial | how-to | explanation | reference | contributing
order        stable integer ordering within the section
applies_to   visible scope/version boundary for the page
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
- `dist/content/documentation-manifest.json`, which is the search-ready docs
  projection for later publishing/search gates;
- the `documentation` field in each `site-manifest.json` route record.

The page body remains authored as semantic HTML. Build-time metadata generation
owns repeated discovery/navigation chrome, not article prose.

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
