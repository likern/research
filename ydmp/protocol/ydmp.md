# YDB Deep Mastery Protocol

Primary lifecycle:

```text
PREPARE -> RESUME -> READ <-> PROBE -> CLOSED-BOOK RECALL -> CAPTURE
        -> MODEL -> VERIFY -> YDB MAP -> TRANSFER -> IMPLEMENT
        -> SPACED RECALL
```

For a paper that is already prepared, a new conversation begins directly with
`RESUME`; PREPARE is not repeated.

Evidence labels:

- `CONFIRMED`: directly supported by an inspected source.
- `INFERRED`: derived from confirmed facts or definitions.
- `HYPOTHESIS`: plausible mapping or explanation requiring verification.
- `EXTERNAL`: useful material from outside the focal paper.
- `ARTICLE-ADJACENT`: relevant theory that exceeds the paper's required scope.

## PREPARE

PREPARE resolves identity and versions, verifies metadata, maps the material
into the curriculum, identifies terminology barriers, and creates
attention-guiding questions. It must not substitute for reading.

## RESUME and active paper context

RESUME restores an already prepared paper as the active context of a new or
existing conversation. It is the standard entry point when PREPARE has already
completed and its artifacts have been persisted.

RESUME resolves a DOI, paper ID, title, URL or repository path to:

```text
ydmp/papers/<paper_id>/
```

It loads, when present:

```text
prepare.json
prepare.yaml
prepare.md
references.bib
study/progress.yaml
study/gaps.yaml
study/model.md
study/verification.md
study/recall-cards.yaml
latest relevant study/sessions/*
```

`prepare.json` remains the machine-readable source of truth for identity,
selected version and reading source. RESUME must not rerun PREPARE when the
existing packet is valid.

The restored `StudyContext` contains at least:

- focal `paper_id`, canonical title and identifiers;
- repository, base branch and paper root;
- selected paper version and opened reading source;
- loaded, absent and unresolved artifacts;
- current reading frontier;
- spoiler boundary;
- active mode;
- current learning state when it exists.

RESUME is read-only by default. It activates context for the conversation but
does not modify repository files. It returns a compact `StudyContextReceipt`
that makes the restored state auditable.

A PREPARE packet proves only that the paper was prepared. It does not imply
that the learner has read the paper or reached any particular section. If the
reading frontier is not persisted or explicitly supplied, RESUME asks one
concise question about the current section, page or figure.

## Guided reading

`RESUME` supports `mode: guided-reading`. In this mode the learner is still
reading and may ask ordinary questions about any material already reached.
The assistant accompanies the reading rather than waiting for a final recall
stage.

Guided-reading behavior:

- answer from the focal paper first;
- identify the relevant section, journal page, figure or table when available;
- separate paper content from `INFERRED` explanations and `EXTERNAL` theory;
- explain terminology, notation, examples, histories, diagrams and proof steps;
- give additional examples and counterexamples when useful;
- correct local misunderstandings before they contaminate later reading;
- do not transform every question into an assessment;
- do not start CLOSED-BOOK RECALL automatically;
- allow PROBE at any point;
- retain meaningful questions, learner explanations and corrections in a
  conversation-local session buffer for later CAPTURE.

The active paper remains the default referent for ordinary follow-up questions
until the learner explicitly changes topic or activates another paper.

### Reading frontier and spoiler boundary

The reading frontier may be stated as a section, page, paragraph, theorem,
figure or table. It is resolved in this order:

1. explicit position in RESUME or PROBE;
2. `study/progress.yaml`;
3. latest relevant session record;
4. one targeted clarification question.

Supported spoiler policies:

- `current-position`: do not introduce results beyond the frontier;
- `ask-before-crossing`: warn and obtain explicit permission before using later
  material;
- `unrestricted`: later material is permitted, but its location is still named.

The default is `ask-before-crossing`. Necessary external background may be
introduced with an `EXTERNAL` label, but it must not accidentally reveal the
paper's later argument.

## PROBE

