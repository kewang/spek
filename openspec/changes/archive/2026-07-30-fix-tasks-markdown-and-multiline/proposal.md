## Why

The Tasks tab is the only artifact view that never reaches a Markdown parser, so `**bold**` and
`` `code` `` in a task show as literal asterisks and backticks. Worse, `parseTasks` keeps a line only
when it matches the checkbox or section pattern and silently discards everything else, so a task's
continuation lines never enter the data model at all — 159 such lines exist in this repo's own
`openspec/` history and none of them are visible in any delivery surface.

## What Changes

- `parseTasks` attaches a task's continuation lines to that task instead of dropping them. They are
  folded into the existing `text` field, newline-joined, each dedented by up to 2 leading whitespace
  characters — the `- ` marker's CommonMark content offset — so the folded text is valid Markdown.
  (Dedenting by the *smallest* indent found was considered and rejected; see `design.md`.)
- The Tasks tab renders each task's `text` as Markdown, so inline formatting (`**bold**`,
  `` `code` ``, links) displays instead of raw source.
- IntelliJ's Kotlin `TaskParser` is kept aligned with the same folding rules.

Non-goals — deliberately excluded to keep the fix to the reported defects:

- The checkbox pattern stays anchored at column 0. Relaxing it to allow leading whitespace would pull
  indented checkboxes into `total`/`completed` and shift every progress bar and CI status badge. An
  indented `- [ ]` becomes part of its parent's text and displays, but is **not** a counted task.
- No new `TaskItem` field and no tree/children restructuring — `text` carries the folded body, so
  `@spekjs/core`'s public API and the IntelliJ serialization contract are unchanged.
- No change to `TaskProgress`, the dashboard statistics, or the badge generator.
- No restyling or relayout of the Tasks tab beyond task text now being formatted.

Task counting behavior is unchanged.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `task-parser`: continuation lines following a checkbox are folded into that task's `text` (dedented,
  newline-joined) rather than discarded; the statistics requirement is restated to make explicit that
  only column-0 checkboxes count.
- `change-browsing`: the Tasks tab renders task text as Markdown rather than as a plain text node.

## Impact

- `packages/core/src/tasks.ts` — `parseTasks` line loop gains continuation-line handling and dedent
  normalization. Behavior change for registry consumers of `@spekjs/core`: `TaskItem.text` may now
  contain newlines, where it was previously always single-line. No type or field change; additive in
  effect, but consumers that assume a one-line label should know.
- `packages/web/src/pages/ChangeDetail.tsx` — the tasks branch renders `task.text` through Markdown.
  Shared by the VS Code webview, which is built from the same source.
- `packages/intellij/src/main/kotlin/com/spek/intellij/core/TaskParser.kt` — parity with the TS rules,
  plus its tests in `src/test/kotlin`.
- No API endpoint, dependency, or schema changes; `react-markdown` and `remark-gfm` are already
  dependencies of the web package.
