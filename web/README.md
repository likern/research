# Pinega Website and Strata Web System

This directory contains Pinega's production-oriented static Web platform. It
uses semantic HTML, modern CSS, native Custom Elements, and Web Awesome as the
generic interaction kernel. Pinega Strata remains the canonical design system.

## Public information architecture

The public site presents Pinega as an umbrella database-systems research and
engineering programme. Pinega Engine is the first active implementation
programme beneath that master brand.

```text
/                                           master-brand homepage
/technology/                                technology programmes and maturity boundaries
/research/                                  research-area catalogue and active studies
/research/publications/                     bilingual research-publication catalogue
/research/publications/dual-target-contract/ responsive semantic publication reader
/research/publications/dual-target-contract/paper.pdf exact paged publication artefact
/docs/                                      documentation corpus and topic filter
/docs/getting-started/                      orientation router
/docs/start/project-overview/               programme/status orientation
/docs/start/research-workspace/              first-run research tutorial
/docs/how-to/build-the-site/                 Web build procedure
/docs/how-to/run-validation/                 Web validation procedure
/docs/concepts/*                             programme, architecture, evidence, workflow explanations
/docs/reference/*                            repository, environment, and metadata reference
/docs/contributing/review-and-release-gates/ contributor/review contract
/about/                                     Pinega / Pinega Labs identity and principles
/component-lab/                             internal design-system validation surface
/404.html                                   explicit not-found page
```

`/component-lab/` remains buildable and testable but is excluded from primary
public navigation, the sitemap, and future site search.

## Documentation Gate 2

Gate 2 decomposes the former all-in-one Getting Started article into a real
purpose-specific corpus. The hierarchy currently publishes:

```text
Start
How-to
Concepts
Reference
Contributing
```

The content schema also reserves `tutorials`; no empty Tutorials destination is
published until there is enough substantive tutorial content to justify it.

Documentation purpose and evidence maturity are independent. A how-to may be
`available` because its commands run today, while an architecture explanation
may be a `validated` design contract without claiming a production engine
implementation.

Every nested documentation page exposes generated:

- documentation side navigation with `aria-current`;
- hierarchical breadcrumbs;
- purpose and evidence maturity;
- applicable programme/workspace/version scope;
- last-updated and owner metadata;
- registry identity and source/edit links;
- declared related content.

The disabled pseudo-version selector from the earlier foundation has been
removed. A real version switcher should appear only when multiple maintained
versions exist.

## Content and route contract

`content/content-index.json` is the versioned logical content and discovery
registry. The current schema version is 4: stable logical fields live on each
entry, while authored, route-bearing fields live in explicit locale variants.
Gate 3A established this model as schema v3; Gate 5.1 adds the explicit
publication-to-research-registry join.
There is no implicit content fallback between languages.

```text
entry.id + entry.revision + shared discovery metadata
entry.locales.en.route + source + title + summary + reviewed_revision
entry.locales.ru.route + source + title + summary + reviewed_revision
documentation.section
documentation.purpose
documentation.order
documentation.related
entry.locales.*.documentation.applies_to
publication.profile + publication.slug
entry.locales.*.publication_document_id
```

Native HTML under `pages/<locale>/` remains the durable semantic article body
for ordinary routes. A `research-publication` shell instead reserves one
build-owned slot whose complete article comes from its registered Typst source.
English retains the existing unprefixed public routes; Russian routes are
reserved under `/ru/`. The build checks BCP 47 locale identity, locale-specific
source and output paths, title, description, `data-page`, canonical policy, one
`h1`, public navigation, and translation freshness. A published variant must
review the current logical entry revision.

For documentation, build-time generation owns repeated discovery/navigation
chrome rather than prose:

```text
content/content-index.json
        ↓ validation
registered native HTML pages
        ↓ static build
locale-specific cards + docs navigation + breadcrumbs + provenance
        ↓
site-manifest.json + content/<locale>/documentation-manifest.json + sitemap
```

`content/en/documentation-manifest.json` and
`content/ru/documentation-manifest.json` are locale-specific search-readiness
projections. The Russian projection is deliberately empty until Gate 3B
publishes reviewed Russian documents.

## Gate 3A multilingual publishing foundation

The URL and discovery contract is explicit:

```text
English: /, /technology/, /docs/...
Russian: /ru/, /ru/technology/, /ru/docs/...
```

Every published canonical variant receives a self canonical, a self
`hreflang`, and `x-default` for the default English variant. Cross-language
`hreflang` is generated only for a real registered peer. The visible language
selector is always present, names every configured language in that language,
and marks the current language explicitly. Selecting an unavailable variant
keeps the current URL and content, then exposes a localized status banner below
the top header; it never routes to placeholder or fallback article content.
The server never redirects from `Accept-Language`; users and crawlers select
stable URLs directly.

Gate 3A supplies the schema, locale-aware build, localized UI catalogues,
per-locale manifests, Russian not-found response, and shared component/runtime
behaviour. It does not publish machine-translated or placeholder Russian
articles. Gate 3B owns translation, review, and activation of the Russian
corpus.

## Gate 3B Russian content corpus and review

Gate 3B publishes reviewed Russian peers for all 18 canonical public pages:
the homepage, Technology, Research, About, the documentation landing, and all
13 nested documentation pages. The internal component laboratory remains
English-only and outside the public corpus. The Russian 404 is updated to link
to the published Russian entry points.

The editorial and review contract lives in
`content/localization-policy.md`; canonical Russian terminology is recorded in
`content/terminology.ru.json`, and the initial review evidence is recorded in
`content/localization-review.ru.md`. A Russian variant is activated only as a
complete `pages/ru/` HTML source with localized registry metadata and a current
`reviewed_revision`. The build then derives reciprocal `hreflang`, the Russian
documentation manifest, navigation, breadcrumbs, related links, topic-filter
cards, and sitemap inclusion from the same registry.

The working brand line `Correctness under concurrency.` remains English and is
marked `lang="en" translate="no"` on Russian pages. Code, commands, identifiers,
API names, and project/product names remain unchanged; surrounding prose,
metadata, captions, diagram accessibility text, and transcripts are Russian.

Client JavaScript localizes interaction-only text such as copy state, theme
controls, and missing-translation status. The status also has a fragment-based
HTML/CSS fallback when JavaScript is unavailable. JavaScript does not translate
article content. Web Awesome Core loads its
Russian translation module when `<html lang="ru">`; a purchased project is
expected to expose the matching `translations/ru.js` beside its configured
project module.

## Gate 4.0 static-navigation contract and MPA baseline

Every generated route now exposes document contract `1`, shell compatibility
version `4.0`, one normalized artifact build ID, route identity, and a closed
feature list on `<main>`. The build parses every complete document with parse5,
validates route-owned metadata and feature classification, and records the same
build/feature projection in site-manifest schema v4. The logical multilingual
content registry remains schema v3.

Gate 4.0 itself did not intercept navigation. Its MPA measurement remains an
explicit coordinator-disabled behavioral reference and its deterministic
fixtures cover ordinary, long,
multilingual, missing-translation, future Lit-feature, malformed, redirect,
404, non-HTML, and old/new-build cases. The complete decision and ownership
contract is in [`../docs/web-static-navigation.md`](../docs/web-static-navigation.md).

## Gate 4.1 Navigation coordinator

Public same-locale links now progressively enhance through one Navigation API
coordinator. A cold route performs one HTML fetch, detached DOM/contract
validation, and one synchronous replacement of route-owned metadata, the
language-switcher slot, active navigation marker, and `<main>`. The live
Document, site-header instance, theme, modules, CSS, footer, and Web Awesome
runtime remain in place.

Reloads, fragments, cross-origin/download/form/target links, locale changes,
the internal component laboratory, 404 documents, unsupported browsers, and
all rejected responses remain native MPA navigation. There is no History API
polyfill. Route cache, prefetch, dynamic feature imports, custom focus/scroll
policy, and Lit migration remain later gates.

## Gate 4.2 Transactional correctness

The coordinator now admits a visible commit only through a monotonic,
abort-aware, non-reentrant transaction gate. A late response, a superseded
push, or a pending navigation interrupted by Back cannot mutate the route that
won. Successful push/replace commits focus the new `<main>` and update one
persistent polite route-title announcer. After commit, explicit Navigation API
scroll restoration handles top, cross-route fragments, missing-fragment top
normalization, and Back/Forward entries before push/replace focus is finalized;
fragment-only active-route links remain native.

