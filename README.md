# YDMP Research Workspace

This repository stores the modular **YDB Deep Mastery Protocol (YDMP)**.

## Lifecycle

```text
PREPARE -> READ -> CLOSED-BOOK RECALL -> CAPTURE -> MODEL -> VERIFY
        -> YDB MAP -> TRANSFER -> IMPLEMENT -> SPACED RECALL
```

## PREPARE

`PREPARE` accepts a DOI, URL, title, BibTeX record, or uploaded PDF and
generates:

- `prepare.yaml`
- `prepare.json`
- `prepare.md`
- `prepare.typ`
- `references.bib`

## CAPTURE

`CAPTURE` persists a completed study or recall session. The assistant produces
the artifacts; the learner is not expected to manually copy the conversation.

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

## Custom GPT setup

1. Create a GPT named **YDMP Research Tutor**.
2. Enable Web Search, Code Interpreter & Data Analysis, and file uploads.
3. Paste `ydmp/custom-gpt/instructions.md` into Instructions.
4. Upload the Knowledge files listed in
   `ydmp/custom-gpt/configuration.yaml`.

## Add a command

Add `ydmp/commands/<command>.yaml` and register it in
`ydmp/commands/registry.yaml`. The stable dispatcher does not need rewriting.

## Notebook

Use marimo with DuckDB:

```bash
uv sync
uv run marimo edit ydmp/notebooks/ydmp_prepare.py
```
