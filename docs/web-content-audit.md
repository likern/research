# Pinega Web Information Architecture and Content Audit

Status: **PROPOSED NEXT MILESTONE INPUT**  
Audit date: 2026-08-07  
Repository baseline: `main@cf604f99a621d2eba6bb02f469a81ab954921772`  
Scope: public website narrative, route hierarchy, homepage, research, documentation, documentation search, discovery metadata, and the content work required before the blog and paper-publication stages.

## Decision summary

The current Pinega website is a strong technical foundation and a credible research-stage specimen. Its semantic HTML, accessibility discipline, maturity labelling, static multi-page build, browser gates, design-system consistency, and refusal to overstate implementation maturity should be preserved.

The principal weakness is no longer implementation quality. It is **information architecture and product narrative**:

1. The public site defines Pinega primarily as one PostgreSQL storage engine, while the accepted Pinega concept is broader: an umbrella database-systems research and engineering programme, future product portfolio, master brand, and possible company.
2. The public hierarchy has no explicit layer for Pinega's technology programmes or future products. The homepage architecture section therefore carries too much responsibility.
3. The research page is a well-written long-form explanation, but not yet a navigable research catalogue.
4. The documentation landing exposes eight manually maintained topic cards, but there is only one real documentation article. Several cards link to anchors on that article or to the research essay, so the map currently promises more documentation structure than exists.
5. `pinega-doc-search` is a good progressive-enhancement topic filter, not yet documentation or site search. Its visible label should describe its current function accurately until a real static full-text index is introduced.
6. The component laboratory is an internal validation surface. It should remain buildable and reviewable, but it should not occupy a primary public-navigation position.
7. Blog, paper/library, company/about, author/update metadata, RSS, and structured data do not yet have content models or public routes.

The recommended next implementation milestone is **Pinega Web IA Foundation**, not the blog itself. It should establish the master-brand narrative, public navigation, content taxonomy, metadata contract, route ownership, and documentation boundaries. Blog and paper publication should then be implemented on that stable base.

## Scope and explicit non-goals

### In scope

- What Pinega means on the public web.
- Which audiences the site serves and what each must be able to find.
- Public route hierarchy and navigation.
- Homepage, research, documentation landing, and getting-started content.
- The present topic-filter implementation and its path to site-wide search.
- Page metadata needed by blog, research-paper, RSS, search, and SEO work.
- A prioritised implementation sequence.

### Out of scope for this stage

- New scientific-diagram families or layouts.
- Promotion of additional v0.3 diagram profiles.
- A new client-side framework or CMS.
- A production database-engine install guide before an installable engine exists.
- Rewriting research papers into a second manually maintained web copy.
- Implementing the blog, full-text search, or Typst-to-HTML pipeline in this audit PR.

Scientific Diagram Language v0.3 is a stable supporting subsystem for this web phase. Existing figures and visual baselines remain valid; no additional web diagrams are required for the information-architecture milestone.

## Audit basis

### Repository sources inspected

- `web/pages/home/index.html`
- `web/pages/research/index.html`
- `web/pages/docs/index.html`
- `web/pages/docs/getting-started/index.html`
- `web/src/components/doc-search/`
- `web/src/components/site-header/`
- `web/scripts/build.mjs`
- `web/tests/unit/site-structure.test.mjs`
- `web/tests/browser/site.spec.ts`
- `web/tests/visual/site.visual.spec.ts`
- `docs/web-foundation.md`
- `web/README.md`
- successful website artifact from `main@cf604f99...`

### External review criteria

The audit uses the following sources as design criteria rather than as templates to copy mechanically:

- Diátaxis: documentation should distinguish tutorials, how-to guides, reference, and explanation according to the user's need; blurred boundaries create structural and maintenance problems. <https://diataxis.fr/> and <https://diataxis.fr/start-here/>
- W3C WAI page structure: headings should communicate organisation, preserve meaningful rank, and support in-page navigation. <https://www.w3.org/WAI/tutorials/page-structure/headings/>
- W3C WAI landmarks: navigation regions should be identifiable and uniquely labelled when multiple navigation landmarks exist. <https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/navigation.html>
- W3C cognitive accessibility search pattern: search is an alternative to understanding menu categories, but it is less important on a very small site where all pages are close to the homepage. <https://www.w3.org/WAI/WCAG2/supplemental/patterns/o2p06-search/>
- Pagefind: a static full-text index can be generated after a static HTML build, without adding a search server. <https://pagefind.app/docs/running-pagefind/>
- Google Search structured-data guidance: structured metadata must describe visible page content accurately; JSON-LD is recommended, but correctness and specificity matter more than quantity. <https://developers.google.com/search/docs/appearance/structured-data/sd-policies>

