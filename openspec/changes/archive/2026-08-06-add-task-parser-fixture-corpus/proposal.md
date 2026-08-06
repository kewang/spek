## Why

`parseTasks` in `@spekjs/core` and `TaskParser.kt` in the IntelliJ plugin are two implementations of one
rule, kept aligned by convention and verified by two unit suites hand-mirrored case for case. That
mechanism structurally cannot catch the case where both files spell a rule the same way and the two
runtimes read that spelling differently — the mirrored assertions agree precisely because they were
copied across, and neither side ever asks what the other actually returns.

Two instances have already shipped and been fixed (issue #41, and #33 before it): Java's regex `$` also
matches before a trailing line terminator while JavaScript's does not, so a line ending in a bare `\r`
was a checkbox to one parser only; and `isBlank()` and `trim() === ""` cover different whitespace, so a
line holding only U+00A0 or only U+001C moved the continuation boundary on one side only. Both were
found by hand, by reading the two languages' semantics side by side. There is no reason to think two is
the total.

## What Changes

- Add a **shared fixture corpus** — one directory, read by both the Node suite and the Gradle suite.
  Each fixture pairs a tasks.md input with the expected `{total, completed, sections}`. Adding a case
  means adding one fixture; both languages are then checked with no step a person has to remember.
- **Fixture inputs are stored escaped, not as raw `.md` files.** The cases that matter most are exactly
  the ones a raw file cannot hold safely: a lone `\r`, U+0085, U+001C, U+00A0, trailing spaces that
  carry a hard line break. Editors, formatters, `.gitattributes` line-ending normalisation and agent
  tooling all silently rewrite those, which would neuter a case while leaving it looking present.
- **Expected output is committed and human-reviewed, not derived from either implementation.** In both
  bugs above *each* side was wrong in one direction; making either authoritative would have blessed the
  bug. The reference renderer (`react-markdown` + `remark-gfm`, already used by `TaskText.test.ts`) may
  generate candidate values, but it exists only on the Node side and only answers rendering questions —
  it cannot arbitrate `total` under the column-0 anchor rule.
- **Accepted divergences are recorded in the corpus itself.** U+0085 is deliberately different between
  the two runtimes; a fixture must be able to state a per-implementation expectation so the harness
  reports it as pinned rather than as a failure, forever.
- Both existing suites gain a corpus-driven test; the hand-written cases that the corpus subsumes are
  migrated into it, and the ones that assert something a fixture cannot — an equivalence between two
  inputs, or a property rather than a value — stay where they are.
- **A generator, because the corpus alone does not close the hole.** A corpus makes each *discovered*
  case permanent and bilingual, but it never compares the two implementations to each other — every
  fixture asserts against an authored constant — and a person still has to think of the input. That is
  the part the issue says does not scale. A script emits randomised inputs in the fixture format into a
  scratch directory that the same two loaders can be pointed at; a mismatch is a disagreement for a
  person to adjudicate, after which the minimised input enters the committed corpus as an ordinary
  fixture. It needs no oracle and no cross-runtime bridge — the corpus format is the bridge — and it is
  run deliberately, never as a CI gate.

This is a test-infrastructure change. No parser behavior changes, and no shipped artifact changes —
`@spekjs/core` publishes only `dist`, so the corpus never reaches registry consumers.

## Capabilities

### New Capabilities

- `task-parser-fixture-corpus`: the shared corpus as a contract — where fixtures live so neither package
  depends on the other, the fixture file format (escaped input, expected statistics and task texts,
  per-implementation expectations for accepted divergences), the obligation on every implementation of
  the task parser to run the whole corpus as part of its own test suite, and the generator that feeds
  those same loaders throwaway inputs so divergences can be discovered rather than only recorded.

### Modified Capabilities

- `task-parser`: the **Implementations agree on every input** requirement currently bounds agreement to
  "every input covered by this capability's scenarios" and leaves the verification mechanism unstated.
  It changes to require agreement over the shared corpus, to require that a newly discovered divergence
  enter the corpus as a fixture, and to point the U+0085 exception at its recorded form there.

## Impact

- **New**: a corpus directory at a location outside both packages, a fixture loader on each side
  (TypeScript for `@spekjs/core`, Kotlin for the IntelliJ plugin), and a generator under `scripts/`
  writing to an untracked scratch directory.
- **Modified**: `packages/core/src/tasks.test.ts` and
  `packages/intellij/src/test/kotlin/com/spek/intellij/core/TaskParserTest.kt` — cases move into the
  corpus; the file comment on each ("these mirror the other case for case") stops being the mechanism.
- `packages/intellij/build.gradle.kts` (corpus wired into the `test` task) and `.gitignore` (the
  generator's scratch directory). The generator lands under `scripts/`, which `npm run type-check` and
  `npm run lint` already cover.
- `openspec/specs/task-parser/spec.md` — one requirement modified. Docs that currently describe
  hand-mirroring as the mechanism: `CLAUDE.md`, `CONTRIBUTING.md`, `docs/prd.md`.
- **Not affected**: parser source on either side, the `CLAUDE.md` folding rules, CI workflow definitions
  (`npm test` and `./gradlew test` already run both suites), `@spekjs/core`'s published contents and
  version line, and every delivery surface's runtime behavior.
- **Risk to watch**: a Gradle test's working directory and a Node test's differ, so the corpus path
  resolution is the one place this change can break a suite without touching a parser.
