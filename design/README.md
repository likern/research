# Pinega Strata canonical design tokens

`tokens/strata.tokens.json` is the cross-platform source of truth for the
Pinega Strata design system. It follows the Design Tokens Community Group
2025.10 format and uses a Pinega extension only for deterministic platform
translation metadata.

The hierarchy is deliberate:

```text
reference   raw palette, spacing, typography, motion, and geometry
system      mode-aware semantic presentation decisions
research    YDMP/Pinega provenance roles, separate from generic UI status
component   stable component defaults
```

Generated files are committed so that consumers do not need Node.js merely to
use the design system:

```text
generated/strata.tokens.css   runtime CSS custom properties
generated/strata.tokens.ts    typed application values
generated/strata.tokens.typ   Typst adapter input
generated/strata.tokens.manifest.json
```

Run:

```bash
node design/scripts/build-tokens.mjs
node design/scripts/build-tokens.mjs --check
```

## Translation rules

- Source colours use OKLCH and remain OKLCH in CSS and Typst.
- CSS uses `--pinega-ref-*`, `--pinega-sys-*`,
  `--pinega-research-*`, and `--pinega-component-*` namespaces.
- Light and dark token paths emit the same semantic variable names under
  different mode selectors.
- Typst durations are emitted as milliseconds.
- The prose measure is unitless (`68`) because web and paged-document renderers
  apply different physical units.
- Generated files must never be edited by hand.

## Dependency direction

Web Awesome consumes Pinega tokens through a theme adapter. Pinega tokens do
not depend on Web Awesome names. This keeps Typst, web-native components,
Web Awesome, and future renderers aligned without making a vendor theme the
canonical system.
