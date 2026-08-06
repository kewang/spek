## 1. Corpus format and first fixtures

- [x] 1.1 Create `test-fixtures/task-parser/` at the repo root, with a `README.md` stating the fixture
  format (`name` equal to the filename, `note`, `input`, `expected`, optional `divergences`, optional
  reserved metadata object), that adding a case means adding one file, and that every character which
  tooling rewrites is written as a JSON escape, never literally
- [x] 1.2 Add a plain multi-section fixture that both implementations already agree on, as the baseline
  the harness is proven against
- [x] 1.3 Add a fixture whose input carries a lone carriage return, written as an escape sequence
- [x] 1.4 Add the U+0085 checkbox-line fixture with a `divergences` entry for the Kotlin implementation
  (no task counted), carrying its own expected result and the reason the difference is retained
- [x] 1.5 Add the U+0085 section-heading fixture — `## S<U+0085>T` — where the counts agree and only the
  section title differs, with a `divergences` entry for Kotlin (empty title)

## 2. Node loader and corpus suite

- [x] 2.1 Add `packages/core/src/tasks.corpus.test.ts` — loader and suite in one `*.test.ts` file so the
  build's `src/**/*.test.ts` exclude keeps it out of `dist`
- [x] 2.2 Resolve the corpus directory from `import.meta.url`, never from the working directory, with an
  environment-variable override so the generator's scratch directory can be substituted
- [x] 2.3 Validate each fixture on load, each failure naming the file: missing required field, `name`
  not matching the filename, unknown field, wrong value type, unrecognised implementation id under
  `divergences`, empty or missing `reason`, and every known implementation overridden at once
- [x] 2.4 Fail the run when the corpus directory yields zero fixtures — an empty directory satisfies
  Gradle's input validation, so this check is the only thing standing between a wrong path and a green
  suite of zero cases
- [x] 2.5 Assert the full parse result (`total`, `completed`, sections with each task's `text` and
  `completed`) per fixture, using a `divergences` override for `typescript` when present
- [x] 2.6 Add the fixture-hygiene check over raw bytes — printable ASCII plus line feed and tab, over the
  whole file, which subsumes the denylist (carriage return, U+0085, U+2028, U+2029, U+00A0, U+FEFF, every
  other C0/C1 character) with no list to maintain — and run it inside this suite, not as a manual step
- [x] 2.7 Unit-test the loader's validation rules against in-memory fixture objects, so each rejection
  path is exercised without committing a malformed file

## 3. Kotlin loader and corpus suite

- [x] 3.1 In `packages/intellij/build.gradle.kts`, pass the corpus directory to the `test` task as a
  system property resolved from the Gradle project directory at configuration time, overridable so the
  scratch directory can be substituted
- [x] 3.2 Declare the corpus directory as an input of the `test` task so editing a fixture re-runs the
  suite instead of leaving it up to date
- [x] 3.3 Add `TaskParserCorpusTest.kt` reading fixtures with the already-present
  `kotlinx-serialization-json`, decoding file bytes as UTF-8 explicitly
- [x] 3.4 Match the Node loader's rejections rather than inheriting the library's defaults: keep
  kotlinx's strict handling of unknown keys and type mismatches, add the rules it does not cover
  (`name` versus filename, empty `reason`, unrecognised implementation id, all implementations
  overridden), and fail when the system property is absent rather than skipping the suite
- [x] 3.5 Assert the full parse result per fixture, using a `divergences` override for `kotlin` when
  present
- [x] 3.6 Unit-test the Kotlin loader's validation rules against in-memory fixture objects

## 4. Migrate the hand-mirrored cases

- [x] 4.1 Author a fixture for every case in `packages/core/src/tasks.test.ts` of the form "input string
  to parse result". This is authoring, not transcription: most cases assert only task text through a
  helper that flattens sections away, so each fixture's counts and section titles are being stated for
  the first time and need a reviewer, per the design's decision 5
- [x] 4.2 Move each case's explanatory comment into its fixture's `note`
- [x] 4.3 Convert the cases in `TaskParserTest.kt` that have no counterpart in the Node suite, if any
- [x] 4.4 Keep as hand-written tests in both languages, and say so in the file comment: the CRLF-equals-LF
  equivalence assertion (two inputs, one invariant — splitting it into two fixtures loses it) and the
  "a single-line task's text contains no newline" property assertion
