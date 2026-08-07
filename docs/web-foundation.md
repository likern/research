# Pinega Web architecture

## Status

Version: `0.3`

The v0.1 gate established canonical cross-platform tokens, the Web Awesome
integration boundary, the component laboratory, representative Pinega
compositions, and executable quality gates. Version 0.2 added the first public
homepage, documentation, research, and getting-started routes.

Version 0.3 implements the Information Architecture Foundation accepted in
`docs/web-content-audit.md`:

- Pinega is presented as the umbrella database-systems research and engineering
  programme rather than as a synonym for one storage engine;
- Pinega Engine is the first active implementation programme beneath that
  master brand;
- public navigation owns Technology, Research, Documentation, About, and
  GitHub destinations;
- the component laboratory remains an internal validation surface;
- a versioned content registry owns route and discovery metadata;
- documentation exposes a topic filter and content-purpose labels without
  claiming full-text search;
- no new diagram family, blog engine, paper viewer, or Typst HTML pipeline is
  introduced by this milestone.

The working master-brand line is:

```text
Correctness under concurrency.
```

It is used as a technical positioning line, not as a claim that every proposed
programme has reached formal verification or production maturity.

## Public hierarchy

```text
Pinega / Pinega Labs          programme and organisation boundary
        ↓
Technology programmes        what may become maintained software
        ↓
Pinega Engine                 first active implementation programme

Research                      questions, evidence, models, and experiments
Documentation                 start, how-to, explanation, and reference paths
About                         identity, principles, and commercial boundary
```

Current routes:

```text
/                         master-brand homepage
/technology/              programme catalogue and Pinega Engine boundary
/research/                research taxonomy, method, and active studies
/docs/                    documentation topics and purpose/maturity labels
/docs/getting-started/    first contributor-oriented start page
/about/                   Pinega and Pinega Labs identity
/component-lab/           internal validation surface
/404.html                 explicit not-found page
```

The blog is not placed in navigation before a real content model and route
exist. Empty destination pages are prohibited.

## Content contract

`web/content/content-index.json` is the only route and public-discovery
registry. The schema records:

```text
id, route, source/output paths, content type, titles, summary, audience,
programme, research area, topics, maturity, dates, authors, sitemap,
searchability, structured-data intent, public/canonical status
```

Page bodies remain native semantic HTML. The build validates agreement between
registry and source pages, then derives routes, sitemap entries, and
`site-manifest.json` from the registry.

This boundary is intentionally reusable by later blog, paper, feed, JSON-LD,
related-content, and static-search implementations. Those gates must extend the
same metadata model rather than introducing parallel front matter or route
lists without reconciliation.

## Principles

1. Native HTML owns document semantics and durable content.
2. CSS owns presentation, layout, responsive adaptation, and visual state.
3. JavaScript owns lifecycle and interaction enhancement.
4. Web Awesome supplies generic interaction primitives, not Pinega semantics.
5. Pinega custom elements wrap only stable domain concepts or intentional
   vendor-isolation boundaries.
6. Licensed Pro components progressively enhance complete semantic fallbacks.
7. Canonical Pinega tokens generate CSS, TypeScript, and Typst adapters.
8. Product maturity is expressed with text and structure, never colour alone.
9. Public claims distinguish implemented, validated, experimental, proposed,
   and planned work.
10. Public navigation follows user intent and programme ownership, not repository
    directories or internal validation surfaces.

## Page and build model

The site is a static multi-page build. Source HTML is not generated from a
client-side framework and remains useful before Custom Elements register.

`web/scripts/build.mjs`:

- validates the versioned content registry;
- verifies title, description, page identity, canonical policy, heading count,
  and public navigation for every registered source page;
- bundles shared CSS and JavaScript;
- injects semantic diagrams and the private Web Awesome project boundary;
- emits clean directory routes from the registry;
- copies canonical content, diagram, and static sources needed by consumers;
- generates `robots.txt`, `sitemap.xml`, and a metadata-rich
  `site-manifest.json`.

## Navigation decision rule

```text
public primary navigation
    stable audience destination with real content and route ownership

footer navigation
    durable public destinations and repository access

internal/contributor navigation
    component lab, design-system validation, build and maintenance surfaces
```

`/component-lab/` remains out of the sitemap, public primary navigation, and
future site search. It is reachable from contributor documentation.

## Documentation and search boundary

The current `pinega-doc-search` component filters eight durable topic cards.
Its visible UI is therefore labelled **Filter documentation topics**. It does
not claim indexed page search.

The documentation cards expose purpose independently from maturity:

- Start;
- How-to;
- Explanation;
- Research;
- Reference.

A later documentation-reorganisation gate will split the first broad
getting-started article into real pages. Site-wide static search follows only
after the docs, blog, and paper corpus are large enough to justify an index.

## Gate exit criteria

- Pinega is framed as the master programme on homepage and metadata;
- `Correctness under concurrency.` appears as the working brand line;
- Pinega Engine is explicitly subordinate to the wider programme;
- Technology and About routes contain substantive content;
- Research exposes the accepted seven-area taxonomy;
- public navigation is consistent on every public page and excludes the
  component laboratory;
- content metadata is versioned, validated, copied to output, and represented
  in the generated site manifest;
- all local routes and fragments resolve;
- the topic-filter label matches actual behaviour;
- the site remains useful without client-side rendering or Pro assets;
- TypeScript, unit, build-budget, Chromium, Firefox, WebKit, accessibility,
  responsive-overflow, and visual-regression gates pass.
