## Purpose

Hold the two implementations of the task parser to one behavior, by data rather than by convention:
one shared corpus of fixtures both test suites read in full, and a generator that feeds those same
loaders randomised input to find divergences nobody thought to write down.

## Requirements

### Requirement: A single corpus shared by every implementation

The repository SHALL hold one fixture corpus for the task parser, at a location owned by neither the
`@spekjs/core` package nor the IntelliJ plugin, and every implementation of the task parser SHALL run
the entire corpus as part of its own test suite. No implementation's suite may run a subset.

The corpus SHALL sit outside every directory that a published artifact is built from, so that its
exclusion from the npm tarball and the plugin jar follows from where it lives rather than from a check
someone has to remember.

#### Scenario: Both suites read the same directory

- **WHEN** the Node test suite and the Gradle test suite are each run
- **THEN** both enumerate the same corpus directory and assert against every fixture in it

#### Scenario: Corpus is absent from published artifacts

- **WHEN** the npm package is packed or the plugin jar is built
- **THEN** the resulting artifact contains no corpus fixture and no corpus loader

### Requirement: Fixtures store input escaped, not as literal bytes

Each case SHALL be a single JSON file whose `input` is a JSON string, so that characters which ordinary
tooling rewrites — a lone carriage return, U+0085, U+001C, U+00A0, trailing spaces carrying a Markdown
hard line break — are stored as ASCII escape sequences and survive line-ending normalisation, platform
checkout, editor save, and automated edits.

A fixture SHALL carry a `name` equal to its filename without the extension, the `input`, a `note`
stating why the case exists, and the `expected` result. It MAY carry a reserved object for provenance
metadata such as an originating issue. Fixtures SHALL express expected results only; the format SHALL
have no way to assert a thrown error, because every string is valid input to the parser.

#### Scenario: A control character survives round-tripping

- **WHEN** a fixture's input contains a lone carriage return, stored as an escape sequence
- **THEN** the file contains no raw carriage-return byte, and the loaded input string contains the
  character the case is about

#### Scenario: Fixture missing a required field

- **WHEN** a fixture omits `input`, `expected`, `name`, or `note`
- **THEN** loading fails and names the offending file

#### Scenario: Name disagrees with filename

- **WHEN** a fixture's `name` does not match its filename without the extension
- **THEN** loading fails, so the two cannot drift apart

### Requirement: Fixture files are checked for flattened escapes

The corpus SHALL be checked at the byte level for characters that must only ever appear escaped, and
that check SHALL run as part of an ordinary test run rather than as a manual step.

The rule SHALL be expressed as an allowlist over the whole file — printable ASCII, line feed and tab,
and nothing else. This subsumes every character that must never appear raw (carriage return, U+0085,
U+2028, U+2029, U+00A0, U+FEFF, and any other C0 or C1 character), because each is either a control
byte or non-ASCII, and it needs no list to keep up to date. A blanket ban on "control characters" is
not acceptable: it rejects the line feeds and tabs that JSON formatting requires, while missing U+0085
and U+00A0, which are not control characters at the byte level.

This check is what keeps the two loaders agreeing on which files are valid corpus members. Their JSON
parsers do not agree on their own: a raw line feed, carriage return or U+001C inside a string literal is
rejected by `JSON.parse` and accepted by kotlinx-serialization, so a fixture whose escape was flattened
fails hard on one side and passes silently on the other.

#### Scenario: A flattened escape is rejected

- **WHEN** a fixture file contains a raw U+0085 or U+00A0 rather than an escape sequence
- **THEN** the run fails naming the file, even though a JSON parser would accept the file

#### Scenario: Ordinary formatting is accepted

- **WHEN** a fixture file is pretty-printed with line feeds and tabs between tokens
- **THEN** the check passes

### Requirement: Expected output covers the whole parse result

A fixture's `expected` SHALL contain `total`, `completed`, and the full `sections` structure including
each task's `text` and `completed` flag, and the assertion SHALL compare all of it.

The fields a case exists to pin SHALL be authored and reviewed by a person, and SHALL NOT be taken from
the output of any implementation of the parser. The structural remainder of the result — fields the case
has no opinion about — MAY be filled from a run provided a reviewer confirms them. A reference
CommonMark+GFM renderer MAY be consulted while authoring, but is not the arbiter of statistics that
follow rules of the parser's own, such as the column-0 anchor governing `total`.

#### Scenario: A divergence that moves text but not counts

- **WHEN** two implementations return the same `total` and `completed` but different task `text`, or the
  same counts but a different section title
- **THEN** the corpus assertion fails, because the whole result is compared

#### Scenario: Authoring a new case

- **WHEN** a new fixture is added for a specific rule
- **THEN** the fields that rule governs are written into the file and reviewed, rather than captured
  from a run of either implementation

### Requirement: Adding a case is adding one file

Loaders SHALL discover fixtures by enumerating the corpus directory. There SHALL be no index, manifest,
or registration list that a new case must also be added to.

#### Scenario: New fixture is covered without further edits

- **WHEN** a fixture file is added to the corpus directory and no other file is changed
- **THEN** both test suites assert against it on their next run

### Requirement: Accepted divergences are recorded per implementation with a reason

The fixture format SHALL let a case declare that a named implementation is expected to differ, by
supplying that implementation's own expected result together with a non-empty reason. An implementation
with such an entry SHALL assert its own expectation; every other implementation SHALL assert the shared
one.

At least one implementation SHALL assert the shared `expected`. A fixture overriding every
implementation asserts nothing in common and is two single-language tests sharing a filename.

