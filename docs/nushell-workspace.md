# Nushell document workspace

`research.nu` is the only orchestration implementation for this repository.
Typst remains the document compiler; Nushell provides discovery, validation,
selection, command completion, toolchain checks, and artifact placement.

## Toolchain policy

The exact supported versions are stored in plain-text files:

```text
.nushell-version
.typst-version
```

`research doctor`, every build command, `check`, and `watch` reject a mismatched
toolchain. Metadata-only commands require the pinned Nushell version but do not
require Typst.

Typst executable resolution order:

1. path in `RESEARCH_TYPST`;
2. `.tools/typst/<pinned-version>/typst` (or `typst.exe`);
3. `typst` from `PATH`.

`.tools/` is local and ignored. Nushell cannot replace its own running binary,
so invoke the repository with the pinned `nu` executable. The version check is
performed immediately after the file has parsed.

## Invocation modes

Script mode works in any parent shell:

```bash
nu research.nu list papers
nu research.nu build paper <paper-id>
```

Interactive module mode exposes native Nushell commands and dynamic
completions:

```nu
use ./research.nu
research build paper <TAB>
```

The module and script modes execute the same implementation.

## Commands

```text
research doctor
research version

research list papers
research list documents
research list categories
research show paper <paper-id>

research build paper <paper-id> [--document <name>] [--format <format>]
research build document <document-id> [--format <format>]
research build category <category> [--format <format>]
research build all [--format <format>]

research check [--keep]
research watch <document-id> [--format <format>]
research clean
```

Commands return structured Nushell records or tables wherever practical, so
callers can continue with `where`, `select`, `to json`, and other pipelines.

## Paper manifests

Each prepared paper has an explicit build manifest:

```toml
schema = 1

[paper]
metadata = "prepare.json"
tags = ["concurrency", "linearizability"]

[[documents]]
id = "prepare"
source = "prepare.typ"
formats = ["pdf"]
required = true
categories = ["prepare"]
```

The manifest stores build-only information. Bibliographic identity, title,
year, and curriculum stage remain sourced from `prepare.json` and are not
duplicated.

A paper document receives a global ID of the form:

```text
<paper-id>/<document-id>
```

Future notes and translations should use conventional entrypoints such as
`notes/main.typ` and `translation/main.typ`, then register them in `paper.toml`.
Library modules and partial Typst files must not be registered as entrypoints.

## Workspace documents

Non-paper documents are declared through `[[documents]]` entries in
`research.toml`. These entries are used for note-template previews and may
supply fixed Typst `sys.inputs` values:

```toml
[[documents]]
id = "template-notes-candidate-c"
source = "ydmp/templates/notes/thoughts-example.typ"
formats = ["pdf"]
categories = ["template-preview", "notes"]
inputs = { variant = "candidate-c", show-thoughts = "true" }
```

## Categories

A paper document automatically belongs to:

- its curriculum stage from `prepare.json`;
- paper tags from `paper.toml`;
- document categories from its manifest.

Workspace documents use their declared categories. `research list categories`
shows the derived set and `research build category` compiles every matching
entrypoint separately.

## Artifacts

Persistent local builds are written under:

```text
build/<format>/papers/<paper-id>/<document>.<format>
build/<format>/workspace/<document>.<format>
```

`build/` is reproducible and ignored by Git.

`research check` uses a unique directory under `$nu.temp-dir`, aggregates Typst
failures, and removes the directory after completion. `--keep` redirects check
outputs to `build/check/`.

PDF is enabled by default. HTML support is represented in the command and
manifest model but remains disabled in `research.toml` until the paged templates
are deliberately adapted and validated against Typst's experimental HTML
export.

## Version upgrade procedure

1. create a dedicated branch;
2. change `.nushell-version` and/or `.typst-version`;
3. install the proposed binaries;
4. run `nu research.nu doctor`;
5. run `nu research.nu check`;
6. inspect representative PDFs visually;
7. let GitHub Actions repeat the exact check;
8. merge only after the whole registered corpus compiles.

Published "latest" versions are never accepted automatically.

## Current validation baseline

The initial workspace baseline is validated with Nushell `0.114.1` and Typst
`0.15.1`. CI checks both script mode and module mode and compiles all seven
currently registered PDF entrypoints:

- two paper `prepare.typ` documents;
- Candidate A, B, C, and D annotated previews;
- Candidate C clean preview.
