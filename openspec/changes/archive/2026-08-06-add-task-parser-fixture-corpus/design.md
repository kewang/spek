## Context

`parseTasks` (`packages/core/src/tasks.ts`) and `TaskParser.kt`
(`packages/intellij/src/main/kotlin/com/spek/intellij/core/TaskParser.kt`) implement one rule in two
languages. Their test suites — `packages/core/src/tasks.test.ts` and
`packages/intellij/src/test/kotlin/com/spek/intellij/core/TaskParserTest.kt` — are hand-mirrored case
for case, which is stated in a comment at the top of each file. As the proposal argues, that mechanism
cannot detect a rule both files spell identically and the two runtimes read differently.

Relevant existing constraints:

- `@spekjs/core` builds with `tsconfig.json`, whose `exclude` is exactly `src/**/*.test.ts`, and
  publishes `files: ["dist"]`. Anything under `src/` that is not named `*.test.ts` is compiled into
  `dist` and shipped to registry consumers.
- `packages/intellij` already depends on `kotlinx-serialization-json:1.6.3` with the serialization
  compiler plugin enabled, so the Kotlin side needs **no new dependency** to read JSON.
- Gradle's `test` task is up-to-date-checked against its declared inputs. A data file it reads but does
  not declare will not re-run the suite when it changes.
- The repo normalises line endings to LF via `.gitattributes`.
- `npm run lint` covers `packages/core/src`; `npm run type-check` covers core's test files via
  `tsconfig.test.json`.

## Goals / Non-Goals

**Goals:**

- One corpus, read by both suites, such that adding a case is adding one file and both languages are
  then checked with no step a person must remember.
- The corpus can hold inputs that a raw `.md` file cannot carry safely — lone `\r`, U+0085, U+001C,
  U+00A0, meaningful trailing spaces.
- A divergence that is deliberate can be recorded per implementation, with a stated reason, instead of
  failing forever or being silently dropped from the corpus.
- Path or wiring breakage fails loudly. A suite that finds no fixtures must fail, never pass green.
- A way to *discover* divergences, not only to record the ones a person already thought of. The corpus
  alone does not change the discovery mechanism, which is the hole issue #41 actually describes.

**Non-Goals:**

- Making generated differential runs part of the CI gate. The generator (decision 12) is run
  deliberately, by a person, and its findings are adjudicated by a person before entering the corpus.
  A random-input gate is a flaky gate, and a disagreement is not by itself a defect in either side.
- Changing any parsing behavior. If a fixture or a generated run reveals a real divergence, that is a
  separate change.
- Feeding the corpus to `TaskText.test.ts` (the web-side rendering-equivalence check). That suite
  asserts a different property — how a folded `text` renders — against a reference renderer that exists
  only on the Node side. Possible later; out of scope here.
- Publishing the corpus as a package. It is repo test data; it must not enter the npm tarball or the
  IntelliJ plugin jar.

## Decisions

### 1. Fixtures are JSON, not raw `.md`

**Decision**: each case is a `.json` file whose `input` is a JSON string.

The cases with the highest value are the ones a raw file cannot hold. A lone `\r` in a checked-in file
is rewritten by `.gitattributes` normalisation, by a Windows checkout, by most editors on save, and by
agent tooling that reads and re-writes the file. U+001C and U+0085 get mangled or stripped on the same
paths — `CLAUDE.md` already records that a raw U+001C or U+0085 "gets rewritten on the way into the
file and silently guts the test". Trailing spaces that carry a Markdown hard break are removed by
trim-on-save. In every one of those, the case still *looks* present.

JSON gives escaping for free: `\r`, `\u0085`, `\u001c` are ASCII in the file and survive every
normalisation step above. The file stays diffable and reviewable.

**Alternative rejected — a bespoke line-oriented format** with our own escape syntax. It would need a
parser on each side, hand-written in two languages, agreeing on the escape rules. That is the exact
failure mode this change exists to remove, reintroduced one level down. JSON has a mature parser in
both runtimes; the escape semantics are not ours to get wrong.

