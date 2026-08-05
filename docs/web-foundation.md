# Pinega Web Foundation architecture

## Status

Version: `0.1`

Scope: canonical cross-platform tokens, Web Awesome integration boundary,
component laboratory, five representative Pinega compositions, and executable
quality gates. This is not yet the public Pinega homepage or documentation
portal.

## Principles

1. Native HTML owns document semantics and durable content.
2. CSS owns presentation, layout, responsive adaptation, and visual state.
3. JavaScript owns domain state, lifecycle, and interaction orchestration.
4. Web Awesome supplies generic interaction primitives, not Pinega semantics.
5. Pinega custom elements wrap only stable domain concepts or intentional
   vendor isolation boundaries.
6. Licensed Pro components progressively enhance complete semantic fallbacks.
7. Canonical Pinega tokens generate CSS, TypeScript, and Typst adapters.

## Layers

```text
@layer vendor,
       pinega.tokens,
       pinega.base,
       pinega.layout,
       pinega.webawesome,
       pinega.components,
       pinega.utilities,
       pinega.overrides;
```

Web Awesome retains its internal layers inside `vendor`. The Pinega adapter
maps canonical tokens after vendor defaults, and component styling remains
above that adapter.

## Component decision rule

```text
native element
    when HTML already owns the semantics and behavior

direct wa-* element
    for a stable generic interaction primitive

Pinega composition
    when multiple generic primitives form a stable product pattern

Pinega custom element
    for domain semantics, lifecycle, or vendor API isolation
```

## Pro boundary

The licensed project is deployment configuration, not public source. No Pro
assets or project credentials are committed. `pinega-benchmark` always retains
an accessible HTML table. It renders a native SVG chart first and upgrades to
Web Awesome Pro only after `wa-line-chart` is registered.

## Gate exit criteria

- generated token artifacts are deterministic and current;
- no purchased project URL or license material is present in the repository;
- TypeScript passes strict checking;
- all component compositions build from the pinned dependency set;
- semantic and keyboard browser tests pass in Chromium, Firefox, and WebKit;
- serious and critical axe violations are absent;
- mobile and desktop layouts have no horizontal overflow;
- committed screenshots protect representative light and dark compositions;
- the site remains meaningful without the Pro project.
