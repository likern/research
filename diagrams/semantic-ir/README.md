# Scientific Diagram Semantic IR

This directory defines the renderer-independent intermediate representation for academic diagrams.

The IR separates domain meaning from presentation:

- nodes represent semantic entities;
- edges represent typed relations;
- markers represent important events;
- evaluations represent derived semantic checks;
- witnesses represent proof-oriented explanations.

Renderers must not store coordinates, colours, fonts, SVG paths, or Typst layout decisions in this layer.

Initial v0.2 primitives:

- `entity`
- `reference-edge`
- `temporal-edge`
- `marker`
- `visibility-evaluation`
- `witness`
- `precedence-relation`
