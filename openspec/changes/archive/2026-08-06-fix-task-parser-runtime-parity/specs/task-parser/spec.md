## ADDED Requirements

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

One divergence is knowingly retained: U+0085 (next line) is an ordinary character to JavaScript's `.`
and a line terminator to Java's, so a checkbox line containing it is a task to the TypeScript
implementation and not to the Kotlin one. Closing it requires replacing `(.+)` with an identically
spelled negated character class in both engines, which is not worth the permanent cost in the parser's
two most load-bearing patterns for a character with no natural source in a task list.

#### Scenario: Same input, same output

- **WHEN** the same tasks.md content is parsed by `@spekjs/core` and by the Kotlin implementation
- **THEN** both return the same `total`, the same `completed`, and the same sections with the same task
  texts, for every input covered by this capability's scenarios

#### Scenario: Next-line character is a documented exception

- **WHEN** a checkbox line contains U+0085 followed by further text
- **THEN** `@spekjs/core` counts it as one task whose text includes the character, the Kotlin
  implementation counts no task, and this difference is accepted rather than treated as a defect
