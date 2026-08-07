# Pinega Web IA Foundation

Status: **CURRENT IMPLEMENTATION**  
Baseline: Information Architecture and Content Audit merged by PR #20  
Implementation branch: `agent/pinega-web-ia-foundation`

## Purpose

This milestone implements the first public information architecture for Pinega
as an umbrella database-systems research, engineering, and future product
programme. It changes the site's ownership model without introducing a blog,
paper viewer, full-text search, Typst HTML output, or new scientific diagrams.

## Accepted public model

```text
Pinega                       master technology and product programme
Pinega Labs                  working research/engineering and future company identity
Technology programmes       candidate paths to maintained commercial software
Pinega Engine                first active implementation programme
Research                     evidence, models, experiments, and open questions
Documentation                reproducible start/how-to/explanation/reference paths
```

The working brand line is:

```text
Correctness under concurrency.
```

The line is deliberately concise. It identifies the technical centre of Pinega
without replacing maturity labels or evidence-based claims.

## Implemented routes

| Route | Ownership |
|---|---|
| `/` | Master-brand proposition, programme status, featured Pinega Engine, and evidence discipline |
| `/technology/` | Technology catalogue, Pinega Engine architecture, accepted decisions, and promotion criteria |
| `/research/` | Seven-area research catalogue, YDMP method, and existing active studies |
| `/docs/` | Documentation-topic filter with purpose and maturity labels |
| `/docs/getting-started/` | Programme boundary and reproducible workspace commands |
| `/about/` | Pinega/Pinega Labs relationship, principles, current company boundary, and collaboration path |
| `/component-lab/` | Internal validation surface, excluded from public discovery |

## Content metadata

`web/content/content-index.json` is the single route/discovery registry. Native
HTML remains the body source. This avoids premature adoption of a CMS while
establishing the metadata required by future publishing systems.

The registry is expected to become input to:

- blog indexes and feeds;
- paper and research-artefact catalogues;
- JSON-LD generation;
- related-content navigation;
- static full-text search;
- author and update metadata;
- sitemap and route validation.

A later system may generate or import registry entries, but it must not create a
second conflicting source of route identity.

## Explicitly deferred work

- Documentation article decomposition.
- Blog content and RSS/Atom.
- Original-paper and PDF integration.
- Typst-to-HTML publication experiments.
- Site-wide indexed search.
- Contact or commercial-sales claims before a real company boundary exists.
- New scientific-diagram families or candidate-profile promotion.

## Next milestone

After this gate is accepted, proceed to **Documentation Reorganisation and
Review**. That work should split mixed documentation modes, establish real
concept/how-to/reference pages, and evaluate the current filtering UX before
adding the blog or a full-text search dependency.