**Alternative rejected — raw `.md` plus a sidecar of escapes**: two files per case, and the mangling
risk is still live for the raw half.

### 2. One file per case, no index

**Decision**: both loaders enumerate `*.json` in the corpus directory. Adding a case is adding a file;
nothing else is edited, so nothing else can be forgotten. A single large JSON array would centralise
merge conflicts and make a case's history harder to read.

No index file listing the cases: an index is a second place to forget, and the fail-loud rule below
already covers the failure it would catch (a suite seeing an empty or wrong directory). Both suites read
the same directory, so they cannot see different sets unless a path is wrong — which fails.

### 3. Corpus lives at the repo root, outside both packages

**Decision**: `test-fixtures/task-parser/`.

Neither package may own it — `packages/intellij` reaching into `packages/core/fixtures` creates a
direction the build does not otherwise have, and the reverse is worse. A root directory is owned by the
repo, which is what the corpus actually belongs to. It also stays outside core's `src/` (so it cannot be
compiled into `dist`) and outside the plugin's `resources/` (so it cannot enter the jar).

### 4. Neither side resolves the corpus through the working directory

**Decision**: Node resolves relative to `import.meta.url`; Gradle computes an absolute path at
configuration time and passes it as a system property.

The two suites run with different working directories (`packages/core` for `npm test -w`,
`packages/intellij` for `./gradlew test`), and both can be invoked from the repo root or from within the
package. A `../../` relative to CWD is the one thing in this change that can break a suite without
touching a parser. Anchoring to the source file's own URL on one side, and to the Gradle project
directory on the other, removes CWD from the question entirely.

The Gradle `test` task additionally declares the corpus as an input (`inputs.dir(...)`), otherwise
editing a fixture leaves the task up-to-date and the suite does not re-run — a change to test data that
appears to pass without having executed.

### 5. Expected output is the whole parse result, committed and human-reviewed

**Decision**: each fixture carries the full `{total, completed, sections}` including every task's `text`
and `completed`, written into the file and reviewed by a person.

Comparing only `total`/`completed` would have missed the continuation-boundary half of the U+00A0/U+001C
bug, which moves `text` without moving the counts.

Neither implementation is authoritative. In both shipped bugs *each* side was wrong in one direction, so
generating expectations from either would have blessed a bug. The reference renderer
(`react-markdown` + `remark-gfm`) may be used to *derive candidate* values while authoring a case — it
is the arbiter the existing rules were settled against — but it exists only on the Node side and it
answers rendering questions only; it cannot decide `total` under the column-0 anchor rule, which is
spek's own.

The no-capture rule binds the **fields the case is about**, not every field in the result. A fixture
whose point is a continuation boundary asserts a full result including section titles and counts that
nobody has an opinion about, and demanding those be reasoned out from first principles buys nothing and
guarantees the rule gets quietly broken. So: the fields a case exists to pin are authored and reviewed;
the structural remainder may be filled from a run, provided the reviewer confirms it. A migrated case
carries this exposure by construction — most of the existing suite asserts only task text, so its
fixtures' counts and titles have never been anyone's stated expectation until now.

### 6. Accepted divergences are per-implementation overrides with a mandatory reason

**Decision**: a fixture's `expected` is the shared expectation. An optional `divergences` map keys an
implementation id (`typescript` / `kotlin`) to `{reason, expected}`; that implementation asserts the
override instead. `reason` must be non-empty, and an unknown implementation id is a **loader error**,
not a skip.

At least one implementation must assert the shared `expected`. A fixture that overrides both sides
asserts nothing in common and is two single-language tests sharing a filename.

U+0085 needs this: it is an ordinary character to JavaScript's `.` and a line terminator to Java's, and
the difference is deliberately retained. Without a way to record it, either the case leaves the corpus
(losing the pin that stops it drifting further) or it fails on one side forever.

