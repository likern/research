# Pinega Web Gate 4 — Static-first navigation and coordinator contract

Gate 4.0 status: **ACCEPTED BASELINE**, merged as PR #27.

Gate 4.1 status: **ACCEPTED BASELINE**, merged as PR #28.

Gate 4.2 implementation status: **ACCEPTED BASELINE**, merged as PR #29.

Gate 4.2 closure status: **ACCEPTED BASELINE**, merged as PR #30. The
closure adds the missing busy, locale-consistency, long-history, cancellation,
accessibility, malformed-feature, and persistent-fallback proofs and makes a
retried browser test a failure instead of evidence.

Gate 4.3 status: **ACCEPTED BASELINE**, merged as PR #31. It adds the bounded
native-template LRU, boot-route capture, eviction, `no-store` policy, and
same-route in-flight preparation reuse.

Gate 4.4 status: **ACCEPTED BASELINE**, merged as PR #32. It adds the closed
dynamic-feature registry, critical/deferred/viewport scheduling, a verified
production bundle graph based on the esbuild metafile, browser module-map
reuse, and a Pinega Lit island sharing one Lit runtime with Web Awesome.

The initial-render stability closure is **ACCEPTED BASELINE**, merged as PR
#33. It proves static-region geometry and style stability across Pinega and Web
Awesome upgrade boundaries.

Gate 4.5 status: **ACCEPTED BASELINE**, merged as PR #34. It adds
hover/focus/pointer intent, bounded speculative route preparation,
save-data/slow-network policy, and explicit hit-rate and wasted-byte
instrumentation.

Gate 4.6 status: **ACCEPTED BASELINE**, merged as PR #35. It turns the diagram
viewer into the first stateful production Lit island, establishes symmetric
connect/disconnect cleanup, and confines `@lit/task` to component-local model
loading.

Gate 4.7 status: **IMPLEMENTATION UNDER REVIEW**. It closes the HTTP,
deployment, and release boundary over immutable fingerprinted assets,
revalidated HTML, exact deployed bytes, and one cross-browser, accessibility,
visual, and performance review record.

Gate 4.7 base repository state: `main@c4c0716db` after PR #35.

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
| Build | Node 26 build script with esbuild 0.28.1 for both the browser graph and the temporary Node diagram renderer |
| UI foundation | Native Custom Elements plus Web Awesome 3.11.0 |
| Lit | One root Lit 3.3.3 installation shared by Web Awesome and the stateful Pinega diagram island; root `@lit/task` 1.0.3 is island-local |
| Runtime loading | Fingerprinted shell entry plus allowlisted esbuild dynamic entries classified as critical, deferred, or viewport |
| Navigation | Gate 4.5 transactional Navigation API coordinator with bounded intent prefetch and an in-memory native-template LRU |
| Validation | Unit, production-build, Chromium/Firefox/WebKit, accessibility, and visual checks against one exact build |
| Deployment | One tested artifact receives separate delivery provenance and is uploaded to Cloudflare Pages |

Gate 4.4 retains esbuild as the single project bundler. Correctness is checked
against esbuild's emitted production `metafile` rather than inferred from
source imports or hand-authored preload hints. The verifier consumes the real
output graph after code splitting and before the artifact is accepted.

## Architectural invariants

1. **Full document.** Every public route remains independently loadable,
   printable, crawlable, and meaningful without JavaScript.
2. **Single navigation owner.** Only `NavigationCoordinator` may
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
8. **Prototype cache only.** The route cache stores inert templates and
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
  internally consistent;
- the language switcher declares the configured default locale and one ordered
  option for every site locale, with exactly one current option;
- available locale targets equal their canonical `hreflang` peers, unavailable
  locales publish no peer and own exactly one localized polite status notice;
- `x-default` equals the configured default-locale canonical and every metadata
  URL remains on the trusted canonical origin;
- authored documents never contain coordinator-owned `main[aria-busy]` state.

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

Gate 4.0 established the closed vocabulary and derived route requirements from
the real semantic elements. Gate 4.4 now binds every ID to one literal import
and loading phase without adding a second per-locale route table.

| Feature ID | Semantic element | Runtime owner | Loading class |
|---|---|---|---|
| `benchmark` | `pinega-benchmark` | Native element | critical |
| `code-example` | `pinega-code-example` | Native element | deferred |
| `diagram-viewer` | `pinega-diagram-viewer` | Lit light-DOM lifecycle island | viewport |
| `doc-topic-filter` | `pinega-doc-search` | Native element | deferred |

`pinega-site-header`, `pinega-hero`, and `pinega-evidence` remain shell-eager in
the current boundary. An unknown `pinega-*` element under route `<main>` is a
build error until it is explicitly classified. Web Awesome `wa-*` elements are
vendor primitives and are not Pinega route feature IDs.

The generated site-manifest schema is version 8. It projects `features`,
`criticalFeatures`, and deterministic shell/critical/deferred/viewport request
manifests for every localized route. It also publishes the versioned intent
prefetch signals, scheduler/network bounds, request priority, and metrics
contract. Fingerprinted `feature-graph-<sha256>.json` and
`bundle-manifest-<sha256>.json` assets record the verified source-to-chunk
mapping and underlying esbuild metafile; their exact URLs are published by the
site manifest.

