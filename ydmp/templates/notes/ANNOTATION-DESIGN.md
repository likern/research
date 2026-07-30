# Learner annotation design

`my_thought` lets a YDMP document keep formal translation and learner-authored
interpretation in one readable flow without losing their provenance.

The formal text stays in the normal document body. Learner interpretation is
wrapped explicitly:

```typst
#my_thought(kind: "causal-chain")[
  My reasoning, formulas, lists, tables, or examples.
]
```

The wrapper is intentionally structural rather than a footnote:

- long content and display mathematics remain readable;
- the block may break across pages;
- raw Typst clearly separates formal translation from learner interpretation;
- the same source generates annotated and clean documents;
- Candidate A/B/C/D control the typography and colour system.

## Provenance layers

A unified document may contain:

1. formal translation in the normal flow;
2. learner draft inside `my_thought`;
3. evidence labels such as `CONFIRMED`, `INFERRED`, or `HYPOTHESIS`;
4. later reviewed/canonical text in a separate MODEL artifact.

The annotation does not make its contents canonical. It records the learner's
current interpretation and may intentionally contain uncertainty.

## Visibility semantics

`show-thoughts=false` omits annotation content completely. It does not use
Typst's `hide`, because `hide` preserves layout dimensions. A clean compilation
should reflow the remaining formal text without blank annotation regions.
