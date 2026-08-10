# Accessibility-tree contract

Status: **ACCEPTED BASELINE — PR 1 infrastructure and serializer conformance**;
**PROPOSED NEXT MILESTONE — PR 2 temporal and navigation semantics under review**.

This layer detects semantic regressions between DOM/behavioural assertions and
pixel snapshots. It is not a replacement for axe, keyboard tests, visual
checks, or manual assistive-technology review.

## Current scope

`coverage.json` is the versioned requirement registry and is validated against
`coverage.schema.json`. PR 1 covers the pinned Playwright serializer itself:

- heading levels;
- a nested button accessible name next to an `aria-hidden` SVG;
- exclusion of that SVG from the tree;
- `status` and `alert` roles;
- `expanded`, `pressed`, and `invalid` states.

The one committed `.aria.yml` baseline is shared by Chromium desktop/mobile,
Firefox desktop, and WebKit desktop. The path intentionally omits
`{projectName}`: a browser or mobile difference therefore fails instead of
creating an unnoticed profile-specific baseline.

The global `children: 'deep-equal'` policy makes child order, presence, and
nested descendants strict. A future test may use a partial invariant only
after the registry/schema explicitly introduces that oracle type; inline
partial matching is not part of this baseline.

The fixture reproduces the nested-name regression fixed in Playwright 1.62.1.
This guards Pinega against serializer drift when Playwright is upgraded.

PR 2 adds exact YAML equivalence without creating route baselines:

- six representative documents are captured at `authored`, `shell`, and
  `ready` during both initial load and reload;
- all 13 page classes are classified, with 11 public archetypes comparing a
  direct document against an enhanced commit and two native-policy archetypes
  recorded as explicit exclusions;
- pending, commit, active-route cancellation, and supersession have named
  semantic invariants;
- a mismatch attaches both `*-actual.aria.yml` and
  `*-reference.aria.yml` to the Playwright result before failing.

## Registered transition roots

Temporal and navigation comparisons cover the exact `body` accessibility tree
outside a closed registry of component-owned transitions. During capture, each
registered root is replaced by an accessible sentinel. Its presence, count,
and document order therefore remain part of the strict YAML oracle; only its
owned subtree is deferred to PR 3.

The current registry contains five reviewed transitions: the evidence role
upgrade, route-feature upgrades, Web Awesome Core upgrades, the runtime-source
label, and the navigation announcer. A broad selector such as `body`, `main`,
`pinega-site-header`, or `*` is rejected by the coverage validator. Adding a
transition is an explicit coverage decision, not a way to update a baseline.

The boundary is deliberate: PR 2 proves that the document surrounding an
owned component does not change. PR 3 must prove the internal semantic states
of each excluded component and can then narrow or remove these transitions.

## Snapshot and DOM ownership

The default Playwright YAML projection directly covers role, accessible name,
tree order, text/value, URL, and the supported states `checked`, `disabled`,
`expanded`, `invalid`, `level`, `pressed`, and `selected`. The strict fixture
also proves that hidden decorative content is absent.

Everything else remains an explicit DOM or behavioural assertion. PR 1 fixes
the current Pinega boundary as follows:

| Contract | Why it is not delegated to the YAML baseline |
| --- | --- |
| `aria-current` | Not serialized by Playwright 1.62 |
| `aria-busy` | Transaction state is not emitted in the default YAML projection |
| `aria-live` | `status` is visible, but the authored politeness value is not |
| `aria-controls` | `expanded` is visible, but its target IDREF is not |
| `aria-labelledby` / `aria-describedby` | Computed names/text can be visible while authored IDREF integrity is not |
| `aria-hidden` source attribute | The snapshot proves absence; the DOM assertion proves intentional exclusion |
| focus and `tabindex` | Focus transfer and reachability are behavioural |
| document `lang` and `dir` | Locale interpretation is outside the locator tree projection |

`tests/browser/accessibility-tree.spec.ts` asserts these properties and also
checks that every IDREF resolves to exactly one target. Existing owner tests
for navigation, locale, keyboard, and axe remain authoritative.

## Commands

```text
npm run check:aria-coverage
npm run test:aria
npm run test:aria:update
```

`test:aria` runs the serializer, temporal, route-archetype, and transaction
corpus selected by `@aria-tree`. `test:aria:update` generates only the
serializer baseline from `chromium-desktop`. Review the
`.aria.yml` diff as a semantic API change, then run `test:aria` across all four
profiles. CI never updates snapshots.

Do not add geometry (`boxes: true`), browser names, or broad regular
expressions to a strict baseline. A platform exception requires an explicit
registry/schema change and an additional DOM, API, or manual oracle.

## Normative and implementation references

- [Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots)
- [Playwright snapshot path configuration](https://playwright.dev/docs/api/class-testconfig#test-config-snapshot-path-template)
- [Playwright test tags](https://playwright.dev/docs/test-annotations#tag-tests)
- [Playwright issue #36913: `aria-current` is not exposed](https://github.com/microsoft/playwright/issues/36913)
- [Playwright 1.62.1 fixes the nested button-name regression](https://github.com/microsoft/playwright/releases/tag/v1.62.1)
- [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)
- [HTML Accessibility API Mappings](https://www.w3.org/TR/html-aam-1.0/)
- [Core Accessibility API Mappings 1.2](https://www.w3.org/TR/core-aam-1.2/)