## Route-owned metadata whitelist

The future coordinator may update only this route-owned set:

| Contract surface | Cardinality / rule |
|---|---|
| `<title>` | exactly one, non-empty |
| `meta[name="description"]` | exactly one, non-empty |
| `meta[name="robots"]` | zero or one; removed when the destination does not own it |
| `link[rel="canonical"]` | zero or one; absolute, same-origin, fragment-free |
| `link[rel="alternate"][hreflang]` | unique languages; canonical routes require self and `x-default` |
| `meta[property^="og:"]` | unique property names |
| `meta[name^="twitter:"]` | unique names |
| `<html lang>`, `dir`, `data-page`, and `data-locale` | exact destination document values |
| body route marker | exactly the route ID |
| marked language-switcher slot and translation notices | exact destination route peers and localized fallback state |
| site brand route marker | current only on the locale homepage |
| primary-navigation `aria-current="page"` | at most one inside the primary navigation region |

Charset, viewport, stylesheets, executable scripts, Web Awesome project
metadata, favicon, theme-color, and shell-owned theme state are not route-owned
and cannot be copied from a fetched document during Gate 4.1.

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
- Site-manifest schema v4 exposes the native-route policy, feature graph, and
  metadata ownership policy without changing content registry schema v3.
- Ordinary, long, Lit, locale, missing-translation, failure, and deployment
  fixtures are deterministic unit inputs.
- CI produces a raw MPA baseline on the pinned browser profile.
- No route interception, cache, prefetch, global Lit render root, Service
  Worker, or behavior change has entered production.

## Gate 4.1 entry condition

This entry condition is satisfied: Gate 4.0 is merged and its required checks
passed. Gate 4.1 consumes that contract; it does not replace it with an
unversioned ad-hoc parser. Its vertical slice is:

```text
eligible same-origin GET navigation
→ fetch
→ validate this exact contract
→ synchronously commit route-owned state
→ native hard-navigation fallback on every rejected branch
```

Caching, prefetch, dynamic feature imports, and Lit migration remain outside
that PR.

## Gate 4.1 implementation contract

### Coordinator boot and ownership

The coordinator starts synchronously from the fingerprinted eager main entry,
before the asynchronous Web Awesome initialization. It first validates the
active document identity. It then has one of four observable states on the
document root:

| Runtime marker | Meaning |
|---|---|
| `data-pinega-navigation="enhanced"` | the active public route has one Navigation API owner |
| `data-pinega-navigation="native"` | the browser does not expose the required API |
| `data-pinega-navigation="native-policy"` | the active route requires a complete document |
| `data-pinega-navigation="error"` | the active document failed its own coordinator pre-condition |

There is no History API router or click-handler polyfill. If Navigation API is
unavailable, semantic links retain the static MPA behavior.

`component-lab` and `not-found` are a closed native-only route-ID set. They have
shell or SEO state that differs from the public persistent shell: the component
laboratory has no public footer and is intentionally English-only; a not-found
document owns `robots=noindex` and an HTTP error status. They cannot be entered
or exited through a partial route commit.

### Eligibility policy

The centralized `navigate` listener classifies the event synchronously:

| Event | Gate 4.1 behavior |
|---|---|
| same-origin ordinary HTTP(S) anchor/area GET | intercept |
| traversal between entries created by this coordinator | intercept |
| exact active URL | cancel with zero fetch and zero commit |
| fragment-only navigation | native |
| reload | native |
| cross-origin, credentialed, or non-HTTP(S) URL | native |
| download, form, explicit `target`, or unknown programmatic source | native |
| language-selector link to another locale | native |
| hard-fallback retry target | native |

Gate 4.1 keeps cross-locale navigation native because primary navigation,
footer text, theme-control messages, and Web Awesome translation state belong
to the actual document locale. Same-document multilingual transitions require
the broader shell/locale transaction specified for Gate 4.2.

### Prepare phase

An eligible navigation performs exactly one uncached route HTML `fetch()` in
this gate. The Navigation API event's `AbortSignal` is passed to fetch. Before
any visible mutation the coordinator rejects:

- non-2xx status, redirects, changed final response URL, and non-HTML media;
- empty bodies and malformed DOM/document contracts;
- contract, build, or shell incompatibility;
- locale changes and native-only route IDs;
- inconsistent route identity, metadata, feature lists, language slots, or
  route `aria-current` state;
- script, style, base, or stylesheet ownership inside route `<main>`.

Parsing uses a detached `DOMParser` document. Only validated route-owned nodes
are imported. Fetched executable scripts, stylesheets, and an arbitrary body or
head are never installed.

### Synchronous visible commit

After all asynchronous preparation and the final latest-navigation check, one
function with no `await` updates:

- `<title>`, description, robots, canonical, `hreflang`, Open Graph, and
  Twitter metadata;
- `html[lang][dir][data-page][data-locale]` and the body route marker;
- the brand/primary-navigation route `aria-current` marker;
- the marked language-switcher slot and any missing-translation notices;
- exactly one `main#main-content`.

