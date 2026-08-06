## Purpose

Parse tasks.md checkboxes and section groupings into the completion statistics every delivery surface reports.

## Requirements
### Requirement: Parse task checkboxes
The task parser SHALL be a pure function in the `@spekjs/core` package that reads a tasks.md content string and extracts checkbox items with their completion status. It SHALL have no dependency on Express or any HTTP framework.

#### Scenario: Parse file with mixed checkboxes
- **WHEN** parser receives a string containing `- [x] Done task` and `- [ ] Pending task`
- **THEN** it returns each task with `text` and `completed` (boolean) fields

### Requirement: Group tasks by section
The task parser SHALL group tasks under their `##` heading sections.

#### Scenario: Tasks under multiple sections
- **WHEN** parser receives a string with `## Phase 1` followed by tasks and `## Phase 2` followed by tasks
- **THEN** it returns sections array, each with `title` and `tasks` array

#### Scenario: Tasks without section headings
- **WHEN** parser receives a string where tasks appear before any `##` heading
- **THEN** those tasks are grouped under a default section with empty title

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

### Requirement: Line endings follow CommonMark

The task parser SHALL recognise all three CommonMark line endings — a line feed, a carriage return
followed by a line feed, and a **lone carriage return** — as a single line ending each, and SHALL
normalise every one of them to a line feed before splitting the content into lines. No line handed to
the checkbox, section, or continuation rules SHALL contain a carriage return.

The parser SHALL NOT delegate this decision to its host runtime's notion of a line terminator. Java's
regex `$` matches before a trailing line terminator and JavaScript's does not, so a pattern anchored
with `$` reads differently in the two implementations; patterns applied to an already-split line SHALL
therefore be anchored at the absolute end of the string (`\z` in the Kotlin implementation, `$` in the
TypeScript one, which already means that).

#### Scenario: Carriage-return-only file

- **WHEN** parser receives `- [x] a`, a lone carriage return, then `- [ ] b`, with no line feed anywhere
- **THEN** `total` is 2 and `completed` is 1, matching what a standard CommonMark+GFM renderer shows

#### Scenario: Stray carriage return before a CRLF

- **WHEN** parser receives a checkbox line terminated by carriage return, carriage return, line feed,
  followed by a second checkbox line
- **THEN** both checkboxes are counted, and the doubled ending is treated as an ordinary blank line
  between them rather than leaving a carriage return inside the first line

#### Scenario: Final line terminated by a carriage return

- **WHEN** parser receives line-feed-separated checkboxes whose last line ends with a lone carriage
  return
- **THEN** the last checkbox is counted, and its `text` does not contain the carriage return

#### Scenario: Ordinary CRLF content is unaffected

- **WHEN** parser receives a CRLF-terminated tasks.md
- **THEN** the result is identical to the same content with line-feed endings

### Requirement: Blank lines are spaces and tabs only

The task parser SHALL treat a line as blank when it is empty or contains only spaces (U+0020) and tabs
(U+0009), and SHALL NOT treat any other whitespace character as making a line blank. This is
CommonMark's definition and the same character class the parser already uses to measure a line's
leading whitespace.

The definition SHALL be spelled explicitly rather than inherited from the host runtime, whose
whitespace tables disagree with CommonMark and with each other — JavaScript's `String.prototype.trim`
strips U+00A0, U+FEFF, U+2007 and U+202F while Kotlin's `isBlank` does not, and Kotlin's `isBlank`
treats U+001C as whitespace while JavaScript's `trim` does not.

This definition governs every place blankness or trimming decides an outcome: the blank-line boundary
for continuation lines, the dropping of trailing blank lines from a task's text, the blanking of
interior lines when continuation lines are folded, and the trimming of a single-line task's text and of
a `##` section title.

#### Scenario: A no-break-space line does not end a task

- **WHEN** parser receives `- [ ] Task`, a line containing only U+00A0, then unindented prose
- **THEN** all three lines are part of that task's `text`, because the middle line is not blank and the
  prose is therefore lazy continuation rather than a new paragraph

