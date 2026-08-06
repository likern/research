# Academic diagram renderers v0.2

This layer converts semantic IR into renderer-specific output.

The renderer boundary is:

semantic model -> validated IR -> layout profile -> SVG / Typst output

The renderer must not mutate semantic meaning.

Current refinement targets:

- MVCC version-chain academic layout
- Linearizability history academic layout

Supported semantic concepts:

- reference edges
- temporal edges
- markers
- visibility evaluations
- precedence relations
- witnesses