Reference sites were inspected only for useful patterns:

- DuckDB clearly separates product value, documentation, engineering blog, and a library of papers/talks while retaining a direct path to source material.
- Oxide separates product documentation from public RFDs and engineering writing, and treats design records as durable, discussable artefacts.
- ClickHouse and Oxide documentation landings foreground user goals and global search rather than exposing an internal repository taxonomy.

## Current route inventory

The build currently emits four public routes, one internal validation route, and an explicit 404 page.

| Route | Current role | Primary audience implied by content | Disposition |
|---|---|---|---|
| `/` | Product homepage centred on a PostgreSQL storage engine | Database engineers evaluating the engine idea | Keep, but reframe around Pinega as the umbrella programme and make Pinega Engine a named programme beneath it |
| `/docs/` | Documentation map with eight filterable cards | Contributors and technically curious readers | Keep, but restructure around real content types and actual pages |
| `/docs/getting-started/` | Status, architecture explanation, workspace setup, web setup, and validation in one article | Repository contributors | Split into distinct start/tutorial, how-to, concept, and reference pages |
| `/research/` | Long-form research-method and engine-research narrative | Researchers and systems engineers | Keep, but turn the landing into a programme catalogue and move deep explanations to child pages |
| `/component-lab/` | Design-system validation surface | Pinega web maintainers | Keep out of sitemap and remove from primary public navigation; expose through contributor/internal documentation |
| `/404.html` | Accessible not-found page | All users | Keep |

The sitemap correctly excludes `/component-lab/`. The public navigation nevertheless promotes the component laboratory as `Design system`, which conflicts with its documented role as a validation surface rather than a primary public destination.

## What is already done well

### Honest maturity boundaries

The homepage and getting-started page repeatedly distinguish available tooling, validated contracts, research hypotheses, design decisions, and planned implementation. This is one of the strongest aspects of the site and should remain a non-negotiable Pinega convention.

Particularly good patterns include:

- `Research stage` and `PostgreSQL 19 target` labels.
- Explicit statements that no production release or performance claim exists.
- A status ledger separating available, validated, and planned work.
- Research evidence components that distinguish confirmed decisions, hypotheses, and external evidence.
- A proposed architecture caption that states that not every layer is implemented.

### Durable semantic HTML and progressive enhancement

The site does not depend on client-side rendering for meaning. Public content, links, headings, tables, lists, code samples, documentation cards, and fallbacks are present in source HTML. JavaScript enhances navigation, theme selection, copy actions, charts, and filtering rather than creating the page's durable content.

### Accessibility and regression discipline

The current test suite covers:

- main landmarks on all routes;
- mobile and desktop horizontal overflow;
- keyboard behaviour;
- theme switching;
- documentation filtering;
- accessible 404 handling;
- Chromium, Firefox, and WebKit;
- serious and critical axe violations;
- committed visual baselines;
- canonical metadata, sitemap, robots, and route manifest generation.

The getting-started article also has distinct documentation navigation, breadcrumbs, one page title, an on-page table of contents, and well-structured sections. These are sound patterns to preserve when the documentation expands.

### Visual identity

The Strata visual language is distinctive, calm, technical, and coherent across homepage, docs, research, callouts, code blocks, tables, and diagrams. The problem is not lack of visual quality. The next work should improve hierarchy and purpose without replacing the design system.

## Primary strategic finding: the site describes only one layer of Pinega

The current title, description, and hero define Pinega as:

> a research-stage PostgreSQL storage engine

and:

> a storage engine designed around explicit versions and concurrent lifetimes

That description is accurate for **Pinega Engine**, but incomplete for **Pinega**.

The accepted programme model is broader:

- a database and systems research programme;
- an engineering platform and reusable infrastructure;
- several potential product lines, including storage, optimisation, verification, observability, and developer tooling;
- Pinega as master brand and Pinega Labs as a possible company/research identity;
- a process that converts research into defensible commercial software.

The web hierarchy must express this relationship explicitly:

```text
Pinega / Pinega Labs             master programme and company narrative
        ↓
Technology programmes           what is being built
        ↓
Pinega Engine                    first concrete engine direction
Research areas                  why the programmes exist and what supports them
Documentation                   how to inspect, reproduce, use, and contribute
Blog / papers                   durable public communication and evidence
```

Without this layer, the homepage makes future optimiser, distributed-systems, verification, HPC, or developer-tooling work look unrelated to the brand.

## Audience and intent model

The site should not be organised around repository directories. It should support a small number of external user intents.

| Audience | First question | Required path |
|---|---|---|
| Prospective customer, partner, investor, or future employee | What is Pinega, what value can it create, and what exists today? | Homepage → Technology → status/roadmap → About/contact |
| Database and systems engineer | What is technically different, and what evidence supports it? | Technology/Engine → architecture → research → implementation status |
| Researcher or paper reader | Which problems are being studied, what artefacts exist, and how are claims classified? | Research landing → area/project/paper → source and outputs |
| Contributor | How do I reproduce the workspace, build the site, run checks, and submit changes? | Documentation → start/contributing/reference |
| Internal design-system maintainer | How do I inspect components and visual regressions? | Contributor/internal docs → component laboratory |

The homepage should serve the first two groups. Documentation should primarily serve contributors and future users. Research should serve researchers and engineers. The component laboratory should not define public navigation for any of these audiences.

## Homepage audit

### Strengths

- Immediate acknowledgement of research-stage maturity.
- Strong technical differentiation: versions, lifetime protocols, WAL, and explicit boundaries.
- Clear evidence ledger and architecture status.
- Useful paths to getting started and research.
- Effective visual identity and strong production-quality implementation.

### Problems

#### P0 — master-brand mismatch

The page title, description, H1, architecture section, and roadmap all identify Pinega with one storage-engine direction. The page needs to introduce Pinega first, then identify Pinega Engine as the first active technology programme.

#### P0 — no programme or portfolio layer

There is no place to represent research and product directions that are neither the current engine nor the internal workspace. A future optimiser, verification tool, distributed database project, or benchmark suite would have no obvious public home.

#### P0 — primary navigation exposes internal structure

`Architecture` points to a homepage fragment rather than a durable subject page. `Design system` points to the component laboratory. Neither should be a long-term top-level public destination in its current form.

#### P1 — company identity is underdeveloped

`Pinega Labs` appears in supporting copy and the footer, but there is no About/Company page, contact path, operating principles, or explanation of how Pinega and Pinega Labs relate.

#### P1 — customer value appears after internal mechanism

The page explains the hot path, version store, buffer pool, and research workspace well. It does not yet answer, at the same quality level:

- which workloads or organisations might eventually benefit;
- why a Pinega product could be commercially differentiated;
- which claims are expected benefits versus measured outcomes;
- how several research directions fit one product strategy.

This should be solved without hype: expected value must remain labelled as proposed until benchmarks or products exist.

#### P2 — hero scanning cost

The oversized hero is visually distinctive, but it consumes most of the first viewport with a long engine-specific sentence. It should remain bold while delivering the broader meaning in fewer words and allowing the programme/status layer to appear sooner.

### Recommended homepage content order

1. **Master-brand proposition** — what Pinega does at programme/company level.
2. **Current maturity statement** — research-stage, no production engine yet.
3. **Active technology programmes** — each with explicit state. Initially this may include Pinega Engine, optimisation research, correctness/verification infrastructure, and the research/web platform, but only if the labels avoid implying shipped products.
4. **Why Pinega** — high-performance systems, explicit correctness, PostgreSQL fit, reproducible evidence, commercial intent.
5. **Featured programme: Pinega Engine** — the current four-strata architecture and link to a dedicated technology page.
6. **Research-to-product workflow** — sourced research → model → verify → implement → measure.
7. **Latest writing/research** — populated by the future blog and paper catalogue.
8. **Status/roadmap and contact**.

Possible copy direction, not final approved copy:

```text
Title: Pinega — high-performance database systems research and engineering
H1: From database systems research to production software.
Lede: Pinega Labs develops high-performance database technology across storage,
transactions, concurrency, optimisation, and verification. Pinega Engine is the
first active implementation programme; it is currently in research and architecture development.
```

## Research-section audit

### Strengths

