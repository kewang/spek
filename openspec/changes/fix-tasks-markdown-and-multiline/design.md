## Context

`parseTasks` is a line-based parser: it keeps a line only when it matches `CHECKBOX_RE` or
`SECTION_RE` and silently drops everything else. A task's continuation lines therefore never enter the
data model, so no delivery surface can display them. Separately, the Tasks tab is the only artifact
view that renders its text as a plain React text node rather than through a Markdown parser, so inline
`**bold**` and `` `code` `` appear as literal source.

The reference behavior is not a matter of taste: `tasks.md` is Markdown, and every standard renderer
(VS Code's preview, GitHub) already agrees on how a list item's continuation lines and hard line
breaks are handled. spek is a viewer, so it must reproduce that, not reinterpret it. The engine the
web app already uses — react-markdown → remark-gfm → micromark — is a CommonMark+GFM implementation,
so "match the standard" and "match what the app can render" are the same target.

Constraints:

- `@spekjs/core` is published with `cross-spawn` as its only runtime dependency. Adding a Markdown
  parser to core to rebuild `parseTasks` on an AST is out of proportion to this fix and would leave
  the Kotlin re-implementation with no way to stay aligned.
- `TaskItem` is public API for registry consumers and is mirrored by IntelliJ's Kotlin data classes.
- 1137 tasks exist in this repo's own corpus; 1047 are single-line and must render exactly as today.

## Goals / Non-Goals

**Goals:**

- A task's continuation lines are preserved and displayed.
- Task text renders with standard inline Markdown formatting.
- Folded text renders identically to how a standard Markdown renderer displays the same source,
  verified against a reference renderer rather than asserted.
- IntelliJ's Kotlin parser stays aligned with the TypeScript rules.

**Non-Goals:**

- Changing which lines count toward `total` / `completed`.
- New `TaskItem` fields or a nested task tree.
- Rebuilding `parseTasks` on a Markdown AST.
- Extending Markdown support past standard CommonMark+GFM, or adding spek-specific conveniences that
  make task text render differently from any other Markdown viewer.
- BDD keyword highlighting, heading anchors, or restyling in the Tasks tab.

## Decisions

### Fold continuation lines into `text`, dedented by the list item's content offset

A task's continuation lines are appended to `text`, newline-joined. Each is dedented by **up to 2
leading whitespace characters** — the width of the `- ` list marker, which is CommonMark's content
offset for the item. `CHECKBOX_RE` requires exactly `- [x] `, so the offset is always 2.

Alternative considered and **rejected**: dedent by the smallest indentation found across the
continuation lines. It looks more forgiving, but it is a spek invention. Measured against a reference
renderer over this repo's corpus, the content-offset rule reproduced the reference for **90/90**
multi-line tasks while min-indent managed only **82/90**. The 8 divergences are 6-space-indented
continuation lines: standard Markdown treats those as lazy paragraph continuation and shows the `-`
literally, whereas min-indent "promotes" them into a real `<ul>`. Rendering those differently from
VS Code would be the viewer second-guessing the author.

Alternative considered and **also rejected**: no dedent at all, keeping continuation lines verbatim.
This was tested, because dropping the rule would mean no hand-written block logic whatsoever. It is
indistinguishable from the content-offset rule across the entire corpus (81/81) and every other edge
case, so the corpus cannot justify the rule on its own. Exactly one construct discriminates them — a
blank line followed by content indented past the code-block threshold:

| | rendered |
| --- | --- |
| reference | `<pre><code>six space content` |
| no dedent | `<pre><code>··six space content` (two spurious leading spaces) |
| dedent 2 | `<pre><code>six space content` |

The rule is therefore kept as the minimum needed to reproduce standard rendering, and that case is a
required test — the corpus would never catch a regression in it.

Hand-written format logic is deliberately confined to these two rules — the 2-character dedent and the
blank-line boundary below. Everything else about how task text renders is delegated to remark-gfm. No
new dependency is introduced in any package.

### Terminate the block on standard list-item boundaries

Continuation applies to lines that are neither a column-0 checkbox nor a `##` heading, with one
boundary rule taken from CommonMark: **after a blank line, a line continues the task only if it is
indented to the content offset (≥2).** Without an intervening blank line, lazy continuation means any
indentation — including column 0 — continues the item.

This rule is load-bearing, not decorative: without it, standalone prose sitting after a blank line
gets swallowed into the preceding task, where a standard renderer makes it a separate paragraph
outside the list. The corpus does not contain that pattern, so it must be covered by a written test
rather than left to the corpus.

### Preserve trailing whitespace once continuation lines exist

The current implementation applies `.trim()` to task text. Trailing whitespace is significant in
Markdown: two trailing spaces are a hard line break. Verified — trimming the first line turns a
reference `First line<br />` into a soft break, silently destroying an intentional break, which is
precisely the distinction a standard renderer preserves.

So: a task with no continuation lines keeps today's `.trim()` output exactly (no regression for the
1047 single-line tasks); a task with continuation lines preserves its first line verbatim, and only
trailing blank lines are dropped from the end of the block.

### Render task text with a dedicated minimal Markdown component

The Tasks tab gets a small `TaskText` component (react-markdown + remark-gfm, both already web
dependencies) rather than reusing `MarkdownRenderer`.

`MarkdownRenderer` carries three behaviors that would change the Tasks tab beyond the reported defect:
BDD keyword highlighting (would newly colorize `MUST` / `AND` inside task text), `h2`/`h3` anchor id
generation, and `mb-4` block paragraph spacing that would break the checkbox-icon alignment for
single-line tasks. `TaskText` overrides the paragraph to a margin-free element and reuses
`MarkdownRenderer`'s Tailwind classes for `code` / `strong` / `a` / lists so styling stays consistent.

This covers every surface that renders the Tasks tab: web, the VS Code webview, the IntelliJ JCEF
webview, and the demo all build from `packages/web`. Only the Kotlin parser needs separate work.

### Verify by comparison against a reference renderer

The folding rule's correctness claim is "renders the same as a standard Markdown renderer", so the
test asserts exactly that: for each task, render the folded `text` and compare it to the inner HTML of
the corresponding item when the original source is rendered in situ. Run over the repo's `tasks.md`
corpus plus written edge cases (hard break, soft break, lazy continuation, blank-line boundary,
sub-bullets at 2 / 4 / 6 spaces, nested bullets, inline formatting).

Measured with a prototype of this design: **81/81 corpus files** render identically to the reference.

## Risks / Trade-offs

- `TaskItem.text` may now contain newlines where it was always single-line → consumers of
  `@spekjs/core` that treat it as a one-line label could wrap unexpectedly. No type change; called out
  in the proposal's Impact for whoever cuts the release.
- Indented `- [ ]` sub-checkboxes now render as GFM checkbox inputs inside the parent's text while not
  counting toward `total` → a reader could read them as tracked tasks. Accepted: it matches the
  standard rendering of that source, and the alternative (counting them) shifts every existing
  progress bar and CI badge. The rendered checkboxes are `disabled`, consistent with the rest of the
  viewer being read-only.
- The TS and Kotlin parsers stay two implementations of one rule and can drift → the boundary and
  dedent rules are specified as scenarios so both test suites assert the same cases.
- The reference-comparison test depends on the corpus, which changes as changes are archived → the
  written edge cases carry the actual guarantees; the corpus sweep is a regression net.
