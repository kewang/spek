## ADDED Requirements

### Requirement: Preserve task continuation lines

The task parser SHALL attach a checkbox item's continuation lines to that task's `text` field rather
than discarding them. Continuation lines SHALL be newline-joined onto the first line, and each SHALL be
dedented by up to 2 leading whitespace characters — the content offset of the `- ` list marker — so
that the resulting `text` is valid Markdown whose rendering matches how a standard CommonMark+GFM
renderer displays the same source in place.

A line is a continuation of the preceding task when it is neither a column-0 checkbox nor a `##`
section heading, subject to the blank-line boundary and block-opener rules. Trailing blank lines SHALL
be dropped from the end of a task's text.

Two constructs are known not to satisfy the rendering-equivalence property above, both because a
folded task is rendered standalone while the reference renders it in context. A setext underline
(`===`) is absorbed as paragraph text by the reference but turns the folded task into a heading; and a
column-0 checkbox inside a fenced code block is counted as a task, which the reference does not do.
Both are retained deliberately — the alternatives are deleting content and moving `total` respectively.

#### Scenario: Sub-bullets indented by two spaces
- **WHEN** parser receives `- [ ] Parent` followed by `  - first` and `  - second`
- **THEN** the task's `text` is `Parent\n- first\n- second`, which renders as a nested bullet list

#### Scenario: Continuation indented past the content offset
- **WHEN** parser receives `- [ ] Parent` followed by a line indented 6 spaces beginning with `- `
- **THEN** exactly 2 characters of indentation are removed, leaving the line indented 4 spaces so it
  renders as lazy paragraph continuation with a literal `-`, matching the standard renderer rather
  than being promoted to a bullet list

#### Scenario: Relative nesting preserved
- **WHEN** parser receives `- [ ] Parent` followed by `  - outer` and `    - inner`
- **THEN** the dedented text preserves the relative indentation so `inner` renders as a nested list
  item beneath `outer`

#### Scenario: Lazy continuation at column zero
- **WHEN** parser receives `- [ ] Task one` immediately followed by an unindented prose line with no
  blank line between them
- **THEN** the prose line is part of that task's `text`

#### Scenario: Indented code block keeps its exact content
- **WHEN** parser receives `- [ ] Task`, a blank line, then a line indented 6 spaces
- **THEN** the dedent removes exactly 2 characters so the line renders as an indented code block whose
  content has no leading whitespace, matching the standard renderer

#### Scenario: Single-line task unchanged
- **WHEN** parser receives a checkbox line with no continuation lines
- **THEN** the task's `text` is the trimmed checkbox content, containing no newline

### Requirement: Blank-line boundary for continuation lines

Following one or more blank lines, a line SHALL continue the preceding task only when it is indented to
at least the content offset (2 characters). An unindented line after a blank line SHALL end the task,
because a standard renderer places such a line in its own paragraph outside the list.

#### Scenario: Unindented prose after a blank line ends the task
- **WHEN** parser receives `- [ ] Task one`, a blank line, then unindented prose
- **THEN** the prose is not part of the task's `text`

#### Scenario: Indented prose after a blank line continues the task
- **WHEN** parser receives `- [ ] Task one`, a blank line, then a line indented 2 spaces
- **THEN** that line is part of the task's `text`

### Requirement: Block openers end a task

The task parser SHALL end the preceding task at a column-0 line that opens a new block — a bullet
(`-`/`+`/`*`), an ordered marker (`1.`, `2)`, …), an ATX heading, a blockquote, a code fence, or a
thematic break — rather than folding that line into the task. Lazy continuation applies to paragraph
text only, and a standard renderer places such a line outside the list. The same line indented to at
least the content offset SHALL remain part of the task. Because none of these lines is a column-0
checkbox, this rule ends tasks without starting any, leaving `total` and `completed` unchanged.

#### Scenario: Column-0 bullet after a task
- **WHEN** parser receives `- [ ] Task one` followed by `- plain note`
- **THEN** `- plain note` is not part of the task's `text`, and `total` is 1

#### Scenario: Indented bullet after a task
- **WHEN** parser receives `- [ ] Task one` followed by `  - plain note`
- **THEN** the note is part of the task's `text` and renders as a nested list

#### Scenario: Thematic break after a task
- **WHEN** parser receives `- [ ] Task one` followed by `---`
- **THEN** the task's `text` is `Task one`, rather than becoming a setext heading

### Requirement: Preserve intentional line breaks

The task parser SHALL preserve trailing whitespace on a task's first line when continuation lines
follow, so that a Markdown hard line break (two trailing spaces) survives folding and is not silently
downgraded to a soft break.

#### Scenario: Hard line break survives folding
- **WHEN** parser receives a checkbox line ending in two spaces followed by a continuation line
- **THEN** the task's `text` retains the two trailing spaces and renders as a hard line break

#### Scenario: Soft line break stays soft
- **WHEN** parser receives a checkbox line with no trailing whitespace followed by a continuation line
- **THEN** the two lines render as a single wrapped line, not as a hard break

## MODIFIED Requirements

### Requirement: Calculate task statistics

The task parser SHALL compute aggregate statistics from parsed tasks. Only checkboxes at column 0 SHALL
count toward `total` and `completed`; an indented checkbox is part of its parent task's text and SHALL
NOT be counted as a separate task.

#### Scenario: Calculate completion stats
- **WHEN** parser processes a string with 10 total checkboxes where 7 are checked
- **THEN** it returns `{ total: 10, completed: 7 }` along with the sections breakdown

#### Scenario: Empty tasks file
- **WHEN** parser processes an empty string or one with no checkboxes
- **THEN** it returns `{ total: 0, completed: 0, sections: [] }`

#### Scenario: Indented checkboxes are not counted
- **WHEN** parser processes a column-0 checkbox followed by two checkboxes indented 2 spaces
- **THEN** `total` is 1, and the indented checkboxes appear within that task's `text`
