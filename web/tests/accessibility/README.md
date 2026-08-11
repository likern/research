# Accessibility-tree contract

Status: **ACCEPTED BASELINE — PR 1 serializer conformance and PR 2 temporal/navigation semantics**;
**PROPOSED NEXT MILESTONE — PR 3 interactive component semantics under review**.

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

PR 3 adds a closed interactive-state corpus. Schema v3 registers 46 final and
intermediate states across eight owner surfaces: the site header, theme,
translation status, documentation filter, Lit inspector, benchmark,
diagram/transcript, and native/Web Awesome code copy. Stable states use shared
strict baselines; reset states use exact equivalence; hidden states prove that
content is absent from the semantic projection; disconnect uses an explicit
DOM/lifecycle oracle. Platform-volatile SVG roots and vendor shadow-IDREF
feedback use explicit DOM, IDREF, event, clipboard, and live-region evidence;
their stable table and transcript subtrees remain strict cross-profile
baselines instead of committing engine-specific accessibility projections.

Every meaningfully revealed state is marked `axe: required`. The shared state
helper runs the pinned WCAG A/AA tag set immediately after the state assertion,
blocks serious and critical findings, and attaches a focused JSON report on
failure. This includes mobile navigation open, both theme modes in EN/RU,
translation status, every filter result state, Lit pending/complete/error and
retry states, both benchmark renderers with revealed source data, the open
diagram transcript, and copy success/error feedback.

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
owned component does not change. Schema v3 now proves the internal semantic
states of those components; the transition remains only where authored and
enhanced component projections intentionally differ.

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

`test:aria` runs the serializer, temporal, route-archetype, transaction, and
interactive-component corpus selected by `@aria-tree`. `test:aria:update`
generates serializer and owner-component baselines only from
`chromium-desktop`; the mobile open-navigation state intentionally reuses the
desktop navigation baseline. Review the
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