The `pinega-site-header` custom-element instance, theme state, loaded modules,
Web Awesome runtime, stylesheet graph, footer, and live `Document` remain in
place. The language slot is route-owned because its peer URL changes on every
route even when the locale does not. Its replacement remains inside the same
header instance and uses the header's existing delegated listener.

After the commit, the coordinator emits `pinega:navigation-commit`. Existing
eager custom elements upgrade/connect naturally when the new main enters the
document; the Web Awesome runtime label is refreshed synchronously when that
runtime is already available.

### Cancellation and hard fallback

Every intercepted operation receives a monotonically increasing serial in
addition to the Navigation API abort signal. A superseded handler performs no
DOM, metadata, cache, focus, scroll, fallback, or success mutation.

Expected response rejection and unknown non-abort failures emit
`pinega:navigation-fallback`, record a normalized target in `sessionStorage`,
and reload/replace the already committed destination as a full document. The
retry event is left native and the guard is cleared only after arrival, so a
malformed response cannot create a client-side interception loop.

Gate 4.1 intentionally relies on the browser's default `intercept()` focus and
scroll behavior. Explicit fragment timing, traversal scroll restoration,
focus-transfer policy, competing-navigation stress, and two-build deployment
races receive their complete behavioral contract in Gate 4.2.

### Baselines and test gates

The original Gate 4.0 MPA measurement remains reproducible by setting the
coordinator's test-only disable flag in every measured document. It therefore
continues to measure a JavaScript-enabled full-document site instead of
silently changing meaning after Gate 4.1.

The additional `gate-4.1-navigation-baseline.json` records cold route
transitions before any route cache exists. Its structural requirements are:

- one HTML fetch and zero document requests per enhanced transition;
- one visible commit per completed transition;
- unchanged `performance.timeOrigin` and one navigation timing entry;
- preserved site-header identity;
- the same build ID before and after the transition.

Browser gates cover the happy path, active route, Back/Forward, supersession,
locale/native policy, malformed and non-HTML responses, real 404, and a real
JavaScript-disabled link transition in Chromium desktop/mobile, Firefox, and
WebKit. Numeric latency budgets remain deferred until repeated evidence exists.

## Gate 4.1 post-conditions

- Public same-locale links preserve the live Document and persistent shell.
- A cold destination costs one HTML fetch, one detached parse, and one
  synchronous route commit; no cache or prefetch claim is made.
- Direct loads, reload, locale changes, native-only routes, JavaScript-off, and
  every rejected response remain complete static document navigation.
- Active-route selection performs no network or visible mutation.
- Superseded work cannot commit.
- Route cache, in-flight reuse, intent prefetch, dynamic imports, Lit islands,
  `precommitHandler`, View Transitions, Service Worker, and custom focus/scroll
  orchestration remain unimplemented.

## Gate 4.2 transactional-correctness contract

### Transaction ownership and latest-navigation-wins

Every intercepted navigation obtains an immutable token from one monotonic
`NavigationTransactionGate`. Only the latest non-aborted token may enter the
single synchronous commit section. That section rejects asynchronous and
reentrant writers; preparation remains outside it and may contain network or
module-loading awaits.

The baseline path remains `NavigateEvent.intercept({ handler })` across the
supported browser matrix. Gate 4.2 does not make `precommitHandler` a
correctness dependency. The Navigation API may therefore commit the history
entry URL before Pinega's handler has prepared visible state. Pinega's stronger
guarantee is that a late or aborted handler cannot change route DOM, metadata,
locale shell, focus, announcement, fallback state, or any future route-cache
state.

The coordinator consequently tracks committed-document identity separately
from `location.href`. A destination that is visible in the address bar but
whose handler is still pending is not an active-route no-op; a repeated click
starts a newer transaction. Fragment handling is native only when the
destination document identity matches the DOM that actually committed. A
traversal back to that already-committed document stays native, aborting the
pending transaction without fetching or recommitting identical content.

The required race oracle is:

```text
slow A starts
→ fast B commits
→ optional C commits
→ late A completes
→ URL, title, canonical, main, aria-current, focus, announcement stay B/C
```

Back or Forward while a push is pending starts a newer traversal transaction.
The pending push cannot overwrite the traversed entry even if its response is
eventually delivered after abort.

### Locale transaction

An ordinary same-origin GET language link is now eligible for enhancement.
The fetched destination must pass the same build, shell, route, metadata,
feature, language-switcher, and translation-notice validation as a same-locale
route. Before an English-to-Russian commit, the pinned Web Awesome Russian
translation chunk (or configured project translation module) must load
successfully.

One locale-changing commit updates, without an intermediate await or paint:

- title, canonical, complete `hreflang`, Open Graph/Twitter metadata;
- `html[lang][dir][data-locale][data-page]` and body route identity;
- the localized skip link and the contents of the persistent
  `pinega-site-header` host, including navigation, controls, language switcher,
  notices, and `aria-current`;
- the localized site footer and route `<main>`;
- the active Web Awesome locale marker and the route announcement.

The `pinega-site-header` custom-element instance, live `Document`, theme
classes/storage, loaded modules, and stylesheet graph remain in place. Header
controls rebind after commit, and theme controls use delegation, so the new
localized descendants remain operable. A missing translation still stays on
the actual content locale and exposes the already localized status notice; it
does not fabricate or silently substitute content.