- Clearly states that research is part of the product boundary.
- Makes provenance and uncertainty explicit.
- Explains the YDMP workflow coherently.
- Contains substantive technical material rather than generic marketing copy.
- Connects versioned storage, concurrent lifetimes, linearizability, WAL, cache awareness, and deterministic testing.

### Problems

#### P0 — explanation page masquerades as a catalogue

The current `/research/` is a long, 1,300+ word essay. It is good explanation content, but a research landing must also answer:

- What are the active research areas?
- Which projects, papers, experiments, models, or implementations belong to each area?
- What is accepted, active, experimental, or superseded?
- Which Pinega technology programme consumes the result?
- Where is the original source or repository artefact?

#### P0 — research scope is narrower than the Pinega programme

The public page primarily covers storage, lifetimes, and histories. It does not yet expose the accepted broader programme:

- transaction theory and serializability;
- distributed databases, replication, consensus, and clocks;
- query optimisation, cardinality, decorrelation, materialised views, recursive queries;
- MCTS/RL join-order selection;
- formal and executable verification;
- cache/coherence/NUMA and low-level performance engineering;
- benchmarking and deterministic testing.

Not every topic needs a page immediately. The landing should nevertheless establish the taxonomy so new work has a stable location.

#### P1 — no first-class research artefact model

There is no public catalogue for papers, reading notes, MODEL/VERIFY documents, experiments, benchmarks, talks, or implementations. They are mentioned as a method, not exposed as navigable objects.

#### P1 — internal terminology leads too early

`YDMP Research Workspace` is an important Pinega capability, but an external reader should first understand the research question and output. The method can be introduced after the value of provenance and reproducibility is clear.

### Recommended research landing

The landing should become an index with five layers:

1. Research mission and evidence policy.
2. Research-area catalogue.
3. Active projects and experiments.
4. Publications, source papers, notes, and implementations.
5. Research method/YDMP and contribution path.

Recommended top-level research areas:

```text
Storage and execution
Concurrency and memory reclamation
Transactions and correctness
Distributed systems
Query optimisation and AI
Performance engineering and hardware
Verification and deterministic testing
```

Each item should expose a maturity state and links to its outputs. The current long-form sections can become child explanation pages rather than being discarded.

## Documentation audit

### Strengths

- The landing explains the evidence/maturity labels before presenting topics.
- Cards remain durable HTML and are enhanced rather than generated by JavaScript.
- The recommended reading path is appropriate for a research-stage project.
- The getting-started page has breadcrumbs, side navigation, on-page navigation, code examples, and an explicit project-status warning.
- Current commands are real repository commands rather than fictional product instructions.

### Problems

#### P0 — documentation map is larger than the documentation corpus

The landing presents eight topics, but only `/docs/getting-started/` is a documentation article. Other cards resolve to:

- anchors inside getting started;
- anchors inside the research landing;
- the repository.

This makes the landing look like a documentation system when it is currently a curated link directory.

#### P0 — one article mixes four documentation purposes

`Getting started with the Pinega workspace` contains:

- project-status explanation;
- engine architecture explanation;
- a WAL decision record;
- a research-workspace tutorial/how-to;
- a website-build how-to;
- validation reference.

These serve different users and different needs. Diátaxis explicitly warns that blurring tutorials, how-to guides, reference, and explanation harms usability and maintenance.

#### P0 — documentation audience is ambiguous

The title and landing suggest product documentation for a PostgreSQL engine, but the content is currently contributor documentation for the research repository and website. The site should state this directly and reserve product/engine installation documentation until it exists.

#### P1 — fake or stale version controls

The landing displays `Documentation v0.1`; the article shows a disabled `Research v0.1` version selector. A disabled selector implies unavailable versions and adds interface weight without user value. Use a textual status/version label until multiple maintained documentation versions exist.

#### P1 — missing document provenance

Nested documentation pages should eventually expose:

- last reviewed/updated date;
- content status;
- source path or `Edit on GitHub` link;
- owning programme;
- applicable software/system version;
- related explanation, how-to, and reference pages.

#### P1 — no stable documentation taxonomy

The current side navigation mixes article anchors with a link to the research programme. A scalable documentation site needs explicit content categories and actual routes.

### Recommended documentation architecture

Do not create empty sections merely to look complete. Establish the taxonomy, then add pages only when substantive content exists.

