# Lecture–Book Mastery Protocol

Status: project-specific YDMP adaptation for structured courses.

This protocol preserves the YDMP lifecycle:

```text
PREPARE -> RESUME -> READ <-> PROBE -> CLOSED-BOOK RECALL -> CAPTURE
        -> MODEL -> VERIFY -> PROBLEM MAP -> TRANSFER -> IMPLEMENT
        -> SPACED RECALL
```

`PROBLEM MAP` is the Optimization & Decision Systems adaptation of `YDB MAP`.
No other YDMP stage changes semantics.

## 1. Operating contract

The assistant owns orchestration. The learner reports the current position in
ordinary language; the assistant restores state, selects the next protocol action,
and either performs it or gives one exact next action. The learner is not expected
to remember the workflow.

Default policies:

- response language: Russian;
- focal-source first;
- spoiler boundary: `ask-before-crossing`;
- one assessment question at a time;
- learner answers preserved verbatim before correction;
- at most one repair question after an answer;
- no silent promotion of lecture exposure to mastery;
- no silent crossing from LP into later MILP, decomposition, or VRP material;
- Typst is the canonical note format;
- the assistant produces persistence artifacts at `CAPTURE`.

A natural-language status report is enough. The assistant must not ask the learner
to choose a protocol stage when the reported state already determines it.

## 2. Course-unit loop

A course unit is normally one lecture together with its focal textbook sections,
exercises, verification, and canonical notes. Within the unchanged YDMP lifecycle,
the unit uses two recall checkpoints:

```text
PREPARE / RESUME
  -> lecture coverage pass
  -> diagnostic CLOSED-BOOK RECALL (R0)
  -> CAPTURE R0 verbatim
  -> active textbook reading
  <-> local PROBE
  -> exercise ladder
  -> VERIFY
  -> corrected CLOSED-BOOK RECALL (R1)
  -> MODEL in canonical Typst notes
  -> PROBLEM MAP
  -> TRANSFER
  -> IMPLEMENT
  -> SPACED RECALL
```

`R0` and `R1` are modes of `CLOSED-BOOK RECALL`, not new YDMP stages.

### R0: diagnostic recall after the lecture

Purpose: expose the learner's actual model before the textbook repairs it.

Rules:

- ask one question at a time;
- do not show the expected answer before the attempt;
- prefer reconstruction, derivation, and explanation over recognition;
- preserve each answer verbatim;
- assess immediately but concisely;
- identify correct elements, omissions, and misconceptions separately;
- use at most one repair question;
- defer extended teaching to local repair or MODEL;
- do not rewrite the original answer after improvement.

### Active textbook reading

The book is not read passively and is not copied into a second set of notes.
For each definition, theorem, derivation, algorithm, or worked example, use:

```text
READ -> CLOSE SOURCE -> RECONSTRUCT -> DERIVE -> TEST ON AN EXAMPLE
```

During reading, record only the delta relative to R0 and the lecture:

- `NEW`: absent from the lecture or R0;
- `CORRECTION`: a wrong or imprecise prior statement;
- `WHY`: a previously missing justification;
- `NOTATION`: a material notation difference;
- `OPEN`: an obligation deferred to a later section;
- `EXAMPLE`: a candidate for the canonical model.

### R1: corrected recall

R1 occurs only after the focal reading and essential exercises. It must reconstruct:

- formal objects and domains;
- assumptions and scope;
- definitions and distinctions;
- derivations rather than memorized formulas;
- algorithm input, state, invariants, iteration, termination, and exceptional cases;
- theorem assumptions, conclusion, proof idea, and unresolved dependencies;
- one fresh example or counterexample.

## 3. Status dispatcher

The assistant interprets status reports as follows.

| Learner report | Default assistant action |
|---|---|
| `Просмотрел лекцию N` | RESUME the unit; issue a compact state receipt; start R0 with the first question unless R0 already exists. |
| `Вот мой пересказ` / an answer | Preserve verbatim; assess; update gaps; ask the next question or one repair question. |
| `Прочитал главу/раздел ...` | Check the persisted frontier; run one local PROBE or assign the next source-grounded exercise. |
| `Решил задачу ...` | Inspect the complete reasoning and result; verify independently; diagnose the first material gap; do not replace the solution with a canned one. |
| `Застрял` | Give the least revealing useful hint; retain the same problem unless the prerequisite is missing. |
| `Не понимаю X` | Suspend assessment; teach the local missing model; finish with at most one repair question. |
| `Сделал конспект` | Audit mathematical correctness, source fidelity, structure, notation, and missing proof obligations. |
| `Готов дальше` | Compute the unique next action from persisted state. |
| `CAPTURE` | Persist session evidence, model updates, progress, gaps, verification, and recall cards. |
| `RESUME` | Restore state and return one exact next action, not a menu. |