### Focus, announcement, scroll, and fragments

Intercepted transitions use `focusReset: "manual"` and `scroll: "manual"`.
After the destination DOM has committed, the handler invokes
`NavigateEvent.scroll()` before applying the final push/replace focus target.
If a cross-route fragment has no target, it then normalizes the HTML fallback
to the document start; this closes the observed WebKit difference where the
previous entry's offset can otherwise survive.

- Successful `push`/`replace` commits first apply the platform scroll decision,
  then focus the new `main#main-content` with `preventScroll`, placing keyboard
  and assistive-technology reading order at the new content without moving the
  resolved viewport.
- Traversals do not force a new focus target; replacing focused route content
  naturally returns focus to the document while the history entry's viewport
  is restored.
- A persistent empty `role="status"` region receives the localized destination
  title in the same successful commit. Aborted and active-route no-op
  operations do not announce.
- From accepted interception until settle, only the current transaction may set
  `html[data-pinega-navigation-pending="true"]` and `main[aria-busy="true"]`.
  Its two-pixel progress surface is an absolute overlay at the lower edge of
  the persistent header, so content remains available and header/main geometry
  does not move. Supersession transfers ownership; abort or successful commit
  clears it, and reduced-motion mode removes its animation.
- For a new route without a fragment, the browser resets to the start after the
  handler settles. For a new route with a resolvable fragment, it scrolls only
  after the validated destination DOM exists; a missing fragment is normalized
  to the start synchronously. For `traverse`, it restores the entry's saved
  scroll position.
- Fragment-only navigation within the active route remains native and performs
  no HTML fetch or Pinega commit. Route targets have a shared sticky-header
  `scroll-margin` offset.

### Deployment and module failure boundary

A different valid build ID, incompatible shell, malformed contract, 404,
redirect, changed response URL, invalid media type, empty body, or failed
locale module produces no partial commit. The current transaction writes one
normalized per-destination `sessionStorage` fallback guard and performs native
navigation. If the Navigation API has already committed the destination URL,
the page reloads; otherwise it assigns the destination. The retry event is
left native, and arrival clears the guard.

A rejected locale chunk is never retried inside the failed document's module
map. Pinega performs one guarded hard reload so the destination document starts
with a fresh module map. Gate 4.2 did not introduce route feature imports;
their graph and failure policy were delivered later by Gate 4.4.

### Closure evidence and post-conditions

The production-artifact matrix covers Chromium desktop/mobile, Firefox, and
WebKit with zero Playwright retries. A failed first attempt is therefore a
blocking failure, not a hidden flaky pass. Direct-document setup is judged by
the route's HTTP probe plus one native `_self` navigation and the observable
Pinega URL/readiness contract rather than by a Playwright lifecycle waiter;
this avoids treating a stuck Firefox `page.goto()` promise as an application
failure after the trace already shows a complete response and ready DOM.

| Gate 4.2 acceptance boundary | Deterministic proof in the exact build |
|---|---|
| rapid A→B and A→B→C | late fetch and response-body completion cannot mutate the winner |
| abort during preparation | supersession is injected while `Response.text()` and the Russian locale module are pending |
| Back during pending push | the traversal owns the final URL, DOM, metadata, announcement, and commit count |
| Back/Forward after 10+ routes | eleven pushed routes are traversed fully backward and forward without increasing `history.length` or replacing the `Document` |
| scroll restoration | cold traversal restores each entry after destination DOM preparation; this is also the pre-LRU eviction-miss oracle |
| fragment present/missing | a present target resolves after commit, a missing target uses the coordinator-normalized top fallback, and same-route fragments remain native |
| focus and accessibility tree | enhanced `<main>` equals the direct-load ARIA snapshot, push focus lands on `<main>`, and the polite status snapshot names the route |
| busy state | `aria-busy`, visual progress, ownership transfer, settle cleanup, and zero header/main geometry shift are asserted |
| locale pair and missing translation | one shared build/runtime validator closes locale options, canonical/hreflang, `x-default`, targets, and notice cardinality |
| deployment/module skew | build mismatch and locale-chunk failure produce one guarded full-document transition with no partial commit |
| malformed feature ID | the closed feature allowlist rejects the fetched document before commit |
| persistent bad destination | one fallback request is followed by one native document request; malformed arrival retains the guard and cannot loop |

Actual LRU eviction did not exist in Gate 4.2. Its correctness-equivalent cold
miss is covered here; LRU ordering, bounds, eviction, and explicit
post-eviction replay are implemented and tested by Gate 4.3. Likewise, Gate
4.2 validates the feature allowlist, while Gate 4.4 supplies the generated
dynamic-import graph and route-feature chunk-failure policy. These are
downstream mechanisms, not unclosed Gate 4.2 transactional behavior.

The historical Gate 4.2 baseline established one HTML fetch per cold
transition. Gate 4.3 supersedes that measurement with a mixed cold/warm
baseline described below. Numeric latency budgets remain deferred.