While the current transaction is pending, the existing `<main>` exposes
`aria-busy="true"` and an absolute two-pixel progress surface overlays the lower
edge of the persistent header without moving content. Pending state is owned by
the transaction serial: supersession transfers it, and abort or commit clears
it without allowing an older operation to clear a newer indicator.

Committed-document identity is tracked independently from an address-bar URL
whose handler is still pending, so repeating that pending destination starts a
new transaction instead of being misclassified as an active-route no-op.

Same-origin English/Russian switches are enhanced only after the destination
document and its locale runtime have both been prepared. One synchronous
commit updates metadata, `lang`/locale, the localized contents of the
persistent site-header host, skip link, footer, `<main>`, theme-control labels,
Web Awesome locale marker, and announcement. Theme state, the live Document,
site-header instance, loaded modules, and CSS remain in place.

A shared build/runtime locale validator requires the complete ordered site
locale set, configured default, one current option, exact canonical/hreflang
and `x-default` targets, matching switcher links, and one polite notice for each
unavailable translation. A fetched contradiction is malformed and cannot
commit.

Build/shell mismatch, malformed responses, native-only routes, and locale
chunk failures commit nothing. They use one per-destination session guard and
one native reload/assignment; a failed module is not retried inside the old
module map. These are the accepted Gate 4.2 semantics on which the route cache
depends.

## Gate 4.3 Native route LRU

The coordinator now stores validated route-owned prototypes in an inert native
`<template>` LRU for the lifetime of the current `Document`. Its cache key is
the build ID plus normalized same-origin URL without the fragment. The direct
boot route is captured from the already-parsed document; a fetched route is
inserted only by the winning transaction after validation and commit.

Warm activation performs one fresh `template.content` clone, zero HTML
requests, and zero `DOMParser` calls. Live form values, `<details>` state,
selection, Custom Element instances, listeners, observers, and timers are not
cache state. Removed components receive their normal `disconnectedCallback()`;
the next activation connects fresh instances.

The initial measured bounds are 10 entries and 2 MiB estimated weight, using
`source bytes + 256 bytes × prototype nodes`. The current 39-document corpus is
654,375 source bytes and 16,955 parsed nodes; its ten heaviest complete
documents total approximately 1.90 MiB by the same conservative heuristic.
The active route is pinned until the next successful commit. Entry and weight
limits evict independently, oversize entries are not retained, and
`Cache-Control: no-store` responses may commit but never enter the LRU.
The ordinary artifact server exposes HTML as `no-cache`; live-reload responses
remain `no-store`.

A separate in-flight registry reuses one fetch and one parse when the same
pending destination is selected again. Its cancellation belongs to the
coordinator rather than the first `NavigateEvent`: a different destination
aborts orphaned work, while a replacement consumer for the same route retains
the shared preparation. Failed, aborted, or superseded work cannot populate
the cache.

The raw, non-gating MPA measurement can be generated after a production build:

```nu
^npm run build
^npm run measure:baseline
```

CI runs the measurements with the pinned Chromium profile and uploads
`artifacts/baseline/gate-4-mpa-baseline.json` plus
`artifacts/baseline/gate-4.3-route-cache-baseline.json` and
`artifacts/baseline/gate-4.3-route-cache-stress.json`. The mixed baseline
requires one HTML fetch/parse for a cold route and zero for a warm route while
preserving one materialization, one commit, locale/focus/announcement state,
and shell identity. The stress artifact records 100 route operations, forced
idle/GC, maximum cache occupancy and heap growth. A single run remains
diagnostic input for latency and memory; initial direct load and cold reload
enforce a `0.01` CLS ceiling.

## Gate 4.4 Dynamic feature graph

Route-owned JavaScript now loads through a closed registry whose four IDs map
to literal dynamic imports. Validated routes classify those imports as
`critical`, `deferred`, or `viewport`: critical modules settle before a visible
commit, deferred modules start after commit, and viewport modules use a 256 px
near-viewport `IntersectionObserver`. Late imports are guarded by route
ownership, so they cannot mutate a route that has already been replaced.