```text
/docs/
├── start/
│   ├── project-overview/
│   ├── research-workspace/
│   └── web-workspace/
├── tutorials/
│   └── reproduce-the-research-and-web-workspaces/
├── how-to/
│   ├── build-the-site/
│   ├── run-validation/
│   ├── add-a-public-page/
│   ├── add-a-research-document/
│   └── inspect-actions-artifacts/
├── concepts/
│   ├── pinega-programme/
│   ├── maturity-and-evidence-labels/
│   ├── pinega-engine-architecture/
│   └── research-to-product-workflow/
├── reference/
│   ├── repository-layout/
│   ├── research-cli/
│   ├── web-build-and-environment/
│   ├── design-token-contract/
│   └── content-metadata-schema/
└── contributing/
    ├── contribution-workflow/
    └── review-and-release-gates/
```

The four categories may be presented to users as `Learn`, `How-to`, `Concepts`, and `Reference`; strict terminology matters less than each page having one clear purpose.

### Recommended decomposition of the current getting-started article

| Existing section | Target content type | Target destination |
|---|---|---|
| What is available now | Explanation/status | `/docs/start/project-overview/` |
| Architecture contract | Explanation | `/docs/concepts/pinega-engine-architecture/` or `/technology/engine/architecture/` |
| WAL and durability | Decision/reference | Architecture decision record linked from the engine concept page |
| Build the research workspace | Tutorial or how-to | `/docs/start/research-workspace/` |
| Build and inspect the website | How-to | `/docs/how-to/build-the-site/` |
| Run the validation gate | Reference + how-to | `/docs/how-to/run-validation/` plus command reference |

## Documentation-search audit

### Current implementation

`pinega-doc-search` progressively filters eight existing cards. It:

- preserves the cards in source HTML;
- normalises input with NFKC and locale-aware lowercase;
- applies an AND substring match across `data-search` and visible card text;
- updates an `aria-live` result count;
- exposes a clear empty state;
- requires no search service.

For four public pages, this is a proportionate implementation and a good baseline.

### Current semantic mismatch

The interface says `Search documentation`, but it does not search documentation pages or page sections. It filters eight manually maintained topics. Until a full index exists, the label should be:

```text
Filter documentation topics
```

and the component should be described as a topic filter in public copy and tests.

### Scaling limitations

- No content-body indexing.
- No relevance ranking or snippets.
- No section-level results.
- No query in the URL, so results cannot be shared or restored.
- No synonym, stemming, spelling, or alternate-term support.
- No grouping by content type, programme, topic, or maturity.
- No global search across docs, research, blog, and papers.
- Card search metadata is manually duplicated and can drift from the destination content.
- Search cannot discover a new page unless a new card is manually added.

### Recommended evolution

#### Phase A — present site

Keep the durable card filter, but rename it accurately. Add regression checks for:

- Unicode/case normalisation;
- multi-term AND behaviour;
- empty result state;
- keyboard focus and status announcement;
- no-JavaScript visibility of all cards.

#### Phase B — after docs and blog have enough pages

Introduce build-time static full-text search. Pagefind is a strong candidate because it indexes generated static HTML after the build, supports section-level results and metadata, and requires no server. It should be evaluated against a small Pinega-owned index implementation before adoption; the audit does not approve a dependency automatically.

Recommended search scope:

```text
include: docs, technology, research, blog, paper metadata and web-readable paper content
exclude: component lab, test fixtures, generated diagram JSON, duplicate print/PDF representations
```

Recommended result metadata:

- content type;
- title and section;
- summary/snippet;
- programme/research area;
- maturity/status;
- published and updated dates;
- author;
- tags;
- canonical URL.

Recommended UX:

- global search trigger in the site header;
- dedicated `/search/` fallback route;
- `Cmd/Ctrl+K` enhancement, not the only access path;
- query persisted in the URL;
- keyboard-operable results;
- grouped or filterable results when volume warrants it;
- suggestions for no results.

Full search should be implemented after the blog and documentation route models exist. Building it before there is enough content would optimise the wrong corpus.

## Public navigation recommendation

### Current

```text
Documentation | Research | Architecture | Design system
```

### Target for the research/company stage

```text
Technology | Research | Documentation | Blog | About | GitHub
```

Rationale:

- `Technology` is safer than `Products` before a product is shipped, but creates a stable home for Pinega Engine and other programmes.
- `Architecture` becomes a child of the relevant technology programme rather than a homepage anchor.
- `Blog` is a first-class communication channel.
- `About` explains Pinega/Pinega Labs, principles, status, contact, and commercial intent.
- `Design system` moves to contributing/internal documentation; `/component-lab/` remains non-sitemap.
- GitHub may remain a visually separate external action rather than an ordinary information category.

The final order and responsive treatment should be tested once the routes exist.

## Proposed target information architecture

This is a destination model, not a requirement to create empty pages immediately.

```text
/
├── technology/
│   ├── engine/
│   │   ├── architecture/
│   │   ├── status/
│   │   └── roadmap/
│   ├── optimisation/
│   ├── verification/
│   └── platform/
├── research/
│   ├── areas/
│   ├── projects/
│   ├── papers/
│   ├── experiments/
│   └── methods/
├── docs/
│   ├── start/
│   ├── tutorials/
│   ├── how-to/
│   ├── concepts/
│   ├── reference/
│   └── contributing/
├── blog/
│   ├── index by date
│   ├── topics/
│   ├── authors/
│   └── feed.xml
├── about/
│   ├── pinega-labs/
│   ├── principles/
│   └── contact/
├── search/
└── component-lab/        internal validation surface, not primary navigation
```

Not all potential technology programmes should be published immediately. The structure must support them without presenting speculative work as an available product.

## Content ownership model

The current HTML pages duplicate route metadata in several places: `build.mjs`, page heads, sitemap generation, site-manifest generation, docs cards, navigation links, and tests. Blog, papers, RSS, and search will multiply this duplication unless a content metadata contract is introduced first.

Recommended content record:

```text
id
route
content_type          page | docs | blog | research | paper | technology
canonical_title
navigation_title
summary
audience
programme
research_area
topics
maturity_status
published_at
updated_at
authors
source_path
sitemap
searchable
structured_data_type
```

This record may be represented as validated JSON/YAML, structured HTML metadata, or a typed build manifest. The decision should preserve the accepted rule that native HTML owns durable web content. Metadata may drive navigation, cards, sitemap, RSS, search, and JSON-LD without turning article bodies into client-side data.

## SEO and discovery findings

### Current strengths

- Unique titles and descriptions on all public routes.
- Canonical URL templates.
- Open Graph title, description, URL, and type.
- Generated `robots.txt` and sitemap.
- Correct exclusion of the component laboratory from the sitemap.

### Missing foundations

- No structured JSON-LD.
- No `Organization`/`WebSite` identity for Pinega/Pinega Labs.
- No `Article`, `BlogPosting`, `TechArticle`, `BreadcrumbList`, or `ScholarlyArticle` records.
- No author, publication date, updated date, or visible provenance block on articles.
- No RSS/Atom feed.
- No dedicated social-preview image strategy.
- No public content-source/edit links.

Structured data must be added only after the corresponding visible content model exists. It must not describe products, authors, organisations, dates, or claims that the page does not visibly and accurately establish.

## Accessibility and reading-quality findings

### Preserve

- One meaningful H1 per page.
- Structured H2/H3 hierarchy.
- Skip link.
- Labelled primary, documentation, breadcrumb, footer, and on-page navigation.
- Durable HTML before enhancement.
- Visible maturity labels rather than colour-only status.
- Responsive overflow checks and multi-browser validation.

### Improve during IA implementation

- Add automated heading-order and unique-landmark checks as page count grows.
- Validate fragment targets, not only route existence.
- Ensure every nested article has breadcrumbs, source/update metadata, and an on-page navigation policy based on length.
- Review the very large homepage/research hero typography for scanning efficiency while preserving the Strata character.
- Avoid disabled version selectors until multiple versions are real.
- Treat global search as a normal labelled control and provide a dedicated fallback page.

No current screenshot or test result establishes a blocking accessibility defect. These are scalability and reading-quality improvements, not claims of WCAG failure.

## Prioritised problem register

### P0 — blocks blog/docs/paper growth

1. Reframe Pinega as the master programme; name Pinega Engine as a programme beneath it.
2. Establish target public navigation and route ownership.
3. Remove `/component-lab/` from primary public navigation.
4. Introduce a content taxonomy and validated metadata contract.
5. Reorganise documentation around actual page purposes; stop representing anchors as independent docs topics.
6. Turn `/research/` into a catalogue entry point while preserving its current explanation material in child content.
7. Rename the present documentation control from search to topic filter.