After Gate 4.2, transactional navigation correctness is the accepted
pre-condition for parsed-template LRU work.

## Gate 4.3 parsed-route native-template LRU

Gate 4.3 keeps the cache inside the current live `Document`; Reload or native
fallback creates a fresh cache. It adds no Service Worker, persistent storage,
intent prefetch, feature import graph, global Lit render root, or retained live
page DOM.

### Key, value, and activation contract

The key is `buildId + U+0000 + normalized route URL`. Normalization preserves
path, trailing-slash policy, and content-affecting query order, but excludes the
fragment. A hit is accepted only after its build, shell, and document-contract
identity still match the active route. Looking up a candidate does not update
recency; only the successful synchronous commit activates and touches it.

The value is a frozen `PreparedRoute` containing immutable scalar metadata and
one detached `<template>`. Its template content stores clean prototypes of the
route `<main>`, localized shell projection, skip link, footer, and route-owned
head metadata. Activation performs one `template.content.cloneNode(true)` and
derives every commit node from that single fresh fragment. It never moves a
previous live `<main>` back into the cache.

The boot route is captured from the browser's already-parsed direct document,
without `DOMParser`. `PerformanceNavigationTiming.decodedBodySize` supplies its
source-byte weight when available; a UTF-8 serialization length is the
conservative fallback. A fetched miss records the exact UTF-8 response-body
bytes and parses once in a detached `DOMParser` document.

### Bounds and eviction study

The production corpus used to select the initial bounds contains 39 localized
HTML documents, 654,375 source bytes, and 16,955 parsed nodes. Estimated weight
uses:

```text
source UTF-8 bytes + node count × 256 bytes
```

The ten heaviest current documents total approximately 1.90 MiB under that
conservative heuristic. The first accepted configuration therefore has two
independent limits:

- 10 entries;
- 2 MiB estimated weight.

The active prototype is pinned until another route commits. A commit changes
the pin before enforcing bounds, so the previous route becomes the oldest
eligible eviction candidate while the new active prototype remains protected.
An individual route heavier than the weight limit is usable for the current
commit but is not retained. Eviction removes only detached route prototypes and
metadata; the browser module map is unaffected.

A response whose `Cache-Control` contains `no-store` is validated and may
commit, but never enters the application cache. A build mismatch clears the
whole LRU before guarded native navigation. Failed, malformed, superseded, and
aborted preparations are never inserted because insertion occurs only inside
the winning synchronous commit. The artifact test server therefore serves
ordinary HTML with `no-cache` (storable only with HTTP revalidation), while
live-reload HTML remains `no-store` and injects an early boot-policy marker so
its initial route is not captured. Final Cloudflare header budgets remain the
Gate 4.7 delivery decision.

### In-flight ownership

An independent `Map<RouteKey, Promise<PreparedRoute>>` exists outside the LRU.
The coordinator owns its internal `AbortController`; an individual
`NavigateEvent.signal` does not own the shared fetch. Repeating the same pending
destination attaches to the existing promise and produces one fetch and one
parse. Starting a different destination aborts every non-matching in-flight
entry. Settle always removes the map entry, and only the latest transaction may
materialize, cache, or commit its result.

### Evidence and observability

Every `pinega:navigation-commit` detail distinguishes `network`, `in-flight`,
and `cache`, and records network/parse/materialize counts, phase durations,
source bytes, prototype nodes, estimated weight, cache occupancy, configured
bounds, and eviction count. A warm hit is structurally required to report zero
HTML requests, zero `DOMParser` calls, one materialization, and one visible
commit.

The acceptance matrix covers:

- boot-route and fetched-route warm Back/Forward with zero network and parsing;
- LRU order, independent entry/weight limits, active pinning, oversize routes,
  and `no-store` in pure unit tests;
- eleven-route traversal with real eviction and cold replay;
- repeated pending destination reuse with one shared fetch;
- fresh form value, `<details>` state, selection, and Custom Element
  connect/disconnect on each activation, including removal of an external
  listener in `disconnectedCallback()`;
- a 100-route forced-idle/forced-GC Chromium study whose cache never exceeds
  either limit and whose post-GC heap growth must remain within a 12 MiB
  diagnostic envelope.

`gate-4.3-route-cache-baseline.json` records cold and warm same-locale and
cross-locale transitions. `gate-4.3-route-cache-stress.json` records the
100-route heap/eviction study. The numeric heap envelope detects gross leaks;
it is not a user-facing latency or Web Vitals claim.

## Gate 4.4 dynamic feature graph

### Closed registry and loading phases

The route contract remains the only data input. A closed registry maps each
allowlisted ID to one source literal and one literal `import()` callback.
Neither fetched HTML nor any dataset value can become an import specifier. The
registry validates evaluated module identity, element name, and implementation
kind before recording success.

One application `Map` coalesces concurrent requests for an ID. A fulfilled
promise stays reusable for the lifetime of the live `Document`, matching the
browser module map's single evaluation by resolved module URL. A rejected or
contradictory module is removed from application success state. Critical
failure crosses the existing guarded hard-navigation boundary so the retry
receives a fresh browser module map.

The only route-owned loading classes are:

- `critical`: import after the complete destination contract and locale runtime
  validate, but before route materialization and visible commit;