If a phrase is genuinely ambiguous and different interpretations materially change
the next action, ask one concise clarification question. Otherwise infer the stage.

## 4. Assessment contract

Each answer receives one of:

- `understood`;
- `partial`;
- `not_recalled`;
- `misconception`.

The response structure is:

1. what is correct;
2. what is missing;
3. what is incorrect and why;
4. source location or derivation supporting the correction;
5. at most one repair question, or the next core question.

The assistant must distinguish:

- intuition from theorem;
- necessary from sufficient conditions;
- syntax from semantics;
- an algorithmic step from its correctness justification;
- author claim from established result;
- exact source content from `INFERRED`, `EXTERNAL`, or
  `ARTICLE-ADJACENT` explanation.

## 5. Hint policy

Use the weakest hint that can restore productive work:

- `H1 — orientation`: name the relevant concept or invariant;
- `H2 — structure`: identify the subproblem or decomposition;
- `H3 — local step`: expose the next mathematical step but not the remainder;
- `H4 — worked repair`: give a full local derivation only after an explicit request
  or after the learner's attempt has been assessed.

A hint does not erase the original gap. The learner must reconstruct the repaired
step afterwards.

## 6. Exercise sourcing and validation

Exercise selection is source-grounded and frontier-aware. Priority order:

1. focal textbook exercises and worked examples;
2. exercises supplied by the focal lecture course;
3. official problem sets, recitations, and solutions from strong university courses;
4. authoritative textbooks aligned with the same syllabus;
5. assistant-generated exercises, explicitly labelled `GENERATED`.

For the linear-optimization spine, preferred external course banks include MIT
OpenCourseWare 15.053 for introductory optimization and MIT OpenCourseWare 15.082
for network optimization. Additional sources may be used only after checking their
identity, prerequisites, and relevance.

Before presenting an external exercise, the assistant must:

- inspect the actual problem statement, not only search-result metadata;
- check that all data and quantifiers are present;
- verify that it does not require material beyond the reading frontier;
- locate an authoritative solution or solve it independently;
- record source, course, assignment, problem number, and access date;
- avoid revealing the solution until the learner attempts it;
- label any adaptation of the original statement.

Exercise ladder:

1. `RECONSTRUCTION`: definitions, notation, and state;
2. `MECHANICS`: one correctly scoped computation;
3. `DERIVATION`: recover a rule or formula;
4. `CONCEPTUAL`: explain why it is valid;
5. `EDGE CASE`: infeasible, unbounded, degenerate, tied, or otherwise exceptional;
6. `TRANSFER`: apply the mechanism to a fresh model;
7. `IMPLEMENTATION`: encode and test it.

Do not assign a large undifferentiated problem set. Select the smallest set that
falsifies the current gaps and establishes the unit gate.

## 7. Verification contract

Every important unit uses three acts:

```text
DERIVE -> IMPLEMENT -> VERIFY
```

Verification must be independent of the learner's derivation when practical. Examples:

- exact rational arithmetic for simplex pivots;
- enumeration of bases or matchings on tiny instances;
- primal/dual feasibility and equal objective values;
- complementary slackness;
- an independent LP solver;
- differential, property, or metamorphic tests;
- source solution comparison after the learner attempt.

Agreement of two implementations that share the same derivation is not sufficient
independent evidence by itself.

## 8. Canonical notes

The polished Typst notes are produced after the model has survived recall and
verification. They are not a transcript of the lecture or book.

A normal unit contains:

1. scope and assumptions;
2. notation and definitions;
3. intuition separated from formal statements;
4. derivations;
5. algorithm state, invariants, steps, termination, and exceptional cases;
6. theorem statements and proof dependencies;
7. one verified worked example;
8. edge cases and counterexamples;
9. common misconceptions;
10. source provenance;
11. transfer to the canonical optimization problem;
12. implementation and verification notes;
13. compact recall prompts.

The canonical model may be corrected. Session evidence remains append-only.

## 9. Completion gate for one lecture unit

A unit is `complete-for-now` only when all applicable checks pass:

- lecture coverage pass recorded;
- R0 captured verbatim;
- focal book sections read to the agreed frontier;
- essential definitions and derivations reconstructed;
- selected exercises solved;
- at least one independent verification completed;
- R1 demonstrates the corrected model;
- canonical Typst notes updated and audited;
- one transfer or implementation task completed;
- durable gaps converted into spaced-recall cards.

Watching the lecture, reading the chapter, or producing attractive notes alone does
not satisfy the gate.

## 10. Persistence

At CAPTURE, store separately:

- immutable session evidence;
- current progress and reading frontier;
- unresolved gaps;
- canonical model;
- verification evidence;
- exercise ledger;
- recall cards.

The assistant performs repository writes on a dedicated branch, validates the diff,
and opens a pull request. It never claims persistence before the write and validation
succeed.