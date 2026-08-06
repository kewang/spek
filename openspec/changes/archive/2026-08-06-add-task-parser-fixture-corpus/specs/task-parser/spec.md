## MODIFIED Requirements

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