- `deferred`: begin only after the synchronous commit; failure leaves the
  canonical semantic HTML active;
- `viewport`: observe the real feature elements with an
  `IntersectionObserver` and a 256 px near-viewport margin; disconnect the old
  route observer at the next activation.

Imports are not abortable. The navigation transaction is therefore checked
again after every critical await, and the feature runtime owns a separate
route serial so a late deferred or viewport completion cannot mutate a removed
route. Gate 4.4 itself did not prefetch route HTML or feature modules.

### esbuild metafile and request manifests

esbuild emits fingerprinted `/assets/main-<hash>.js` and
`/assets/main-<hash>.css` shell URLs plus fingerprinted dynamic feature chunks.
The build consumes `result.metafile`, including
each output's `entryPoint`, `imports`, import `kind`, `inputs`, `cssBundle`, and
byte count. It fails unless:

- the graph exposes exactly the closed feature entries plus the two known Web
  Awesome shell entries;
- every non-main entry is reachable only through native `dynamic-import` edges;
- every feature entry is hashed and every internal edge resolves to an emitted
  asset;
- each Lit runtime module occurs in exactly one output chunk;
- Web Awesome Core and `pinega-diagram-viewer` reach that same Lit chunk;
- `package-lock.json` contains one root installation of `lit`, `lit-html`,
  `lit-element`, and `@lit/reactive-element` with no nested duplicates.

No bundler-specific dedupe override is required: npm's locked package graph
resolves the four Lit packages to one root installation, and the metafile proof
verifies the emitted result rather than treating resolution configuration as
evidence. The independent build checker reconstructs the feature graph from
the persisted metafile, checks every output byte count, and compares it with
the fingerprinted feature graph. CI also performs two clean production builds and
recursively compares their output before it tests, attests, and deploys the
exact second artifact.

esbuild preserves each literal `import()` as a native dynamic-import edge and
does not inject a dependency-preload wrapper. Each phase therefore starts a
native import directly and the browser follows that module's static dependency
graph. This preserves the fresh-module-map hard-fallback boundary in WebKit
after an intentionally failed chunk instead of coupling retry correctness to
a synthetic preload cache.

esbuild documents code splitting as work in progress and records a known
ordering issue for shared chunks. Gate 4.4 therefore does not permit feature
correctness to depend on side-effect order across split entry points. The
zero-retry browser matrix executes the real minified production artifact in
Chromium, Firefox, and WebKit; any future cross-chunk ordering dependency must
add a direct regression test or reopen the bundler decision.

Each route's schema-v8 site-manifest entry partitions the actual transitive
closure into shell, critical, deferred, and viewport requests. Assets already
loaded through the shell are listed under `moduleMapReuse` instead of counted
again as feature requests. No manual `modulepreload` or import map is required
for correctness.

### Lit ownership and evidence

At the Gate 4.4 boundary, `pinega-diagram-viewer` was the first Pinega-owned Lit
lifecycle island and returned its host as the render root. The SSG-produced
SVG, caption, transcript, model download, and no-JavaScript representation
remained canonical light DOM. Gate 4.6 retains that canonical surface but gives
Lit one dedicated initially empty subtree inside the transcript; it does not
adopt or hydrate the SSG figure. Web Awesome remains the source of generic
controls and never becomes the application router or global `<main>` renderer.

Build checks prove static package/chunk deduplication. Browser tests additionally
assert the exact Lit diagnostic version arrays, one shared Lit request before
and after viewport activation, one request per feature chunk, deferred
activation after commit, locale-route module reuse, and critical chunk failure
with zero partial commit. The complete matrix runs with zero retries in
Chromium desktop/mobile, Firefox, and WebKit against one immutable artifact.

## Gate 4.5 intent-aware route prefetch

### Intent and eligibility

Prefetch is an application-owned route preparation, not a parallel
`<link rel="prefetch">` cache. It uses the coordinator's existing fetch,
response-envelope checks, detached parse, complete route-contract validation,
and build/shell compatibility boundary. A validated speculative route may
enter the same native-template LRU, so a later navigation consumes the exact
prepared object without a second request or parse.

Only ordinary eligible anchor/area destinations are considered. The prefetch
policy is deliberately stricter than interception: it rejects active-route,
cross-origin, non-HTTP(S), credentialed, download, explicit-target, disabled,
fallback-guard, and unknown-source links. Event delegation follows the composed
path so links inside component trees retain the same policy.

The three intent signals are:

- primary mouse/pen `pointerover` after an 80 ms dwell; leaving the link before
  the dwell cancels the intent;
- `focusin`, immediately, for keyboard and programmatic focus intent;
- primary unmodified button-zero `pointerdown`, immediately, so touch/pen/mouse
  activation can publish shared in-flight ownership before the click-driven
  Navigation API event.

Hover uses `pointerover` because it bubbles; the related target check prevents
descendant transitions from restarting the dwell. Touch hover is ignored and
touch intent enters through primary `pointerdown`.

### Scheduler, network, and foreground ownership

