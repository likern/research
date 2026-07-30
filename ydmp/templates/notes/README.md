# Switchable Typst templates for YDMP notes

This directory preserves four blind visual candidates as independent Typst
profiles. They are intentionally kept switchable while they are evaluated on
real scientific-paper notes, closed-book recall records, canonical models, and
verification documents.

## Current provisional ranking

1. Candidate C
2. Candidate A
3. Candidate D
4. Candidate B

This ranking is explicitly **temporary**. Candidate D is considered good, but
its typography currently appears somewhat too thin. Candidate A is preferred to
Candidate B. No candidate is deleted or treated as final.

## Files

```text
registry.yaml      candidate metadata, aliases, ranking, and default
candidate-a.typ    traditional academic profile
candidate-b.typ    compact technical profile
candidate-c.typ    balanced profile and current default
candidate-d.typ    airy editorial profile
 template.typ       shared renderer and explicit variant selection
 default.typ        stable Candidate C import
 example.typ        minimal working example
```

## Default use: Candidate C

```typst
#import "ydmp/templates/notes/default.typ": paper_notes, note_panel, evidence

#show: paper_notes.with(
  title: "My paper notes",
  authors: ("Author One", "Author Two"),
  paper_id: "author-year-short-title",
  doi: "10.xxxx/yyyy",
  stage: "MODEL",
)

= Main idea

#note_panel(kind: "recall")[
  Closed-book reconstruction goes here.
]
```

Because `default.typ` is a stable alias, documents importing it automatically
use Candidate C until an explicit future decision changes the repository
default.

## Explicitly select another candidate

```typst
#import "ydmp/templates/notes/template.typ": paper_notes, note_panel

#show: paper_notes.with(
  title: "My paper notes",
  variant: "candidate-a",
)
```

Accepted names:

```text
candidate-a | a
candidate-b | b
candidate-c | c
candidate-d | d
```

Pass the same `variant` to helper components when using `template.typ`
directly:

```typst
#note_panel(kind: "verification", variant: "candidate-d")[
  Verification text.
]
```

When importing `default.typ`, helpers are already bound to Candidate C.

## Evaluation policy

Templates should be compared on filled documents rather than empty samples.
Useful comparison dimensions include:

- readability after several pages;
- distinction between recall, correction, and canonical model;
- density of definitions, formulas, histories, code, and diagrams;
- navigation between sections;
- print readability;
- suitability for annotation;
- whether the template encourages useful thinking or excessive form filling.

Record future observations in `registry.yaml`; do not overwrite another
candidate merely because the provisional ranking changes.

## Provenance note

The original blind candidate source files were not present in the repository
when this modular system was introduced. These files are maintained modular
profiles corresponding to the four candidate design directions and the recorded
user ranking. Real filled notes will be used to refine them and determine
whether any profile needs to be adjusted or replaced by an exact recovered
source.
