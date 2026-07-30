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
registry.yaml         candidate metadata, aliases, ranking, and default
candidate-a.typ       traditional academic profile
candidate-b.typ       compact technical profile
candidate-c.typ       balanced profile and current default
candidate-d.typ       airy editorial profile
template.typ          shared renderer, notes, evidence, and my_thought
default.typ           stable Candidate C import
example.typ           minimal working example
thoughts-example.typ  formal translation interleaved with learner annotations
```

## Default use: Candidate C

```typst
#import "ydmp/templates/notes/default.typ": \
  paper_notes, note_panel, my_thought, evidence

#show: paper_notes.with(
  title: "My paper notes",
  authors: ("Author One", "Author Two"),
  paper_id: "author-year-short-title",
  doi: "10.xxxx/yyyy",
  stage: "ANNOTATE",
)

= Main idea

#my_thought(kind: "main-idea")[
  Learner-authored reconstruction goes here.
]
```

Because `default.typ` is a stable alias, documents importing it automatically
use Candidate C until an explicit future decision changes the repository
default.

## Explicitly select another candidate

```typst
#import "ydmp/templates/notes/template.typ": paper_notes, my_thought

#let variant = "candidate-a"

#show: paper_notes.with(
  title: "My paper notes",
  variant: variant,
)

#my_thought(kind: "example", variant: variant)[
  My own example.
]
```

Accepted names:

```text
candidate-a | a
candidate-b | b
candidate-c | c
candidate-d | d
```

Pass the same `variant` to helper components when using `template.typ`
directly. When importing `default.typ`, helpers are already bound to Candidate C.

## Learner-authored annotations: `my_thought`

`my_thought` marks the learner's own interpretation inside a unified formal
translation or scientific-paper note. Its `body` is unrestricted Typst
`content`, not a string. It can contain multiple paragraphs, lists, display
math, tables, code, diagrams, evidence blocks, and nested layout elements.

```typst
#my_thought(kind: "formal-link")[
  This paragraph is my interpretation.

  $ H equiv S iff forall P: H|P = S|P $

  - first consequence;
  - second consequence.
]
```

The component inherits the current Candidate A/B/C/D font and paragraph style.
It does not set an absolute body font size. The small visual reduction is
relative (`0.96em`) to the surrounding text. Insets, spacing, and accent stroke
are also expressed in relative units where practical.

### Supported modes

```text
default       -> Мои мысли
main-idea     -> Главная мысль
causal-chain  -> Причинная цепочка
formal-link   -> Связь с формальным определением
example       -> Свой пример
uncertainty   -> Неясность
```

Aliases such as `idea`, `cause`, `definition`, `own-example`, `unclear`, and
`question` are accepted.

Custom label:

```typst
#my_thought(
  kind: "formal-link",
  title: "Моя реконструкция proof obligation",
)[ ... ]
```

No visible label:

```typst
#my_thought(show_label: false)[ ... ]
```

### Compile with or without learner annotations

Annotations are visible by default.

```bash
typst compile notes.typ notes-with-thoughts.pdf
```

Create a clean formal version:

```bash
typst compile \
  --input show-thoughts=false \
  notes.typ notes-clean.pdf
```

The switch is read from `sys.inputs`. False values include `false`, `0`, `no`,
`off`, `hide`, and `hidden`. Disabled annotations return `none`; they are removed
from layout rather than merely painted invisibly, so no blank annotation space
remains.

A single block can override the global switch:

```typst
#my_thought(visible: true)[Always included.]
#my_thought(visible: false)[Always omitted.]
```

## Compile the comparison document

```bash
for short in a b c d; do
  typst compile \
    --input variant="candidate-${short}" \
    --input show-thoughts=true \
    ydmp/templates/notes/thoughts-example.typ \
    "candidate-${short}-thoughts.pdf"
done
```

GitHub Actions performs this compilation for pull requests that modify the note
templates and uploads the resulting PDFs as the
`ydmp-typst-note-previews` artifact.

## Evaluation policy

Templates should be compared on filled documents rather than empty samples.
Useful comparison dimensions include:

- readability after several pages;
- distinction between formal translation and learner interpretation;
- density of definitions, formulas, histories, code, and diagrams;
- navigation between sections;
- print readability;
- suitability for annotation;
- whether the template encourages useful thinking or excessive form filling;
- whether the clean compilation remains coherent after annotations are removed.

Record future observations in `registry.yaml`; do not overwrite another
candidate merely because the provisional ranking changes.

## Provenance note

The original blind candidate source files were not present in the repository
when this modular system was introduced. These files are maintained modular
profiles corresponding to the four candidate design directions and the recorded
user ranking. Real filled notes will be used to refine them and determine
whether any profile needs to be adjusted or replaced by an exact recovered
source.