An implementation identifier that is not recognised SHALL be a loading error, never a silently ignored
entry — otherwise a misspelled identifier leaves the divergence unrecorded while the run still reports
success. A divergence entry without a reason SHALL be a loading error.

#### Scenario: The next-line character divergence

- **WHEN** the corpus contains a case where a checkbox line holds U+0085, which is an ordinary character
  to one runtime and a line terminator to the other
- **THEN** each implementation asserts its own recorded expectation and the suite passes on both sides,
  with the difference visible in the fixture rather than reported as a failure

#### Scenario: Unrecognised implementation identifier

- **WHEN** a fixture declares a divergence for an identifier no loader recognises
- **THEN** loading fails naming the file and the identifier, rather than falling back to the shared
  expectation

#### Scenario: Divergence without a stated reason

- **WHEN** a fixture declares a divergence with an empty or missing reason
- **THEN** loading fails, because a divergence is a decision that has to be readable

#### Scenario: Every implementation overridden

- **WHEN** a fixture declares a divergence for every known implementation
- **THEN** loading fails, because no shared expectation would be asserted

### Requirement: Corpus wiring fails loudly

A test suite that finds no fixtures SHALL fail. A fixture that cannot be parsed, or that carries a field
the format does not define, SHALL fail the run and name the file. Each loader SHALL reject the same
fixtures as the other, including fields and value types its own JSON library would otherwise tolerate.

Neither suite SHALL locate the corpus through the process working directory, because the two suites run
from different directories and either can be invoked from the repository root or from inside its own
package. Each SHALL resolve the corpus from a location fixed at build or module-resolution time.

A build system that skips a test task when its declared inputs are unchanged SHALL declare the corpus
directory as an input of that task, so that editing a fixture re-runs the suite. Declaring the input
SHALL NOT be relied on to catch an empty corpus: an existing but empty directory satisfies input
validation, and only the loader's own check fails the run.

#### Scenario: Corpus path is wrong

- **WHEN** a suite resolves a corpus directory that is empty or does not exist
- **THEN** the run fails, rather than reporting a passing suite of zero cases

#### Scenario: Suite invoked from a different directory

- **WHEN** a suite is run from the repository root and again from inside its own package
- **THEN** both runs load the same fixtures

#### Scenario: Only a fixture changed

- **WHEN** a fixture is edited and the test task is re-run with no source change
- **THEN** the task executes rather than being reported as up to date

#### Scenario: A fixture one library tolerates

- **WHEN** a fixture carries an unknown field or a value of the wrong type
- **THEN** both loaders reject it, regardless of what their JSON libraries do by default

### Requirement: The loaders' own rejections are verified by shared fixtures

Every rule by which a loader rejects a fixture SHALL be verified by a shared corpus of invalid cases
that every implementation's loader reads, rather than by rejection tests hand-written in each
language. Hand-mirrored rejection tests fail for the same structural reason hand-mirrored parser tests
do: they agree because they were copied, and neither asks what the other implementation actually does.

Each invalid case SHALL specify the document, the filename to report it under, which check must reject
it, and a substring the resulting message must contain. Every loader SHALL reject every case, naming
the file, with a message containing that substring — so the loaders are held in agreement on their
error wording and not merely on their accept/reject decisions.

The invalid corpus SHALL NOT be substitutable by a generated scratch directory. Generated inputs
replace what the parser is asked to parse; they never replace the rules by which a loader decides a
fixture is valid.

#### Scenario: A rule that one loader implements differently

- **WHEN** one loader rejects a document with a different message than another, or fails to reject it
- **THEN** the shared invalid case fails on that loader, naming the case

#### Scenario: Divergent wording is caught

- **WHEN** a loader's message is reworded so it no longer contains the case's expected substring
- **THEN** that loader's run fails, even though the document is still rejected

#### Scenario: Empty invalid corpus

- **WHEN** a loader finds no invalid cases
- **THEN** the run fails, for the same reason an empty fixture corpus does

#### Scenario: A generated run leaves the rejection rules alone

- **WHEN** a loader is pointed at a generated scratch directory
- **THEN** it still reads the committed invalid corpus and still asserts every rejection

### Requirement: Generated inputs are checked against the same loaders

The repository SHALL provide a generator that emits randomised tasks.md inputs in the fixture format
into a scratch directory, so that divergences can be discovered rather than only recorded. Both loaders
SHALL be able to read a scratch directory in place of the committed corpus.

Generated `expected` values SHALL be produced from one implementation and treated as a disagreement
detector, not as an oracle: a mismatch reported by another implementation is a finding for a person to
adjudicate, not by itself a defect in either side. The generator SHALL NOT write to the committed
corpus, and generated runs SHALL NOT be part of any automated gate, because a random-input gate is a
flaky gate and a disagreement is not a verdict.

Once adjudicated, the input SHALL enter the committed corpus as an ordinary fixture with authored
expectations, subject to every rule above.

#### Scenario: A generated run finds a disagreement

- **WHEN** the generator produces an input on which the implementations disagree
- **THEN** the run reports it with the input, and it is adjudicated by a person before anything is
  committed

#### Scenario: Generated fixtures stay out of the corpus

- **WHEN** the generator runs
- **THEN** it writes only to its scratch directory, which is untracked, and the committed corpus is
  unchanged

#### Scenario: Inputs exercise the rules that actually branch

- **WHEN** the generator produces inputs
- **THEN** they are drawn from the constructs the parser's rules distinguish — line endings including a
  lone carriage return, leading spaces and tabs around the content offset, whitespace characters the two
  runtimes classify differently, block openers and checkbox markers at column 0 and indented, section
  headings, and code fences — rather than from uniform random text