esbuild 0.28.1 remains the browser bundler. The build verifies the emitted
production `metafile`, preserves it in a fingerprinted bundle-manifest asset,
writes a fingerprinted feature-graph asset, and projects their exact URLs plus
a deterministic request manifest into every schema-v8 route entry. Concurrent
feature requests share one
application promise, while the browser module map reuses each successfully
evaluated module by URL. No route data becomes an import specifier. esbuild
preserves the literal `import()` edges without injecting a dependency-preload
wrapper, so each phase uses the native module graph and a failed chunk can
cross into the existing fresh-module-map fallback boundary.

`pinega-diagram-viewer` is a viewport-loaded Lit island around canonical light
DOM. The SSG SVG, caption, transcript, and model link remain canonical with or
without JavaScript. Lit receives only an initially empty component-local root
inside the transcript. `lit` is a pinned direct dependency; the npm lock graph
has one root installation for the shared runtime packages, and metafile plus
browser checks prove that Web Awesome and the Pinega island consume one runtime
chunk and one set of runtime version markers.

Critical chunk failure commits nothing and performs one guarded native
navigation into a fresh module map. Deferred and viewport failure preserve the
semantic fallback.

## Gate 4.5 Intent-aware prefetch

Eligible same-origin route links now prepare through the coordinator's own
validated HTML path. Mouse/pen hover requires an 80 ms dwell, focus prefetches
immediately, and primary unmodified pointerdown publishes an in-flight route
before click navigation. Active work is bounded to two requests with eight
queued keys; pointer intent outranks focus and hover, duplicate keys coalesce,
and foreground navigation cancels unrelated speculation while reusing the
selected route's promise.

Prefetch is blocked while hidden/offline, under `saveData`, and for reported
`slow-2g`, `2g`, or `3g` effective connections. Requests use low Fetch
priority. Speculative templates are evicted before visited routes, `no-store`
responses are never retained, and route feature modules do not execute until
foreground navigation reaches their existing phase boundary.

Schema-v8 `site-manifest.json` publishes the policy. Runtime schema-v1 metrics
are available through `pinega:prefetch-metrics` and
`window.__PINEGA_PREFETCH_METRICS__`: completed prefetches, cache/in-flight
hits, hit rate, source/transfer bytes, and retained versus finalized unused
bytes. `wasted = prefetched - useful` at the observation point. CI additionally
uploads `artifacts/baseline/gate-4.5-intent-prefetch-baseline.json`, whose
controlled two-prefetch/one-hit scenario proves a 0.5 hit rate and balanced
byte accounting without setting a product performance budget.

## Gate 4.6 Stateful Lit island

The diagram viewer is the first stateful Pinega-owned Lit production component.
Opening its existing native transcript reveals a model inspector. Explicit user
intent starts one component-local `@lit/task`: it fetches only the exact
same-origin JSON endpoint for that diagram and locale, enforces JSON and a
streaming 64 KiB bound, validates the semantic model, and renders a safe local
summary with loading, complete, error, close, and retry states. A completed
instance reopens without another request.

All connection-owned listeners share an `AbortController`; disconnect aborts
them and any pending model request, while reconnect restarts only unfinished
expanded work. A fresh clone clears copied Lit markers and owns independent
state. The SSG figure, transcript, and download remain the no-JavaScript
fallback, and the default closed view does not change existing visual
baselines.

The site manifest explicitly records component-local ownership and disables
Lit route loading, routing, global rendering, and global hydration. The emitted
graph additionally proves that `@lit/task@1.0.3` is reachable only through the
diagram feature; it is never a shell or navigation dependency.

## Gate 4.7 HTTP and release review

The build fingerprints every `/assets/` URL and generates a non-overlapping
Cloudflare `_headers` policy: fingerprinted assets are immutable for one year,
while HTML and mutable manifests always revalidate. Successful HTML routes must
return that exact cache policy; provider-served nearest 404s remain `no-store`.
There is no Service Worker.
`/.well-known/pinega-release.json` inventories every public file by URL,
status, bytes, SHA-256, media type, and cache policy. Local checks reconstruct
that inventory; the deployment suite verifies every served byte plus the real
HTTPS headers and the provider's `no-store` nearest-404 behavior. It records
`etag-304` when Pages exposes a validator and otherwise requires a forced full
`200` to reproduce the exact HTML bytes. Artifact identity remains the
independent per-URL SHA-256 inventory rather than being overloaded onto an
optional HTTP validator.