PROBE is a small formative assessment performed during READ or guided reading.
It checks whether a local concept was understood well enough for reading to
continue productively. It is not a final examination and does not assume that
the whole paper has been read.

A PROBE may target one definition, paragraph, history, example, figure, table,
proof step or assistant explanation. It uses the active paper context from
RESUME, or restores the supplied paper reference when no active context exists.

Default PROBE behavior:

- use only material at or before the current reading frontier;
- ask one question at a time;
- ask one question by default and never more than three per invocation;
- prefer teach-back and reconstruction over recognition-only prompts;
- preserve the learner answer verbatim in the current session buffer;
- assess it as `understood`, `partial`, `not_recalled` or `misconception`;
- separate correct elements, missing elements and misconceptions;
- give immediate, concise corrective feedback;
- identify the relevant source location when available;
- ask at most one follow-up reconstruction question when repair is needed;
- stop after the requested local check rather than starting an unrelated chain.

Supported PROBE modes include:

- `teach-back`;
- `closed-book-local`;
- `explain-back`;
- `history-reconstruction`;
- `example-classification`;
- `figure-reconstruction`.

PROBE does not automatically:

- mark READ complete;
- enter CLOSED-BOOK RECALL;
- create spaced-recall cards;
- persist repository files.

Repeated PROBE interactions are consolidated later through CAPTURE.

## READ and CLOSED-BOOK RECALL

The first reading is a coverage pass, not a requirement for immediate mastery.
CLOSED-BOOK RECALL diagnoses the learner's broader model after the intended
coverage pass. It is distinct from PROBE, which is local and formative during
reading.

Default recall boundary:

- at most eight core questions per pass;
- short assessment after each answer;
- detailed teaching is deferred to MODEL;
- article-adjacent theory is recorded as deferred rather than allowed to expand
  the recall indefinitely.

## CAPTURE

CAPTURE is the persistence boundary after a meaningful guided-reading, PROBE,
study or recall session. The assistant owns artifact production; the learner is
not expected to manually copy, normalize or organize the dialogue.

CAPTURE produces three distinct layers:

1. **Immutable session record** — a technically complete but edited record of
   the learning interaction. Learner answers are preserved verbatim. Irrelevant
   dialogue, repeated navigation and operational chatter are removed. The
   original answer is never silently rewritten after the learner improves.
2. **Canonical model** — a corrected, coherent explanation independent of the
   conversational order. Claims are labelled by evidence scope and are not
   automatically attributed to the focal paper.
3. **Learning state** — progress, gaps, next actions and compact recall cards.

Canonical paper layout:

```text
ydmp/papers/<paper_id>/
├── prepare.yaml
├── prepare.json
├── prepare.md
├── prepare.typ
├── references.bib
└── study/
    ├── progress.yaml
    ├── sessions/
    │   └── <session_id>.md
    ├── model.md
    ├── verification.md
    ├── gaps.yaml
    └── recall-cards.yaml
```

Session records and canonical models have different update semantics:

- `study/sessions/*` is append-only historical evidence;
- `study/model.md` and `study/verification.md` may be refined as sources are
  checked;
- `study/progress.yaml`, `study/gaps.yaml`, and `study/recall-cards.yaml` track
  the current learning state.

When repository access is available and the user has authorised persistence,
the assistant creates or updates the artifacts, commits them on a dedicated
branch, validates the diff, and opens a pull request. It must not merely describe
commands for the learner to run.

## MODEL and VERIFY

MODEL reconstructs the paper's argument, definitions, examples, invariants and
mechanisms. VERIFY checks the model against the paper and authoritative
external sources, preserving disagreements and corrections.

Assistant explanations from a session are not canonical by default. CAPTURE
must classify them as one of:

- directly supported by the focal paper;
- inferred from its definitions or examples;
- external background theory;
- implementation-specific mapping, such as PostgreSQL or YDB;
- unresolved and requiring verification.

## SPACED RECALL

Recall cards are generated from durable distinctions and recurring gaps, not
from every conversational question. Cards should be short, independently
answerable, source-scoped, and include expected answer elements rather than a
full essay.
