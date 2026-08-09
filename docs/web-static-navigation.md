# Pinega Web Gate 4.0 — Static-first navigation contract and MPA baseline

Status: **PROPOSED NEXT MILESTONE** until the implementing pull request is
merged. The contract in this document then becomes the pre-condition for Gate
4.1. It does not claim that same-document navigation, route caching, prefetch,
or dynamic route-feature imports are implemented.

Baseline repository state: `main@b4b4ef0` after Gate 3B.

## Decision

Pinega retains a complete static HTML document at every registered URL. Gate 4
adds same-document navigation only as progressive enhancement over that MPA.
Before a coordinator may replace any visible content, the build must expose a
versioned, machine-checkable document contract and the project must preserve a
raw measurement of the existing MPA cost.

Gate 4.0 therefore adds only:

- document, route, build, and shell identity;
- a closed route-feature classification projected from semantic HTML;
- build-time validation of route-owned metadata;
- deterministic valid and invalid contract fixtures;
- a reproducible, non-gating Chromium MPA measurement artifact.

It deliberately adds no client router or navigation interception.

## Inventory at the Gate 4 boundary

| Surface | Current implementation |
|---|---|
| Publishing model | 39 localized static HTML variants from 20 logical entries |
| Locale model | English unprefixed routes and Russian `/ru/` routes; content registry schema v3 |
| Build | Node 26 build script with esbuild 0.28.1; this repository does not currently use Vite |
| UI foundation | Native Custom Elements plus Web Awesome 3.11.0 |
| Lit | Lit 3.3.3 is present transitively through Web Awesome; Pinega-owned Lit components do not yet exist |
| Runtime loading | One eager `main.js` entry plus esbuild-generated dependency chunks |
| Navigation | Native full-document navigation only |
| Validation | Unit, production-build, Chromium/Firefox/WebKit, accessibility, and visual checks against one exact build |
| Deployment | One tested artifact receives separate delivery provenance and is uploaded to Cloudflare Pages |

This inventory changes an earlier planning assumption: future dynamic-import
work must be verified against the actual esbuild chunk graph unless a separate
review deliberately changes bundlers.

## Architectural invariants

1. **Full document.** Every public route remains independently loadable,
   printable, crawlable, and meaningful without JavaScript.
2. **Single navigation owner.** Only the future `NavigationCoordinator` may
   decide interception, preparation, commit, or hard fallback.
3. **Validate before commit.** Unvalidated response content never enters the
   active DOM.
4. **One visible commit.** Route-owned DOM and metadata change synchronously,
   without an `await` inside the commit section.
5. **Latest navigation wins.** Superseded work cannot update DOM, metadata,
   focus, scroll, cache, or success state.
6. **One build per live `Document`.** A build or shell mismatch requires a hard
   navigation; deployments are never mixed inside one document.
7. **Truthful language.** `lang`, route locale, content language, canonical
   metadata, and missing-translation UI remain consistent.
8. **Prototype cache only.** A later route cache stores inert templates and
   immutable metadata, not live page state.
9. **Local component ownership.** Lit may own only a component render root;
   it never owns global `<main>` or document navigation.
10. **Progressive fallback.** Unsupported APIs, ineligible targets, malformed
    responses, and unknown failures end in native document navigation.

## Versioned HTML contract

Every generated route has exactly one root contract:

```html
<html
  lang="en"
  dir="ltr"
  data-locale="en"
  data-page="documentation"
  data-pinega-contract="1"
  data-pinega-build="sha256-…"
  data-pinega-shell="4.0"
>
```

and exactly one route root:

```html
<body data-pinega-route="documentation">
  <main
    id="main-content"
    tabindex="-1"
    data-pinega-route="documentation"
    data-pinega-features="doc-topic-filter"
    data-pinega-critical-features=""
  >
```

The invariants checked without a browser are:

- document contract `1` and shell compatibility version `4.0` are exact;
- `data-page`, body route identity, and main route identity agree;
- the current locale model requires `lang === data-locale`;
- direction is `ltr` or `rtl`;
- the route root is the only `<main>` and is focusable programmatically;
- feature lists are unique, lexically ordered, allowlisted, and equal to the
  features detected in the route subtree;
