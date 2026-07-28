# YDB Deep Mastery Protocol

Lifecycle:

```text
PREPARE -> READ -> CLOSED-BOOK RECALL -> CAPTURE -> MODEL -> VERIFY
        -> YDB MAP -> TRANSFER -> IMPLEMENT -> SPACED RECALL
```

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

## READ and CLOSED-BOOK RECALL

The first reading is a coverage pass, not a requirement for immediate mastery.
CLOSED-BOOK RECALL diagnoses the learner's current model without access to the
source.

Default recall boundary:

- at most eight core questions per pass;
- short assessment after each answer;
- detailed teaching is deferred to MODEL;
- article-adjacent theory is recorded as deferred rather than allowed to expand
  the recall indefinitely.

## CAPTURE

CAPTURE is the persistence boundary after a meaningful study or recall session.
The assistant owns artifact production; the learner is not expected to manually
copy, normalize, or organize the dialogue.

CAPTURE produces three distinct layers:

1. **Immutable session record** — a technically complete but edited record of
   the learning interaction. Learner answers are preserved verbatim. Irrelevant
   dialogue, repeated navigation, and operational chatter are removed. The
   original answer is never silently rewritten after the learner improves.
2. **Canonical model** — a corrected, coherent explanation independent of the
   conversational order. Claims are labelled by evidence scope and are not
   automatically attributed to the focal paper.
3. **Learning state** — progress, gaps, next actions, and compact recall cards.

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

MODEL reconstructs the paper's argument, definitions, examples, invariants,
and mechanisms. VERIFY checks the model against the paper and authoritative
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
