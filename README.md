# YDMP Research Workspace

This repository stores the modular **YDB Deep Mastery Protocol (YDMP)**.

The first command is `PREPARE`. It accepts a DOI, URL, title, BibTeX record,
or uploaded PDF and generates:

- `prepare.yaml`
- `prepare.json`
- `prepare.md`
- `prepare.typ`
- `references.bib`

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
