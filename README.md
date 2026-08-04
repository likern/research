# YDMP Research Workspace

This repository stores the modular **YDB Deep Mastery Protocol (YDMP)**.

## Lifecycle

```text
PREPARE -> RESUME -> READ <-> PROBE -> CLOSED-BOOK RECALL -> CAPTURE
        -> MODEL -> VERIFY -> YDB MAP -> TRANSFER -> IMPLEMENT
        -> SPACED RECALL
```

For an already prepared paper, start a new conversation with `RESUME`; do not
repeat PREPARE.

## PREPARE

`PREPARE` accepts a DOI, URL, title, BibTeX record, or uploaded PDF and
generates:

- `prepare.yaml`
- `prepare.json`
- `prepare.md`
- `prepare.typ`
- `references.bib`

## RESUME

`RESUME` restores the complete YDMP context for a prepared paper from the
repository, opens the selected reading version, loads any persisted learning
state, establishes the current reading frontier, and makes the paper active in
the current conversation.

```text
RESUME:
https://doi.org/10.1145/78969.78972

mode: guided-reading
position: "Section 2, after Figure 1"
spoiler_boundary: ask-before-crossing
```

A successful RESUME reports a `StudyContextReceipt` containing the resolved
paper ID, repository path, selected version, reading source, loaded study files,
reading frontier, active mode, and unresolved context.

### Guided reading

With `mode: guided-reading`, ordinary follow-up questions refer to the active
paper. The tutor answers questions about definitions, notation, histories,
figures, tables, examples and proof steps while respecting the unread part of
the paper. Paper content, inferred explanations and external background remain
source-scoped.

The default spoiler policy is `ask-before-crossing`.

## PROBE

`PROBE` runs a local formative knowledge check during reading. It does not
assume that the whole paper has been read and does not start the final
CLOSED-BOOK RECALL stage.

```text
PROBE:
scope: "Figure 1 and the definitions before it"
mode: teach-back
questions: 2
```

A PROBE:

- stays at or before the current reading frontier;
- asks one question at a time;
- asks no more than three questions;
- preserves the learner answer verbatim;
- classifies understanding as `understood`, `partial`, `not_recalled`, or
  `misconception`;
- gives immediate local corrective feedback;
- records the interaction in the current session buffer for later CAPTURE.

## CAPTURE

`CAPTURE` persists a guided-reading, PROBE, study or recall session. The
assistant produces the artifacts; the learner is not expected to manually copy
the conversation.

```text
ydmp/papers/<paper_id>/study/
├── progress.yaml
├── sessions/<session_id>.md
├── model.md
├── verification.md
├── gaps.yaml
└── recall-cards.yaml
```

The session record is technically complete but edited: learner answers remain
verbatim while unrelated dialogue and duplicated navigation are removed. The
corrected canonical model and the current learning state are stored separately.

## Switchable Typst note templates

Four original blind visual candidates and one experimental Pinega Strata
candidate are preserved under:

```text
ydmp/templates/notes/
```

The current provisional ranking is:

1. Candidate C
2. Candidate A
3. Candidate D
4. Candidate B

Candidate C remains the default when no variant is supplied. The ranking is
not final and applies to the original A-D comparison. Candidate Strata is
available only by explicit selection and is evaluated through a PDF-only
long-form corpus containing guided-reading notes, a captured session, a
canonical MODEL snapshot, and a VERIFY snapshot. Candidate D is retained with
its current light typographic character even though initial feedback says the
font may be somewhat too thin.

Default use:

```typst
#import "ydmp/templates/notes/default.typ": paper_notes, note_panel

#show: paper_notes.with(
  title: "My paper notes",
  paper_id: "author-year-short-title",
  stage: "MODEL",
)
```

Explicit selection:

```typst
#import "ydmp/templates/notes/template.typ": paper_notes

#show: paper_notes.with(
  title: "My paper notes",
  variant: "candidate-a",
)
```

Experimental Strata selection:

```typst
#show: paper_notes.with(
  title: "My paper notes",
  variant: "candidate-strata",
)
```

See `ydmp/templates/notes/README.md`, `example.typ`, and
`ydmp/templates/notes/validation/README.md` for details.

## Nushell workspace

The repository uses a Nushell-only build and inspection layer. There is no
Cargo, Python, marimo, `just`, or language-specific package project.

Pinned tool versions are stored in:

```text
.nushell-version
.typst-version
```

The current supported toolchain is exact, not a version range. Check it before
building:

```bash
nu research.nu doctor
```

Script mode:

```bash
nu research.nu list papers
nu research.nu list documents
nu research.nu list categories
nu research.nu show paper herlihy-wing-1990-linearizability

nu research.nu build paper herlihy-wing-1990-linearizability
nu research.nu build document template-notes-candidate-c
nu research.nu build category isolation-theory
nu research.nu build all

nu research.nu check
nu research.nu watch template-notes-candidate-c
nu research.nu clean
```

For native Nushell commands and custom completions, import the same file as a
module:

```nu
use ./research.nu

research doctor
research build paper <TAB>
research build document <TAB>
research build category <TAB>
```

Generated files are written under `build/`, which is ignored by Git. `research
check` compiles all registered Typst entrypoints into a temporary directory and
removes it on completion. Use `research check --keep` only when diagnostics or
compiled files must be retained under `build/check/`.

Paper entrypoints are declared in `ydmp/papers/<paper_id>/paper.toml`.
Workspace-level entrypoints, such as visual template previews, are declared in
`research.toml`. See `docs/nushell-workspace.md` for the command and manifest
contracts.

## Custom GPT setup

1. Create a GPT named **YDMP Research Tutor**.
2. Enable Web Search, Code Interpreter & Data Analysis, and file uploads.
3. Paste `ydmp/custom-gpt/instructions.md` into Instructions.
4. Upload the Knowledge files listed in
   `ydmp/custom-gpt/configuration.yaml`.

## Add a command

Add `ydmp/commands/<command>.yaml` and register it in
`ydmp/commands/registry.yaml`. The stable dispatcher does not need rewriting.