The scheduler admits at most two active route preparations and eight queued
keys. Keys coalesce across signals. Pointer intent outranks focus, which
outranks hover; promotion preserves one operation, and a stronger intent may
replace only the oldest lower-priority queued item. It never displaces active
work merely to improve priority.

Starting a foreground navigation cancels queued and active speculation for
other routes. If the selected route already owns an active preparation, the
navigation reuses that exact in-flight promise; the scheduler invokes the task
synchronously enough to publish this ownership before a following click event.
The selected navigation remains the only owner of visible commit, critical
feature loading, focus, scroll, and fallback.

Speculation runs only while the document is visible and `navigator.onLine` is
not false. It is blocked when Network Information reports `saveData=true` or
an effective type of `slow-2g`, `2g`, or `3g`. A policy change or document hide
aborts orphaned speculation. When Network Information is unavailable, Pinega
does not invent a connection class; other eligibility checks still apply.
Route HTML uses Fetch request priority `low`, which is a scheduling hint rather
than a correctness dependency.

Speculative LRU entries are the first eviction candidates, before any visited
non-active prototype. A speculative insertion cannot evict a full cache made
only of committed routes: the new speculative entry evicts itself. `no-store`
responses may be validated for intent evidence but are not retained and are
immediately finalized as unused. Route feature modules are not imported during
prefetch; critical modules remain a foreground pre-commit boundary, while
deferred and viewport behavior still starts from the committed route.

### Metrics and evidence

Every state change publishes schema-v1 `pinega:prefetch-metrics` and updates
`window.__PINEGA_PREFETCH_METRICS__`. The snapshot exposes intent outcomes,
network policy, live scheduler occupancy, completed/failed/aborted work,
cache/in-flight hits, retained and finalized unused entries, and byte
accounting.

The hit-rate denominator is completed route-HTML prefetches. A hit is counted
only when an active or retained speculative preparation is consumed by a
successful navigation commit; a mere cache lookup is not a hit. Exact UTF-8
response bytes provide source accounting. Transfer accounting uses the
matching Fetch `PerformanceResourceTiming.transferSize` entry when available
and labels exact source bytes as the explicit fallback measurement otherwise.

At any snapshot:

```text
wasted bytes = prefetched bytes - useful bytes
             = retained-unused bytes + finalized-unused bytes
```

The retained partition can still become useful later; finalized unused bytes
cannot. Cache eviction, `no-store`, and incompatible-build clearing finalize
unused records. This makes the metric interpretable during a live document
without pretending an unfinished session is a final outcome.

The zero-retry production browser matrix covers hover dwell/cancellation,
focus and pointerdown, one-request in-flight reuse, two-active/eight-queued
bounds, Save-Data and 3g blocking with 4g recovery, zero feature execution
during prefetch, cache hits, and `no-store` waste. The diagnostic
`gate-4.5-intent-prefetch-baseline.json` deliberately completes two route
prefetches, consumes one, and retains one unused; it therefore requires a 0.5
hit rate plus internally balanced useful/wasted source and transfer bytes.
Numeric product budgets remain deferred until repeated production evidence
exists. Idle prefetch, module prefetch, persistence, and Service Worker
behavior remain outside Gate 4.5.

## Gate 4.6 stateful Lit island

### Production behavior and ownership

`pinega-diagram-viewer` now owns a real, user-facing state machine: after the
native transcript is opened, a local control can fetch, validate, summarize,
close, reopen, fail, and retry the semantic JSON model for that one diagram.
The request is delayed until explicit component intent. A completed summary is
retained only by that component instance; closing and reopening it does not
repeat the request.

The accessible SVG, caption, transcript, and download link remain generated
SSG light DOM and work when JavaScript or the feature chunk is unavailable.
Lit renders only into a build-authored empty `data-pinega-island-root` inside
the transcript. It neither hydrates the figure nor renders any route-global
surface. A fresh clone clears copied Lit markers before its first render and
starts with independent state.

The schema-v8 site manifest publishes the normative policy:

- ownership is `component-local`;
- route loading, a Lit router, global rendering, and global hydration are all
  disabled;
- `@lit/task` is permitted only for `component-local-model` async work;
- the island must support reconnect while retaining its own completed state.

### Async and lifecycle boundary

The model task accepts only the exact uncredentialed same-origin endpoint for
the host's diagram ID and active locale. It sends an abortable JSON request,
requires `application/json`, stops streaming above a 64 KiB body limit,
validates the canonical semantic model schema and cross-references, and checks
the returned ID before rendering safe Lit expressions. No `unsafeHTML()` is
used.

`connectedCallback()` installs the external Escape listener and the native
transcript listener under one connection-owned `AbortController`.
`disconnectedCallback()` aborts that controller and any pending Task request,
removes renderer ownership, and records whether an expanded pending task must
restart after reconnect. Completed values have no live external resource and
remain local to the retained instance. Timers, workers, observers, document
subscriptions, and route promises are not created by the island.

The production graph verifier requires one root installation of `@lit/task`
and proves its emitted modules are reachable through the diagram feature but
not the shell or Web Awesome Core closure. Unit tests cover URL, media type,
size, identity, schema, abort, package deduplication, and forbidden global Lit
owners. The zero-retry browser matrix adds 24 scenarios across Chromium
desktop/mobile, Firefox, and WebKit for no-JavaScript fallback, on-demand and
localized completion, deterministic failure/retry, disconnect/reconnect with
pending cancellation, external-listener cleanup, and fresh-clone isolation.