U+0085 has **two** surfaces, and only one of them is written down today. The known one is `CHECKBOX_RE`:
a checkbox line containing it is a task to TypeScript and not to Kotlin, so `total` differs. The second
is `SECTION_RE`: for `## S<U+0085>T`, TypeScript reports a section title of `S<U+0085>T` and Kotlin
reports an empty one, while `total` and `completed` agree — the exact shape decision 5 cites to justify
comparing the whole result. Both need a fixture. (U+2028 and U+2029 were checked at the same time and do
not diverge, so these two are the complete set.)

Making an unknown key an error is the load-bearing part. A typo'd `"Kotlin"` under a permissive loader
means the Kotlin side silently falls back to the shared expectation — the divergence is unrecorded and
the suite is red for a reason no one can find, or worse, green for the wrong reason.

Implementation ids name the **runtime**, not the package, because that is what the divergences are about.

### 7. Both loaders fail on an empty corpus and on a malformed fixture

**Decision**: zero fixtures found → failure. A fixture missing a required field, or carrying an unknown
field, → failure naming the file.

This is the mitigation for the one risk this change introduces. A wrong path yielding "0 cases, all
passed" reads exactly like a healthy suite; it is the same shape of silent-success failure that
`action.yml`'s outputs had. Rejecting unknown fields catches a fixture written against a newer format by
a different author, and a misspelled key that would otherwise be ignored.

Gradle does not cover this for us. An `inputs.dir` pointing at a **missing** directory fails task
validation, but a directory that exists and is **empty** validates fine and the suite goes green at zero
cases. The loader check is the guard, not the build system.

Alongside it, a **fixture-hygiene check** on the raw bytes, stated as an allowlist rather than "no
control characters" — that phrasing rejects the corpus itself, since pretty-printed JSON is full of
U+000A and U+0009. The rule is one line: **printable ASCII plus line feed and tab, over the whole
file**. That subsumes the whole denylist — CR, U+0085, U+2028, U+2029, U+00A0, U+FEFF and every other
C0/C1 character are each either a control byte or non-ASCII — with no list to keep up to date, and
anything a case genuinely needs is written as a `\u` escape, which is the point of the format. The C1
characters are why the naive phrasing fails: U+0085 is `C2 85` in UTF-8, not a control byte at all,
`JSON.parse` accepts it raw, and nothing else in the pipeline would notice a fixture whose escape had
been flattened. Both loaders run this check, so it fails a normal test run on either side rather than
depending on someone remembering to look.

### 8. Cases that the corpus can express are migrated out of both suites

**Decision**: every case of the form "input string → parse result" moves into the corpus. The *why*
comment on a migrated case moves into the fixture's `note` field — it is the part worth keeping, and it
belongs next to the data now.

Leaving a migrated case in place duplicates the assertion in three files and re-creates the drift the
corpus removes.

Two shapes in the current suites are **not** single-input-to-result and stay as hand-written tests in
both languages, named here so "cases a fixture cannot express" is not left to interpretation:

- **Equivalence between two inputs** — `parse(CRLF form) == parse(LF form)`. Split into two fixtures
  with equal `expected`, the invariant is gone: someone edits one and not the other and nothing notices.
- **A property rather than a value** — "a single-line task's text contains no newline". A fixture pins
  one string; it cannot say "for this input, no output may ever contain this".

### 9. The Node loader lives inside a `*.test.ts` file

**Decision**: the loader and the corpus test live in one file, `packages/core/src/tasks.corpus.test.ts`.

Core's build config excludes exactly `src/**/*.test.ts` and publishes `dist`. A loader in
`src/corpus.ts` would be compiled and shipped to every registry consumer of `@spekjs/core` — a test
helper in the public tarball. Keeping it in the test file needs no change to the build config, and
changing that `exclude` is the thing `tsconfig.test.json`'s comment explicitly warns against.

### 10. The reference renderer stays an authoring tool, not a gate on the corpus

**Decision**: no automated cross-check of fixture `text` values against `react-markdown` + `remark-gfm`
as part of the corpus suite. The renderer is used while authoring a case (decision 5) and nowhere else.

