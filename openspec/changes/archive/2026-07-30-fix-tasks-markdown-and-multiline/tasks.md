## 1. Fold continuation lines in `@spekjs/core`

- [x] 1.1 In `packages/core/src/tasks.ts`, collect each task's continuation lines instead of dropping
      them: a line continues the current task when it is neither a column-0 checkbox nor a `##` heading,
      except that after one or more blank lines it must be indented at least 2 characters. Keep
      `CHECKBOX_RE` anchored at column 0 — relaxing it would change `total` / `completed`
- [x] 1.2 Dedent each continuation line by up to 2 leading whitespace characters (the `- ` marker's
      content offset) and newline-join onto the first line. Do not normalize any other whitespace
- [x] 1.3 Preserve the first line verbatim when continuation lines exist so a two-trailing-space hard
      break survives; keep today's `.trim()` result exactly for tasks with no continuation lines. Drop
      only trailing blank lines from the end of a task's text
- [x] 1.4 Note on `TaskItem.text` that it may span multiple lines and holds Markdown, so the contract is
      explicit for registry consumers and for the Kotlin mirror

## 2. Test the parser

- [x] 2.1 Create `packages/core/src/tasks.test.ts` — there is currently no test file for `parseTasks` at
      all. Cover the folding rules with exact-string assertions: 2-space sub-bullets, continuation
      indented 6 spaces (exactly 2 removed), relative nesting preserved, lazy column-0 continuation,
      tab indentation
- [x] 2.2 Cover the blank-line boundary both ways: unindented prose after a blank line ends the task;
      prose indented 2 after a blank line continues it
- [x] 2.3 Cover break preservation: two trailing spaces survive, a backslash break survives, and a task
      with no trailing whitespace is unchanged
- [x] 2.4 Cover the invariants that must not move: a single-line task's `text` is byte-identical to
      today's trimmed output and contains no newline; indented `- [ ]` checkboxes do not increment
      `total`; existing section grouping and `{ total, completed }` results are unchanged
  - 17 cases, all passing. Full core suite stays at 185 passing / 0 failing.

## 3. Render task text as Markdown

- [x] 3.1 Add `packages/web/src/components/TaskText.tsx` — react-markdown + remark-gfm (both already web
      dependencies, no new packages) with a minimal component map reusing `MarkdownRenderer`'s Tailwind
      classes for `code` / `strong` / `em` / `a` / `ul` / `ol` / `li`. Override the paragraph to a
      margin-free element so a single-line task stays inline with its checkbox icon
- [x] 3.2 Deliberately leave out BDD keyword highlighting and heading-anchor ids — both would change the
      Tasks tab beyond the reported defect
- [x] 3.3 In `packages/web/src/pages/ChangeDetail.tsx`, replace the raw `{task.text}` text node with
      `TaskText`, keeping the existing SVG icons, `items-start` alignment, strikethrough and opacity
      styling untouched
  - The text wrapper changed from `<span>` to `<div>`: task text can now contain block content
    (lists, code) and a `<p>`/`<ul>` inside a `<span>` is invalid nesting. Visually neutral — a flex
    item's display is blockified either way. Added `min-w-0` so a code block scrolls inside the row
    instead of widening the page.
- [x] 3.4 Confirm the completed-task strikethrough still applies across the rendered Markdown rather
      than only the first inline run
  - Verified in the running app on the archived `add-change-detail-toc` change: strikethrough covers
    the nested bullet lists too, not just the first line.

## 4. Test standard conformance

- [x] 4.1 Add `packages/web/src/components/TaskText.test.ts` (`.test.ts` with `createElement`, matching
      the repo's existing component-test style and the `src/**/*.test.ts` glob — a `.test.tsx` would not
      be picked up by `npm test`). Use `react-dom/server`'s `renderToStaticMarkup`, already available
      via the existing `react-dom` dependency
- [x] 4.2 Assert the conformance property directly: for a given `tasks.md` source, rendering the folded
      `text` through `TaskText` matches the inner HTML of the corresponding list item when the original
      source is rendered as Markdown in situ. Cover hard break, soft break, lazy continuation,
      blank-line boundary, sub-bullets at 2 / 4 / 6 spaces, nested bullets, and inline formatting
  - The comparison normalizes away `class`, `target`/`rel` and the two renderers' different spelling
    of a read-only checkbox, and strips `<p>` (a tight reference item has no paragraph wrapper).
    Structure, nesting and text are compared as-is.
