## Why

The task parser exists twice — `parseTasks` in `@spekjs/core` and its Kotlin mirror `TaskParser.kt` —
and each carries a rule spelled the same way on both sides that the two language runtimes read
differently. Two such rules are known, and neither is caught by the case-mirrored unit tests that are
currently the only thing holding the implementations together.

### Line endings (issue #33)

The two disagree about whether a line ending in a bare `\r` holds a checkbox. Both use the pattern
`^- \[([ xX])] (.+)$`, but Java's `$` also matches before a final line terminator while JavaScript's
`$` (no `m` flag) matches only at the absolute end of the string. The same `tasks.md` therefore yields
a different `total` in the IntelliJ plugin than in the Web and VS Code surfaces.

Measuring both against the reference renderer (`react-markdown` + `remark-gfm`, the same reference the
existing folding tests compare to) shows the divergence is not the whole problem — the TypeScript side
is the one that is wrong:

| Source | Reference | Kotlin | TypeScript |
|---|---|---|---|
| `- [x] a\r` | 1 | 1 | **0** |
| `- [x] a\r\r\n- [x] b` | 2 | 2 | **1** |
| `- [x] a\n- [x] b\r` | 2 | 2 | **1** |
| `- [x] a\r- [x] b` | 2 | **0** | **0** |

CommonMark defines a line ending as `\n`, `\r\n`, **or a lone `\r`**, and the reference renderer honours
all three. Both implementations normalise only `\r\n` before splitting on `\n`, so a lone `\r` is never
a line break to either of them — which is why the last row is wrong on both sides and absent from the
issue's own analysis. Aligning Kotlin down to TypeScript's answer, as the issue suggests, would settle
the two on the wrong result and leave that row broken.

### Blank lines

Found while verifying the above, and the same defect in a different rule. A blank line is spelled
`line.trim() === ""` in TypeScript and `line.isBlank()` in Kotlin — one intent, two different notions
of whitespace. CommonMark's is a third: a blank line contains only spaces and tabs.

| Line content | Reference | Kotlin | TypeScript |
|---|---|---|---|
| U+00A0 (NBSP) | not blank | not blank | **blank** |
| U+FEFF (BOM), U+2007, U+202F | not blank | not blank | **blank** |
| U+001C (file separator) | not blank | **blank** | not blank |

Each implementation is wrong in one direction. It matters because a blank line moves the continuation
boundary: with `- [ ] Task`, an NBSP-only line, then unindented prose, the reference keeps the prose
inside the task while TypeScript drops it. NBSP survives ordinary copy-paste, so this is reachable
without any of the exotic file encodings the `\r` case needs.

## What Changes

- Normalise all three CommonMark line endings — `\r\n`, `\r`, `\n` — to `\n` before splitting, in both
  `packages/core/src/tasks.ts` and `packages/intellij/.../core/TaskParser.kt`. This aligns the two
  implementations *and* aligns both with the reference renderer.
- Replace `$` with `\z` in the Kotlin `CHECKBOX_RE` and `SECTION_RE`. Once no line carries a trailing
  `\r` the two spellings are equivalent, so this changes no behaviour; it removes the engine-dependent
  reading and matches what `BLOCK_OPENER_RE` already does deliberately for the same reason.
- Define a blank line explicitly as "spaces and tabs only" on both sides, replacing `trim() === ""` and
  `isBlank()`. This is CommonMark's rule and the same `[ \t]` class `leadingWhitespace` already uses on
  both sides, so the two implementations stop depending on their runtime's whitespace table.
- Add mirrored tests on both sides covering each row of the tables above — case-mirrored unit tests are
  currently the only mechanism keeping the two parsers honest.

Deliberately out of scope: the shared-fixture / differential-test corpus that would catch this class of
drift structurally rather than by remembering to mirror each case. It is a larger piece of work with
its own design questions (where the fixtures live, how the Gradle and Node suites both consume them);
this change fixes the defect and leaves that as a follow-up.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-parser`: add requirements fixing the two boundary definitions the parser leaves to its runtime
  today — which byte sequences end a line, and which characters make a line blank — and stating that
  both hold identically across implementations, so every surface reports the same tasks for the same
  file.

## Impact

- `packages/core/src/tasks.ts` — line-ending normalisation and the blank-line predicate in `parseTasks`.
- `packages/intellij/src/main/kotlin/com/spek/intellij/core/TaskParser.kt` — the same two, plus `\z` in
  `CHECKBOX_RE` / `SECTION_RE`.
- `packages/core/src/tasks.test.ts` and
  `packages/intellij/src/test/kotlin/com/spek/intellij/core/TaskParserTest.kt` — mirrored cases.
- **Behaviour change for `@spekjs/core` consumers**, on files this repo does not contain:
  - `total` / `completed` / `sections` change for a `tasks.md` using lone `\r` line endings —
    previously under-counted, now counted.
  - A task's `text` changes where an exotic-whitespace-only line sits inside or after it.

  Nothing in this repo moves (it is LF-normalised via `.gitattributes` and carries no such whitespace),
  and the badge generator and progress bars read whatever the parser returns, so they follow
  automatically. **For whoever cuts the release**: these are observable output changes in a published
  package, so they warrant a **minor** bump of `@spekjs/core`, not a patch.