It is cheap to add and still not worth it. The property it checks — that a folded `text` renders the way
the same source renders in place — already has a dedicated guard in `TaskText.test.ts`, which runs it
over every real `tasks.md` in the repo rather than over synthetic fixtures. Adding it here would
duplicate that with weaker inputs.

It would also need a per-case opt-out immediately: the two divergences the `task-parser` spec knowingly
retains (a folded `===` rendering as a heading, and a column-0 checkbox inside a fenced block being
counted) are precisely cases where the parser and the renderer disagree on purpose. That is a second
exception mechanism, sitting beside `divergences` and meaning something different — two kinds of
accepted difference in one file is how a corpus stops being readable.

### 11. Fixtures assert results only, never errors

**Decision**: the fixture format has no way to expect a thrown error or a defensive path.

Both parsers are total over their input: every string is a valid tasks.md, and the rules resolve any
byte sequence into some parse result. There is no input for which "it throws" is the correct answer, so
a format that could express one would only invite a fixture asserting an implementation accident. If a
future change gives the parser a genuine error contract, extending the format is a small, separate step.

### 12. A generator feeds the same loaders a throwaway corpus

**Decision**: a script under `scripts/` emits randomised tasks.md inputs into a scratch directory in the
corpus format, with `expected` taken from the TypeScript implementation. Both existing loaders can be
pointed at that directory instead of the committed corpus. A mismatch on the Kotlin side is a
disagreement to adjudicate; nothing is committed automatically, and the generated directory is
gitignored and never part of a gate.

Everything above builds the differential harness and stops one step short. Decisions 3, 4, 7 and the two
loaders are exactly the "harness that marshals results between the runtimes" whose cost was the stated
reason for deferring generative testing — the corpus format *is* the marshalling format. What is missing
is an input generator and a directory switch.

Without it this change does not close issue #41. The corpus never compares the two implementations to
each other: each asserts against an authored constant, so agreement is only transitive, and a fixture
using `divergences` breaks even that. More importantly it leaves the discovery mechanism untouched — a
person still has to think of the input, which is the thing the issue says does not scale.

A generator needs no oracle. `expected` from the TypeScript side is not a claim that TypeScript is
right; it is a **disagreement detector**, and a human adjudicates afterwards with the reference renderer
— which is precisely how issue #33 and the U+00A0/U+001C bug were actually found. Once adjudicated, the
minimised input enters the committed corpus as a fixture with authored expectations, so the generator
never writes to the corpus and the no-capture rule (decision 5) is untouched.

The generator's inputs should be drawn from the alphabet the parser's rules actually branch on — line
endings including lone CR, leading spaces and tabs at the boundaries the dedent rule cares about, the
whitespace characters the two runtimes' predicates disagree about, block-opener markers at column 0 and
indented, checkbox markers at column 0 and indented, `##` headings, fences, and the divergence
characters — rather than uniform random text, which spends its budget on inputs no rule distinguishes.

**Alternative rejected — running both parsers in one process** (GraalVM, a Node/JVM bridge). Far more
machinery for the same signal; the scratch directory is the bridge.

### 13. The loaders' rejection rules are themselves a shared corpus

**Decision**: `test-fixtures/task-parser/invalid/` holds one file per rejection case — the document,
the filename to report it under, which check must reject it, and a substring the message must contain.
Both loaders read it and assert every case. No hand-written rejection tests remain on either side.

This was not in the original plan; verification found the reason for it. The loaders' rules had been
written as two hand-mirrored suites — the exact structure this change exists to remove, one level down
— and they had already produced a divergence neither suite could see: `"meta": null` was rejected
properly by Kotlin and threw a bare `TypeError` with no filename on the Node side. It took a manual
probe to find, which is precisely the complaint in issue #41.