- critical features are a subset of route features;
- title, description, canonical, alternates, and language metadata are
  internally consistent.

The HTML `lang` contract follows the HTML Standard's document-language
semantics. Custom `data-*` attributes carry Pinega-specific non-visible
contract data without changing native semantics.

## Build and shell identity

`data-pinega-build` is not a branch name, timestamp, abbreviated commit, or
deployment alias. The build computes:

```text
sha256-normalized-artifact-v1(
  sorted relative output paths
  + output bytes with the build-ID slots replaced by one fixed token
)
```

The full 256-bit value is embedded in every generated HTML document and in
`site-manifest.json`. Replacing the self-referential slots with one token makes
the digest deterministic while still covering the actual HTML, JavaScript,
CSS, source maps, copied content, diagrams, and discovery output.

`.well-known/pinega-deployment.json` is the only exclusion. It is delivery
provenance added after the exact application build has passed validation; it
does not change the HTML/shell compatibility graph. The build checker
recomputes the normalized digest and rejects any undeclared artifact change.

`data-pinega-shell="4.0"` is a compatibility version. It is bumped only when an
old persistent shell cannot safely consume a new route contract, not for every
content edit.

## Route-feature contract

Gate 4.0 does not add dynamic imports. It establishes their closed vocabulary
and derives route requirements from the real semantic elements, avoiding a
second manually synchronized per-locale route table.

| Feature ID | Semantic element | Current owner | Future loading class |
|---|---|---|---|
| `benchmark` | `pinega-benchmark` | Native element | critical |
| `code-example` | `pinega-code-example` | Native element | deferred |
| `diagram-viewer` | `pinega-diagram-viewer` | Contract fixture for future Lit island | viewport |
| `doc-topic-filter` | `pinega-doc-search` | Native element | deferred |

`pinega-site-header`, `pinega-hero`, and `pinega-evidence` remain shell-eager in
the current boundary. An unknown `pinega-*` element under route `<main>` is a
build error until it is explicitly classified. Web Awesome `wa-*` elements are
vendor primitives and are not Pinega route feature IDs.

The generated site-manifest schema is version 4 and projects `features` and
`criticalFeatures` for every localized route. Gate 4.4 may change how those
modules are delivered, but it must not silently change their meaning.

## Route-owned metadata whitelist

The future coordinator may update only this route-owned set:

| Contract surface | Cardinality / rule |
|---|---|
| `<title>` | exactly one, non-empty |
| `meta[name="description"]` | exactly one, non-empty |
| `link[rel="canonical"]` | zero or one; absolute, same-origin, fragment-free |
| `link[rel="alternate"][hreflang]` | unique languages; canonical routes require self and `x-default` |
| `meta[property^="og:"]` | unique property names |
| `meta[name^="twitter:"]` | unique names |
| `<html lang>` and `dir` | exact destination document values |
| body route marker | exactly the route ID |
| primary-navigation `aria-current="page"` | at most one inside the primary navigation region |

Charset, viewport, stylesheets, executable scripts, Web Awesome project
metadata, favicon, and shell-owned theme state are not route-owned and cannot
be copied from a fetched document during Gate 4.1.

## URL identity and response boundary

The normalized route identity contains:

```text
origin + normalized pathname + exact search
```

The fragment is excluded from document/cache identity and retained for
post-commit scrolling. Search parameter order and tracking parameters are not
rewritten. `/docs` and `/docs/` remain different until server/SSG redirect
policy resolves them. Credentials, non-HTTP(S) URLs, and cross-origin URLs are
ineligible.

Gate 4.0 fixtures define the conservative Gate 4.1 fallback boundary:

- non-2xx status: hard navigation;
- redirect: hard navigation;
- final response URL different from the requested normalized URL: hard
  navigation;
- media type other than `text/html`: hard navigation;
- malformed document contract: hard navigation;
- build or shell mismatch: hard navigation.

This policy can be relaxed only in a later, separately tested contract change.

## Deterministic fixtures

`web/tests/fixtures/navigation/` covers:

| Fixture | Purpose |
|---|---|
| ordinary route | minimal valid contract |
| long documentation route | anchors for later scroll restoration tests |
| Lit feature route | future `diagram-viewer` ownership and feature classification |
| English/Russian pair | reciprocal locale metadata |
| missing translation | self + `x-default` only, with current-language notice |
| old/new build pair | deployment mismatch and hard-fallback decision |
| malformed document | rejected before preparation |
| 404 response | status fallback |
| redirect response | redirect fallback |
| non-HTML response | media-type fallback |
| page-class registry | one real generated representative for every registered content type |

Fixtures are test-only and are not copied into the deployable site.
`page-classes.json` is checked against content registry v3, so introducing a new
content type requires an explicit representative before Gate 4 checks pass.

## MPA performance baseline

`npm run measure:baseline` runs against the already-built production artifact,
not the development server. The CI profile is pinned to Ubuntu 24.04, Node
26.7.0, Playwright 1.62.1, and its matching Chromium.

The one-run diagnostic records six scenarios:

1. direct homepage load;
2. homepage to Technology;
3. Back/Forward traversal;
4. English to Russian documentation switch;
5. component laboratory with Web Awesome/Lit;
6. cache-disabled hard reload as a cost proxy for deployment replacement.

Actual two-build compatibility is not simulated by relabelling that proxy; it
is covered by the old/new deterministic fixtures and becomes a browser race
test in Gate 4.2.

Raw output includes action-scoped request count and encoded bytes by resource
type, Navigation Timing, LCP, CLS, event duration, long-task count/duration,
selected Chrome performance counters as before/after snapshots and reset-aware
monotonic deltas,
JavaScript heap usage/delta, build ID, browser, viewport, runner CPU/memory
profile, and source/tested commit identities. Warm-up pages are outside the
measurement boundary; a zero-request Back/Forward result is retained when
Chromium restores from BFCache. A standardized theme-toggle interaction on the
final document supplies an event-timing probe. CDP counters are renderer-scoped:
raw before/after values are always retained, while a monotonic delta is `null`
and the metric is named in `counterResets` when a document navigation resets
that counter. CI uploads
`web/artifacts/baseline/gate-4-mpa-baseline.json` with diagnostics.

No numeric performance budget is derived from this single run. Existing
JavaScript/CSS byte budgets remain enforced; the new values are evidence for
comparisons with Gate 4.1 and later stages.

## Gate 4.0 post-conditions

- Every generated route is rejected at build time if its contract is malformed.
- All route documents and site-manifest identify one normalized application
  build and one compatible shell.
- Site-manifest schema v4 exposes the feature graph and metadata ownership
  policy without changing content registry schema v3.
- Ordinary, long, Lit, locale, missing-translation, failure, and deployment
  fixtures are deterministic unit inputs.
- CI produces a raw MPA baseline on the pinned browser profile.
- No route interception, cache, prefetch, global Lit render root, Service
  Worker, or behavior change has entered production.

## Gate 4.1 entry condition

The first coordinator PR may start only after Gate 4.0 is merged and its checks
pass. Gate 4.1 must consume this contract; it may not replace it with an
unversioned ad-hoc parser. Its first vertical slice is:

```text
eligible same-origin GET navigation
→ fetch
→ validate this exact contract
→ synchronously commit route-owned state
→ native hard-navigation fallback on every rejected branch
```

Caching, prefetch, dynamic feature imports, and Lit migration remain outside
that PR.

## Normative and implementation references

- [HTML Standard — the `html` element and document language](https://html.spec.whatwg.org/multipage/semantics.html#the-html-element)
- [HTML Standard — custom `data-*` attributes](https://html.spec.whatwg.org/multipage/dom.html#embedding-custom-non-visible-data-with-the-data-*-attributes)
- [HTML Standard — canonical links](https://html.spec.whatwg.org/multipage/links.html#link-type-canonical)
- [HTML Standard — Navigation API](https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigation-api)
- [Navigation Timing Level 2](https://www.w3.org/TR/navigation-timing-2/)
- [Event Timing](https://w3c.github.io/event-timing/)
- [Layout Instability](https://wicg.github.io/layout-instability/)
- [Long Tasks](https://w3c.github.io/longtasks/)
- [Playwright CDP session](https://playwright.dev/docs/api/class-cdpsession)
- [parse5 — WHATWG-compatible Node HTML parser](https://github.com/inikulin/parse5)