CI packages and attests the same directory that passed tests, verifies the
attestation before Direct Upload, and never rebuilds it in the deploy job. The
Gate 4.7 review artifact combines the zero-retry Chromium desktop/mobile,
Firefox, and WebKit matrix; axe and keyboard-trap evidence; visual baselines;
and cold/warm desktop/mobile FCP, LCP, CLS, Speed Index, and TBT diagnostics.
Lighthouse provides lab evidence only and is not the sole release oracle.
The Playwright runner remains configured with zero test retries. Direct-load
setup has one Firefox-only transport recovery for Playwright issue #42183: it
may supersede a timed-out `page.goto()` only after the requested URL,
`readyState=complete`, and Pinega readiness marker are already proven through
`page.evaluate()`. The replacement navigation must still return the expected
HTTP status, except that an expected `200` may revalidate as the exact-build
test server's `304`; incomplete, wrong, non-cacheable 404, or other documents
fail without recovery.

## Initial-render visual-stability contract

`tests/browser/visual-stability.spec.ts` tests time, not only the final DOM. It
holds the fingerprinted main module and Web Awesome Core chunk at separate
boundaries and compares declared static regions across authored HTML, Pinega
shell upgrade, Web Awesome readiness, and an explicit reload. Every stage must
retain identical geometry, direct static text, and computed visual styles for
elements and their pseudo-elements; unexpected layout shifts have a `0.001`
per-cycle ceiling. Chromium stage screenshots are retained as review evidence;
cross-engine pass/fail uses the deterministic signatures because Playwright's
Firefox and WebKit screenshot path waits for the deliberately gated document
lifecycle. Font rasterisation noise is not treated as a layout or style change.

`data-visual-stability-region` declares a static region. Descendants are part of
that contract by default. A genuinely dynamic subtree may use
`data-visual-stability-dynamic`: its content is excluded, but the marked host's
bounding box and visual container styles remain stable. This permits, for
example, a changing image inside a fixed-size slot without permitting the slot
to resize, move surrounding content, or change padding/background during load.

## Topic filter versus search

`pinega-doc-search` is intentionally a progressive metadata/topic filter, not a
full-text search engine. `/docs/` contains real canonical documentation cards in
static HTML before JavaScript runs. Enhancement performs Unicode-normalised AND
matching and hides groups with no matching pages.

Site-wide full-text search remains a later gate, after documentation, blog, and
paper content share a stable publishing/discovery model.

## Gate 5.1 dual-target research publication

The first deployable publication slice compiles one bilingual Typst specimen
to responsive semantic HTML and exact paged PDF. Global Typst HTML remains
disabled; only the explicit `dual-target` publication profile is allowlisted.
The build validates the content-index/research-registry join, accepts one inert
article from standalone Typst HTML, replaces its shared diagram placeholder,
and inventories both PDF byte streams in the exact release artifact.

The full scope, security boundary, routes, reproducibility contract, and later
Gate 5 exclusions are in
[`docs/web-publication-gate-5.md`](../docs/web-publication-gate-5.md).

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

Initial-render controls and static labels follow the same ownership rule. The
theme and mobile-navigation controls are native buttons, and programme labels
are native spans; they do not depend on a later vendor Custom Element upgrade.
A build-owned bootstrap selects the stored or system colour scheme before the
main stylesheet is applied, so the first rendered frame already uses the final
theme geometry and colours.

## Shared semantic diagrams

Canonical renderer-independent models live under `design/diagrams/models/`.
The build creates a temporary Node-only renderer bundle, validates and lays out
each model, and replaces explicit `PINEGA_DIAGRAM` placeholders with complete
accessible inline SVG figures.

The temporary renderer is deleted before the build completes. Generated figures
retain captions, direct SVG titles/descriptions, keyboard-reachable viewports,
text transcripts, layout-profile identity, and links to canonical JSON. The
Documentation Gate 2 milestone adds no new diagram family or promoted layout
profile.

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

For browser validation on RHEL, use the Playwright image matching the committed
Web dependency (`1.62.1` at this milestone):