#### Scenario: A file-separator line does not end a task

- **WHEN** parser receives `- [ ] Task`, a line containing only U+001C, then unindented prose
- **THEN** all three lines are part of that task's `text`

#### Scenario: A spaces-and-tabs line is blank

- **WHEN** parser receives `- [ ] Task`, a line of two spaces and a tab, then unindented prose
- **THEN** the prose is not part of the task's `text`, the same as for an empty line

#### Scenario: Exotic trailing whitespace survives trimming

- **WHEN** parser receives a single-line checkbox whose text ends with U+00A0
- **THEN** that character is retained in the task's `text`, while ordinary trailing spaces and tabs are
  still removed

### Requirement: Implementations agree on every input

Every implementation of the task parser SHALL return the same `total`, `completed`, and section/task
structure for the same input, so that every delivery surface reports the same tasks for the same file.
There are two: `parseTasks` in `@spekjs/core`, and the Kotlin `TaskParser` used by the IntelliJ plugin.

Where a rule could otherwise be inherited from the host runtime — a regex anchor's notion of a line
terminator, a whitespace predicate's notion of blank — the rule SHALL be stated explicitly in the
pattern or predicate, in a form that reads identically in both languages. Case-mirrored unit tests
cannot detect a rule that both implementations spell the same way and each runtime reads differently,
so the spelling is the control, not the tests.

Two mechanisms support this requirement, and neither alone discharges it. Known inputs SHALL be pinned
by a shared fixture corpus that every implementation's own test suite runs in full, replacing test cases
mirrored by hand between the suites; this makes each recorded case permanent and bilingual, but it
asserts against authored constants rather than comparing the implementations to each other, and it
covers only inputs a person has thought of. Unknown inputs SHALL be probed by generated differential
runs, which compare the implementations directly and are the only mechanism that discovers a divergence
nobody anticipated. Both are specified by the `task-parser-fixture-corpus` capability.

A divergence discovered by either mechanism SHALL be recorded in the corpus: as a shared expectation
once the divergence is fixed, or as a per-implementation divergence with a stated reason when the
difference is deliberately retained.

One divergence is knowingly retained: U+0085 (next line) is an ordinary character to JavaScript's `.`
and a line terminator to Java's. It surfaces in both of the parser's anchored patterns. On a checkbox
line, a line containing it is a task to the TypeScript implementation and not to the Kotlin one, so the
counts differ. On a section heading, `## S<U+0085>T` yields a section title of `S<U+0085>T` in
TypeScript and an empty title in Kotlin, while the counts agree. Closing either requires replacing
`(.+)` with an identically spelled negated character class in both engines, which is not worth the
permanent cost in the parser's two most load-bearing patterns for a character with no natural source in
a task list. Both surfaces SHALL be pinned as recorded per-implementation divergences in the corpus.

#### Scenario: Same input, same output

- **WHEN** the same tasks.md content is parsed by `@spekjs/core` and by the Kotlin implementation
- **THEN** both return the same `total`, the same `completed`, and the same sections with the same task
  texts, for every fixture in the shared corpus and for every input covered by this capability's
  scenarios

#### Scenario: Next-line character on a checkbox line

- **WHEN** a checkbox line contains U+0085 followed by further text
- **THEN** `@spekjs/core` counts it as one task whose text includes the character, the Kotlin
  implementation counts no task, and this difference is accepted rather than treated as a defect —
  recorded as a per-implementation divergence in the corpus, so each suite asserts its own expectation

#### Scenario: Next-line character in a section heading

- **WHEN** a section heading contains U+0085 between two words
- **THEN** `@spekjs/core` reports the whole string as the section title and the Kotlin implementation
  reports an empty title, while `total` and `completed` agree — likewise recorded as an accepted
  divergence rather than treated as a defect

#### Scenario: A newly discovered divergence

- **WHEN** the two implementations are found to disagree on an input not yet in the corpus, whether by a
  generated differential run or by hand
- **THEN** that input enters the corpus as a fixture, so the case is asserted in both languages from
  then on, whether the disagreement is fixed or deliberately retained
