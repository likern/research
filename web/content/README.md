# Pinega Web content contract

`content-index.json` is the versioned registry for public routes, internal web
surfaces, page identity, navigation, maturity, audience, and discovery metadata.
It does not own article body content: native HTML remains the durable semantic
source for each page.

The build validates that every registered page agrees with the registry on:

- route, source, and output identity;
- document title and meta description;
- canonical URL policy;
- one visible `h1`;
- `data-page` identity;
- public-navigation destinations;
- sitemap and searchability flags.

The registry is intentionally useful beyond the current build. Later gates may
consume the same metadata to generate blog indexes, RSS/Atom feeds, paper
catalogues, JSON-LD, related-content links, and a static full-text search index.
Those systems must not introduce a second manually maintained route catalogue.

## Version boundaries

- `schema_version` versions the registry contract.
- `content_type` describes the user's task, not a repository directory.
- `maturity_status` describes the current evidence boundary.
- `structured_data_type` is a future publishing hint; it does not cause JSON-LD
  to be emitted until the visible page content supports that type.

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