- [x] 4.3 Include the blank-line-then-6-space indented code block case explicitly — it is the only
      construct that distinguishes the dedent rule from doing nothing, so without it the rule is
      untested and can silently regress
  - Confirmed necessary: with the dedent removed, this case renders `<code>··six space content` against
    the reference's `<code>six space content`. Every other case, and all 82 corpus files, are
    indistinguishable — so this is the single test carrying the rule.
- [x] 4.4 Add a sweep over the repo's own `openspec/**/tasks.md` as a regression net, skipping cleanly if
      the directory is absent so the test does not depend on repo content to pass
  - 82/82 files render identically to the reference. 15 tests total in this file, all passing.

## 5. Keep IntelliJ aligned

- [x] 5.1 Apply the same folding, boundary, dedent and trailing-whitespace rules to
      `packages/intellij/src/main/kotlin/com/spek/intellij/core/TaskParser.kt`
- [x] 5.2 Add `packages/intellij/src/test/kotlin/com/spek/intellij/core/TaskParserTest.kt` — none exists
      today — asserting the same cases as 2.1–2.4 so the two implementations cannot drift silently
- [x] 5.3 Run `./gradlew test` and confirm the reported test count actually includes the new class;
      Gradle runs instrumented output, so a stale build can pass while running old bytecode
  - `TEST-com.spek.intellij.core.TaskParserTest.xml` reports `tests=18 failures=0`, freshly timestamped.
    `compileKotlin` printed UP-TO-DATE, but the folding assertions cannot pass against the old parser,
    so the new bytecode demonstrably ran. Whole module: 104 tests, 0 failures.

## 6. Verify

- [x] 6.1 `npm run type-check` and `npm test` clean. Note that `npm run build` and `build:webview` use
      `cp` / `rm -rf` and fail under Windows shells — run `tsc` plus a manual copy if a build is needed
  - type-check passes; tests 185 + 24 + 60, 0 failures. `npm run build -w @spekjs/core` did work here
    (Git Bash provides `rm`); web consumers resolve `@spekjs/core` from `dist/`, so core must be rebuilt
    before web tests exercise a parser change — otherwise they silently test the published build.
- [x] 6.2 Check the Tasks tab in the running web app against a change with multi-line tasks and one with
      only single-line tasks; confirm the single-line layout is visually unchanged from before
  - Sub-bullets that were previously invisible now render as nested lists, and inline code renders as
    pills. Single-line rows keep their original alignment against the checkbox icon.
- [x] 6.3 Confirm no task's progress numbers moved: parse the repo's corpus before and after and diff the
      `{ total, completed }` per change
  - Across 82 files: 0 differences in `total` / `completed`, 0 in per-section counts, 0 in section
    titles, 0 in completion flags, and every task's first line byte-identical to the old text. 113 tasks
    gained continuation lines.
- [x] 6.4 Run the repo's quality gates on the touched files (mutation testing, LSP diagnostics,
      unused-export lint) without committing the tooling
  - 12 targeted mutants of the new logic, all killed: content offset 0 / 1 / 3, boundary always/never
    terminating, boundary comparison flipped, first line trimmed when folded, trailing blanks kept,
    single-line trim dropped, tab excluded from dedent, checkbox regex allowing indentation, blank lines
    not recorded. LSP diagnostics clean on every touched file.

## 7. Block-opener boundary (applied by the maintainer on merge)

- [x] 7.1 Lazy continuation was folding column-0 block-openers into the preceding task, so a plain
      `- Note: …` bullet became a nested list and a `---` turned the task into a setext heading —
      the opposite of the rendering-equivalence property this change is built on
  - `BLOCK_OPENER_RE` in both parsers: a column-0 bullet / ordered marker / ATX heading / blockquote
    / code fence / thematic break ends the item. An indented one still belongs to the task
  - Every entry was checked against the reference renderer rather than read off the CommonMark spec.
    `2.` is included because remark ends the item on it, though the "only a list starting at 1
    interrupts a paragraph" rule reads like it should not; `===` is excluded because it is absorbed
    as paragraph text, not a block start
  - Counting is untouched by construction: none of these lines is a column-0 checkbox, so they end a
    task without starting one
- [x] 7.2 Twelve cases added on each side, plus the two known divergences documented in the spec
  - core 197 passing, `TaskParserTest` 30, IntelliJ module 116, web 60, ui 24, type-check clean
  - Re-ran the PR's own reference-comparison harness over the block-opener cases: 13/15 match. The
    two that do not are the documented setext and fenced-checkbox divergences, both pre-existing