## Gate 4.7 HTTP, deployment, and release gate

Every public file under `/assets/` now has a content fingerprint in its URL and
is served with `public, max-age=31536000, immutable`. HTML, content and diagram
data, discovery files, and the two well-known manifests use
`public, max-age=0, must-revalidate`. The URL spaces are deliberately disjoint:
Cloudflare Pages concatenates the value of the same header from overlapping
`_headers` rules, so a broad revalidation rule must not overlap `/assets/*`.
There is no Service Worker or second cache owner.

The generated `/.well-known/pinega-release.json` inventories every public file
with its URL, expected status, byte length, SHA-256, media type, and cache
policy. It also records the generated `_headers` control checksum while
excluding its own cyclic identity and the separately added deployment
provenance. The build checker reconstructs the manifest from disk. After Direct
Upload, the remote gate fetches every inventoried URL and compares actual
status, bytes, SHA-256, `Cache-Control`, `Content-Type`, and ETag. A conditional
HTML request must return `304`; the English and Russian nearest-404 bodies are
verified through guaranteed-missing URLs.

CI builds and tests one directory, packages it deterministically, attests that
archive, verifies the attestation before deployment, and uploads the extracted
directory without rebuilding. The immutable Cloudflare hash URL is the only
authoritative review deployment. A passing release review requires Chromium
desktop/mobile, Firefox, and WebKit with zero retries; no serious or critical
axe findings; no keyboard trap; no unexpected visual diff; and raw cold/warm
desktop/mobile FCP, LCP, CLS, Speed Index, and TBT observations. Lighthouse is
retained as lab diagnostics and never acts as the sole release oracle.

## Normative and implementation references

- [HTML Standard — the `html` element and document language](https://html.spec.whatwg.org/multipage/semantics.html#the-html-element)
- [HTML Standard — custom `data-*` attributes](https://html.spec.whatwg.org/multipage/dom.html#embedding-custom-non-visible-data-with-the-data-*-attributes)
- [HTML Standard — canonical links](https://html.spec.whatwg.org/multipage/links.html#link-type-canonical)
- [HTML Standard — Navigation API](https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigation-api)
- [HTML Standard — the `template` element](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element)
- [HTML Standard — JavaScript module maps](https://html.spec.whatwg.org/multipage/webappapis.html#module-map)
- [HTML Standard — prefetch links](https://html.spec.whatwg.org/multipage/links.html#link-type-prefetch)
- [HTML Standard — speculative loading](https://html.spec.whatwg.org/multipage/speculative-loading.html)
- [Pointer Events](https://www.w3.org/TR/pointerevents/)
- [Intersection Observer](https://www.w3.org/TR/intersection-observer/)
- [ECMAScript — keyed collections and `Map` insertion order](https://tc39.es/ecma262/multipage/keyed-collections.html)
- [Fetch Standard](https://fetch.spec.whatwg.org/)
- [Resource Timing](https://www.w3.org/TR/resource-timing/)
- [Network Information API](https://wicg.github.io/netinfo/)
- [Save Data API](https://wicg.github.io/savedata/)
- [WAI-ARIA 1.2 — `aria-busy`](https://www.w3.org/TR/wai-aria-1.2/#aria-busy)
- [WAI-ARIA 1.2 — `status` role](https://www.w3.org/TR/wai-aria-1.2/#status)
- [WCAG 2.2 — focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- [Navigation Timing Level 2](https://www.w3.org/TR/navigation-timing-2/)
- [Event Timing](https://w3c.github.io/event-timing/)
- [Layout Instability](https://wicg.github.io/layout-instability/)
- [Long Tasks](https://w3c.github.io/longtasks/)
- [Playwright CDP session](https://playwright.dev/docs/api/class-cdpsession)
- [Playwright Page API — navigation and readiness](https://playwright.dev/docs/api/class-page#page-goto)
- [Playwright — ARIA snapshots](https://playwright.dev/docs/aria-snapshots)
- [Playwright — test retries and flaky classification](https://playwright.dev/docs/test-retries)
- [parse5 — WHATWG-compatible Node HTML parser](https://github.com/inikulin/parse5)
- [esbuild — code splitting](https://esbuild.github.io/api/#splitting)
- [esbuild — build metadata](https://esbuild.github.io/api/#metafile)
- [Lit — development-mode duplicate-version diagnostics](https://lit.dev/docs/tools/development/)
- [Lit — component lifecycle](https://lit.dev/docs/components/lifecycle/)
- [Lit — asynchronous tasks](https://lit.dev/docs/data/task/)
- [Web Awesome — usage and Lit foundation](https://webawesome.com/docs/usage/)
- [Cloudflare Pages — custom headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages — serving Pages and ETags](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [RFC 8246 — HTTP Immutable Responses](https://www.rfc-editor.org/rfc/rfc8246.html)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [GitHub — artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [web.dev — Web Vitals tooling](https://web.dev/articles/vitals-tools)
