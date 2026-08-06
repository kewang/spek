# Task parser fixture corpus

One shared corpus, read in full by both implementations of the task parser:

- `parseTasks` in `@spekjs/core` — `packages/core/src/tasks.corpus.test.ts`
- `TaskParser` in the IntelliJ plugin — `packages/intellij/src/test/kotlin/com/spek/intellij/core/TaskParserCorpusTest.kt`

The two are separate implementations of one rule. Hand-mirrored test suites cannot catch a rule that
both files spell the same way and the two runtimes read differently — the mirrored assertions agree
precisely because they were copied across. This corpus is the mechanism instead: **adding a case is
adding one file here**, and both languages assert it from the next run.

This directory lives outside both packages so neither depends on the other, and outside every
directory a published artifact is built from, so it cannot reach the npm tarball or the plugin jar.

## Adding a case

Create `<name>.json`. Nothing else — there is no index to update.

```json
{
  "name": "lone-cr-separates-lines",
  "note": "CommonMark counts a lone CR as a line ending, so this is two tasks.",
  "input": "- [x] a\r- [ ] b",
  "expected": {
    "total": 2,
    "completed": 1,
    "sections": [
      {
        "title": "",
        "tasks": [
          { "text": "a", "completed": true },
          { "text": "b", "completed": false }
        ]
      }
    ]
  }
}
```

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Must equal the filename without `.json`, so the two cannot drift |
| `note` | yes | Why this case exists. This is where a migrated test's comment goes |
| `input` | yes | The tasks.md content, as a JSON string |
| `expected` | yes | The whole parse result: `total`, `completed`, and `sections` with each task's `text` and `completed` |
| `divergences` | no | Per-implementation overrides — see below |
| `meta` | no | Free-form provenance (issue number, origin). Ignored by the loaders |

Unknown fields are rejected, as are values of the wrong type.

## Escapes, always

**Never write a character literally when an escape exists for it.** The cases worth the most here are
exactly the ones a file cannot carry safely: a lone carriage return, U+0085, U+001C, U+00A0, trailing
spaces that carry a Markdown hard line break. Line-ending normalisation, a Windows checkout, an editor
that trims on save, and automated edits all rewrite those — and the case still *looks* present
afterwards.

So: `\r`, `\u0085`, `\u001c`, `\u00a0` in the JSON source. A byte-level check in the Node suite
enforces this and will fail the run if a literal one appears. It is not optional hygiene — the two
JSON parsers disagree about such files. A raw line feed, carriage return or U+001C inside a string
literal is **rejected by `JSON.parse` and accepted by kotlinx-serialization**, so a flattened escape
is a hard failure on one side and a silent pass on the other.

## Expected values are authored, not captured

The fields a case exists to pin are written by a person and reviewed. Do not paste in the output of a
run: in both divergences found so far, *each* implementation was wrong in one direction, so capturing
either would have blessed the bug. A reference CommonMark+GFM renderer (`react-markdown` +
`remark-gfm`, as used by `TaskText.test.ts`) is the arbiter for rendering questions; it cannot answer
questions about `total`, which follows the parser's own column-0 anchor rule.

The structural remainder — fields the case has no opinion about, such as section titles in a case
about continuation boundaries — may be filled from a run, provided a reviewer confirms them.

## Recording an accepted divergence

When the two implementations differ on purpose, record it rather than dropping the case:

```json
  "divergences": {
    "kotlin": {
      "reason": "U+0085 is a line terminator to Java's regex engine and an ordinary character to JavaScript's, so the checkbox line is not a task here. Retained deliberately - see openspec/specs/task-parser.",
      "expected": { "total": 0, "completed": 0, "sections": [] }
    }
  }
```

Recognised implementation ids: `typescript`, `kotlin`. They name the **runtime**, since that is what
these differences are about.

Rules the loaders enforce:

- An unrecognised id is an error, never a silently ignored entry. A typo'd `"Kotlin"` would otherwise
  leave the divergence unrecorded while the run still reported success
- A `reason` is mandatory and non-empty. A divergence is a decision, and it has to be readable
- At least one implementation must assert the shared `expected`. Overriding every implementation
  asserts nothing in common — that is two single-language tests sharing a filename

A divergence is for a difference that has been adjudicated and deliberately kept. A newly found
disagreement is a bug until someone decides otherwise; park it and open an issue rather than reaching
for `divergences`.

## Testing that a bad fixture is rejected

`invalid/` is a second shared corpus, for the **loaders** rather than the parser. One file per
rejection case:

```json
{
  "name": "unknown-field",
  "note": "A field the format does not define is a typo or a newer format; either way it must not be ignored.",
  "fileName": "case.json",
  "document": "{\"name\":\"case\", ... }",
  "stage": "parse",
  "expectedMessage": "has unknown field \"expcted\""
}
```

`document` is the fixture text as a **string**, so a case can be malformed JSON. `stage` is which
check must reject it — `bytes` for the byte-level hygiene check, `parse` for everything else.
`expectedMessage` is a substring the error must contain.

Every loader must reject every case, **name the file**, and produce a message containing that
substring. Asserting the message is the point: it holds the loaders' wording in agreement, so a rule
one side words differently is a failure rather than a slow drift.

This exists because the loaders' rules used to be two hand-written suites mirroring each other — the
same structure this corpus exists to remove, one level down — and they had already produced a
divergence neither could see: `"meta": null` was rejected properly by Kotlin and threw a bare
`TypeError` naming no file on the Node side.

`invalid/` is **not** substitutable by a generated scratch directory. Generated inputs replace what
the parser is asked to parse; they do not replace the rules by which a loader decides a fixture is
valid.

## Finding new cases

The corpus records what someone thought of. To *discover* divergences, run the generator:

```bash
npm run build:core    # the generator imports @spekjs/core through its built dist/
npx tsx scripts/generate-task-parser-corpus.ts --count 500 --seed 7
```

It writes randomised inputs in this format to an untracked scratch directory, with `expected` from the
TypeScript implementation — not as an oracle, but as a disagreement detector. Point either suite at
that directory to see what the other side does with them:

```bash
SPEK_TASK_CORPUS_DIR=<scratch> npm test -w @spekjs/core
cd packages/intellij && ./gradlew test -Dspek.taskParserCorpus=<scratch>
```

Adjudicate anything it reports, minimise the input (the batch is reproducible from its `--seed`),
then add it here as an ordinary authored fixture. Generated runs are never part of a gate: a
random-input gate is a flaky gate, and a disagreement is not by itself a verdict on either side.

U+0085 is **excluded from the generated alphabet by default**, because a generated fixture cannot
carry a `divergences` entry and the known difference would otherwise be ~3% of every batch, drowning
the signal. Pass `--include-known-divergences` to probe that neighbourhood deliberately.