### P1 — required for Web Platform v1.0

1. Implement `/technology/` and an honest Pinega Engine page.
2. Implement `/about/` and clarify Pinega/Pinega Labs.
3. Implement blog content/index/post/feed architecture.
4. Implement a research-paper/library content type and original-source access model.
5. Implement site-wide static search after the new corpus exists.
6. Add visible author/date/status/source metadata and correct structured data.
7. Add content-derived sitemap, cards, feeds, and search indexing.

### P2 — after core publishing works

1. Author/topic archive pages.
2. Release notes and changelog views.
3. Optional multilingual publishing strategy.
4. Search synonyms, stemming, spelling assistance, and richer faceting.
5. Analytics and privacy-respecting content-performance measurement.
6. User feedback/report-content mechanisms.

## Proposed implementation sequence

### Gate 1 — Web IA Foundation

Purpose: make the public hierarchy honest and scalable before adding publishing systems.

Deliverables:

- approved audience/intents and route tree;
- content metadata schema/registry;
- new primary navigation contract;
- homepage master-brand rewrite;
- Technology and About minimum viable pages;
- component lab removed from public primary navigation;
- current documentation filter renamed accurately;
- route, fragment, metadata, heading, and sitemap tests updated.

### Gate 2 — Documentation Reorganisation and Review

Purpose: turn the current documentation map into a real documentation corpus.

Deliverables:

- split current getting-started material by purpose;
- contributor/start/how-to/concepts/reference hierarchy;
- page provenance and update metadata;
- actual docs cards generated from content metadata;
- documentation navigation and breadcrumbs derived consistently;
- search readiness metadata.

### Gate 3 — Blog Platform

Purpose: establish Pinega's durable engineering and research communication channel.

Deliverables:

- `/blog/` index and one real post;
- article metadata and author model;
- topic archives only if justified by content volume;
- RSS or Atom feed;
- `BlogPosting`/`Article` structured data;
- inclusion in sitemap and global navigation.

### Gate 4 — Paper and Research-Artefact Integration

Purpose: expose original papers, PDFs, metadata, YDMP artefacts, and optional web reading without maintaining a second hand-written article copy.

Deliverables:

- paper/library route model;
- original-source/PDF/BibTeX access;
- Typst HTML feasibility and quality evaluation;
- canonical-source policy for PDF, Typst, and HTML;
- research status, notes, MODEL, VERIFY, and implementation links;
- copyright/licensing rules for third-party papers.

### Gate 5 — Site-wide Static Search

Purpose: index the real corpus, not the current eight-card map.

Deliverables:

- evaluated and pinned search implementation;
- build-time index over docs, research, blog, and paper metadata/web content;
- accessible global UI and `/search/` fallback;
- result snippets, type/status metadata, keyboard tests, and no-result behaviour;
- component lab and duplicate representations excluded.

### Gate 6 — Web Platform v1.0 Hardening

Purpose: close the web-specific production milestone.

Deliverables:

- complete route/link/fragment/heading audits;
- structured data and social previews;
- performance budgets with the real blog/search corpus;
- feed validation;
- print and no-JavaScript review;
- accessibility review beyond automated axe checks;
- documentation of deployment, content authoring, and release workflow.

## Gate 1 acceptance criteria

The Web IA Foundation is ready when:

- a first-time visitor can answer `What is Pinega?`, `What exists now?`, `What is Pinega Engine?`, `Where is the research?`, `Where are the docs?`, and `Who is Pinega Labs?` without inferring from internal terminology;
- the homepage no longer equates the master brand exclusively with the PostgreSQL storage engine;
- every primary navigation item resolves to a durable public route;
- the component laboratory is absent from primary public navigation and sitemap;
- every public page has one clear primary purpose and audience;
- docs cards represent real pages or are explicitly labelled external/cross-section links;
- the current filter is no longer presented as full documentation search;
- route metadata has one validated source that can later drive blog, feeds, search, sitemap, and structured data;
- all existing browser, accessibility, build, and visual-regression gates remain green;
- no new diagrams are required.

## Recommended immediate next change

After this audit is approved, create a focused **Pinega Web IA Foundation** PR. It should implement only Gate 1. Do not combine it with the blog, full-text search, or Typst HTML work. Those features depend on the content and route contracts established by Gate 1 and should remain separately reviewable.