- [x] 4.5 If migrating a case surfaces a genuine divergence, park that fixture and open an issue rather
  than resolving it here or hiding it behind a `divergences` entry — a behavior change is a separate
  change, and the migration must not deadlock on finding what it was built to find
- [x] 4.6 With both suites green against the corpus, delete the migrated cases from
  `packages/core/src/tasks.test.ts` and `TaskParserTest.kt`
- [x] 4.7 Rewrite the header comment in both files: hand-mirroring is no longer the mechanism, and new
  cases belong in the corpus

## 5. Generator

- [x] 5.1 Add a generator under `scripts/` that emits randomised tasks.md inputs as fixture-format files
  into a scratch directory, with `expected` produced by `parseTasks`
- [x] 5.2 Draw inputs from the constructs the parser's rules actually branch on — line endings including
  a lone carriage return, leading spaces and tabs around the 2-character content offset, the whitespace
  characters the two runtimes classify differently, block openers and checkbox markers at column 0 and
  indented, `##` headings, code fences — rather than uniform random text
- [x] 5.3 Make both loaders readable against the scratch directory (the overrides from 2.2 and 3.1), so
  a differential run reuses the committed loaders unchanged
- [x] 5.4 Add the scratch directory to `.gitignore`, and keep the generator out of every automated gate
- [x] 5.5 Document how to run a differential pass and what to do with a mismatch: minimise, adjudicate
  against the reference renderer, then add it to the committed corpus as an ordinary authored fixture
- [x] 5.6 Run one differential pass against the finished wiring and adjudicate whatever it reports,
  following the same fork as 4.5 for anything genuine

## 6. Guards

- [x] 6.1 Verify the corpus and loader are absent from the npm tarball
  (`npm pack --dry-run -w @spekjs/core`)
- [x] 6.2 Verify the corpus is absent from the built plugin distribution
- [x] 6.3 Run both suites from the repo root and from inside each package, confirming identical fixture
  counts
- [x] 6.4 Edit a fixture with no source change, re-run `./gradlew test`, and confirm the task executes
  rather than reporting up to date
- [x] 6.5 Point each suite at an empty directory and confirm both fail, since Gradle's input validation
  accepts an existing empty directory

## 7. Documentation

- [x] 7.1 Update the parser section of `CLAUDE.md`: the corpus is what keeps the two implementations
  aligned on known inputs, the generator is what finds unknown ones, and a newly found divergence goes
  in as a fixture
- [x] 7.2 Document in `CONTRIBUTING.md` how to add a task-parser test case — one fixture file, escapes
  only, expected values authored rather than captured from a run
- [x] 7.3 Add to the "mirrored in Kotlin" note in `docs/prd.md` a sentence limited to the task parser,
  rather than rewriting the existing sentence — it covers the scanner, change reader, artifact discovery
  and schema order too, none of which the corpus verifies

## 8. Gates

- [x] 8.1 `npm run build:core`, then `npm run type-check`, `npm run lint`, and `npm test` all pass
- [x] 8.2 `./gradlew test` passes in `packages/intellij`

## 9. Shared rejection corpus (added after verification)

- [x] 9.1 Add `test-fixtures/task-parser/invalid/` — one file per rejection case, carrying the
  document, the filename to report it under, the stage that must reject it (`bytes` / `parse`), and a
  substring the error message must contain
- [x] 9.2 Cover every rule both loaders enforce, including the `"meta": null` case that verification
  found: Kotlin rejected it properly while Node threw a bare `TypeError` naming no file
- [x] 9.3 Give the Node loader a `parseFixture(document, file)` entry point matching the Kotlin one, so
  a single invalid case drives both through one call and `not valid JSON` is reachable on both
- [x] 9.4 Read the invalid corpus from both suites, asserting each case is rejected, that the message
  names the file, and that it contains the expected substring
- [x] 9.5 Resolve the invalid corpus independently of the substitutable corpus directory — a generated
  scratch run replaces the parser's inputs, never the loader's own rules
- [x] 9.6 Delete the hand-written rejection tests from both suites, and the positive-path tests the
  committed corpus already covers
- [x] 9.7 Verify the mechanism catches wording drift: reword one case's expected substring, confirm
  both suites fail, restore it and confirm both are green
- [x] 9.8 Re-run the full gates from section 8