```nu
^podman run --rm --network host -v $"(pwd):/work" -w /work/web \
  mcr.microsoft.com/playwright:v1.62.1-noble npm run test:browser
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

## Cloudflare commit previews

Pull requests are prepared for preview-only Cloudflare Pages Direct Upload.
GitHub Actions builds `web/dist` twice and rejects any byte-level difference,
then validates the exact second directory, embeds
`/.well-known/pinega-deployment.json`, archives it deterministically, records
SHA-256, attests the archive, deploys it without a second checkout or build, and
then tests the immutable HTTPS URL.

The live path uses the `Pinega Preview` GitHub Environment and deploys
same-repository pull requests to the `pinega` Pages project. Fork pull requests
remain validation-only. Production deployment is not part of this workflow.
The complete delivery, trust-boundary, configuration, and retention contract is
documented in
[`docs/web-delivery-gate-1.md`](../docs/web-delivery-gate-1.md).

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
- `pinega-doc-search`: progressive filtering over registry-generated real docs
  cards; it is not site-wide full-text search;
- `pinega-diagram-viewer`: viewport-loaded stateful Lit island with a
  component-local semantic-model Task around canonical light DOM;
- build-time documentation navigation/breadcrumb/provenance projections;
- build-time semantic diagrams: histories, version chains, and lifecycles with
  accessible SVG and textual projections.

## Validation

```nu
^npm run tokens:check
^npm run typecheck
^npm run test:unit
^npm run check:aria-coverage
^npm run build
^npm run check:build
^npm run test:aria
^npm run test:browser
^npm run test:stability
^npm run test:visual
^npm run review:lighthouse
```

Tests cover registered routes and fragments, content-registry v4 contracts,
master-brand and maturity claims, public navigation, component-lab isolation,
documentation decomposition and generated discovery surfaces, no-JavaScript
catalogue completeness, browser behaviour, keyboard interaction, accessibility,
responsive overflow, and committed visual baselines.
The accessibility-tree layer adds a schema-validated state registry, one
strict cross-browser serializer-conformance baseline, and explicit DOM-only
assertions for properties that Playwright 1.62 does not emit. Its PR 2 corpus
also compares nine authored/shell/ready load and reload timelines, 13
direct-versus-enhanced route archetypes, two explicit native-policy
archetypes, and pending/commit/cancel/supersession semantics. Exact YAML
mismatches attach actual and reference trees; component-owned transitions are
closed registry entries deferred to their PR 3 state oracles. See
[`tests/accessibility/README.md`](tests/accessibility/README.md) for ownership
and baseline-update policy.
Gate 4.2 additionally covers A→B→C supersession, pending Back, focus and route
announcements, scroll/fragment semantics, locale transactions, deployment
skew, failed locale chunks, and guarded native fallback.
The closure matrix also exercises response-body and locale-module
supersession, Back/Forward after eleven pushed routes, a missing fragment,
direct-versus-enhanced ARIA snapshots, busy-state geometry and ownership,
malformed locale/feature contracts, and a persistently malformed destination.
Gate 4.3 adds boot/fetched warm-hit proofs, zero-network/zero-parse
instrumentation, `no-store`, in-flight reuse, fresh component/form/details
state, LRU bounds/eviction, post-eviction cold replay, and the 100-route
forced-GC study. Gate 4.4 adds the closed literal registry, phase ordering,
module-map reuse, esbuild metafile verification, deterministic per-route
request manifests, Lit/Web Awesome deduplication, and critical chunk-failure
fallback. Gate 4.5 adds dwell/focus/pointer intent, bounded scheduling,
foreground in-flight reuse, Save-Data/slow-network policy, speculative-first
eviction, feature-phase isolation, and hit/wasted-byte telemetry. Gate 4.6 adds
the stateful diagram inspector, component-local `@lit/task`, symmetric
connection cleanup, pending-request abort/restart, no-JavaScript fallback,
localized error/retry, and fresh-clone isolation while statically forbidding
Lit routing, global rendering, and hydration. The
initial-render stability gate additionally widens both main-module
and vendor-upgrade windows, compares pre-/mid-/post-upgrade frames, repeats the
contract after reload, attributes unexpected shifts, and enforces the MPA CLS
budget.
Both local and deployed Playwright configurations use zero retries, so CI does
not convert a first-attempt failure into a passing gate.