Asserting the **message substring**, not just that something was thrown, is what makes this more than
a checkbox. It holds the two loaders' error wording in agreement, so a rule that one side words
differently is a failure rather than a slow drift. Verified by rewording one case's expectation to a
plausible alternative: both suites failed on it, and both went green again when it was restored.

The invalid corpus is deliberately **not** overridable by the generator's scratch directory. Generated
inputs replace what the parser is asked to parse; the rules by which a loader decides a fixture is
valid are not part of that experiment, and pointing them at generated data would only disable them.

## Risks / Trade-offs

- **A wrong corpus path passes silently** → both loaders fail when they find zero fixtures (decision 7).
  This is the single most important guard in the change.
- **Gradle skips the suite when only fixtures changed** → `test` declares `inputs.dir(corpus)`.
- **The two JSON parsers disagree about which fixtures are even valid.** Verified: `JSON.parse` rejects
  a raw line feed, carriage return or U+001C inside a string literal; kotlinx-serialization 1.6.3
  accepts all three and preserves them. So a fixture whose escape was flattened into a literal byte is a
  hard load failure on Node and a silent success on Kotlin — for exactly the characters this corpus
  exists to carry. → the byte-level guard (decision 7 / the fixture-hygiene check) is what makes the two
  loaders agree on corpus membership; it is not belt-and-braces. Lone surrogates were checked and do
  **not** diverge (both yield a single code unit U+D800), so they are not the risk here. Both loaders
  read bytes as UTF-8 explicitly rather than relying on a platform default.
- **The two loaders' validation is not symmetric for free.** kotlinx-serialization rejects unknown keys
  and type mismatches by default; the Node loader must implement both by hand or it will accept fixtures
  the Kotlin side refuses. → the loader validation rules are specified as behavior, not as "the same
  code", and each side unit-tests its own rejection paths.
- **`divergences` becomes an escape hatch for real bugs** — recording a difference is easier than fixing
  it. → `reason` is mandatory and reviewed; the spec requires a divergence to be a decision, not a
  workaround. There is exactly one today and it has a written justification in the `task-parser` spec.
- **The corpus only holds what someone thought to write down** — it does not generate inputs, so it does
  not close the class of bug, it only makes each discovered instance permanent and bilingual. Accepted:
  it is a strict improvement over two hand-mirrored suites, at a fraction of a fuzzing harness's cost.
- **A third implementation would need a third loader** → acceptable; the format is language-neutral and
  the obligation is stated in the spec rather than in either existing suite.

## Migration Plan

1. Add the corpus directory with a small number of cases that exercise the format itself — including one
  with a `divergences` entry (U+0085) and one with a lone `\r` — plus both loaders. At this point both
  suites read the corpus and their hand-written cases are still in place; a mistake in the harness shows
  up as a failure against cases already known to pass.
2. Migrate the existing hand-mirrored cases into fixtures, requiring both suites to be green before the
  corresponding hand-written cases are deleted. This is authoring work, not transcription: most of the
  existing suite asserts only task text, via a helper that flattens sections away, so each fixture's
  counts and section titles are being stated for the first time. Existing text expectations were settled
  against the reference renderer and are trustworthy as a starting point; the rest is filled per
  decision 5.
  **If migrating a case surfaces a genuine divergence** — the outcome this whole change is built to
  produce — that fixture is parked with an issue rather than resolved here, and rather than papered over
  with a `divergences` entry. Behavior changes are a separate change (Non-Goals), and the migration must
  not be able to deadlock on its own success.
3. Delete the migrated cases from both suites and update the file comment that currently names
  hand-mirroring as the mechanism.
4. Add the generator (decision 12) and run it once against the finished corpus wiring, adjudicating
  whatever it reports before the change is archived. A first run that finds nothing is a result; a first
  run that finds something is the change paying for itself, and its findings follow the same fork as
  step 2.

Rollback is deleting the corpus directory, the generator and the two loaders; nothing else depends on
them, and step 3 is the only irreversible step (recoverable from git).

## Open Questions

None outstanding — the two that were open are settled in decisions 10 and 11.
