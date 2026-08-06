## Context

`parseTasks` (`packages/core/src/tasks.ts`) and `TaskParser.kt`
(`packages/intellij/src/main/kotlin/com/spek/intellij/core/`) are two implementations of one rule set.
Nothing links them: they are kept aligned by convention, and verified by unit tests written to mirror
each other case for case. That mechanism holds for cases someone thought to write down, and
structurally cannot hold for cases where the *same spelling* means different things to the two
runtimes.

Both known instances are of that shape. `$` in a regex, and "is this line blank", each delegate a
boundary decision to the host language instead of stating it. The proposal has the measurements; this
document is about which way to resolve them and why.

The existing code already knows about this failure mode in one place: `BLOCK_OPENER_RE` writes `\z` on
the Kotlin side where TypeScript writes `$`, with a comment saying exactly why. That precedent is the
model here — state the boundary in the pattern rather than inheriting it from the engine.

## Goals / Non-Goals

**Goals:**

- The two implementations return identical `total`, `completed`, and `sections` for identical input,
  for every input in the tables in the proposal.
- Where they currently differ from the reference renderer (`react-markdown` + `remark-gfm`), converge
  on the reference — the property the folding rules are already specified against — rather than on
  whichever implementation happens to be the incumbent.
- Remove the two engine-dependent spellings entirely, so the next reader does not have to know Java and
  JavaScript regex/whitespace tables to predict behaviour.

**Non-Goals:**

- A differential or shared-fixture test harness. It is the durable answer to this class of drift and it
  is deliberately deferred (see the proposal); this change adds mirrored cases in the existing style.
- Full Unicode parity between the two `.` character classes — see Risks for the one residual case that
  survives, and why closing it is not worth its cost.
- Any change to the folding rules themselves (dedent width, blank-line boundary, block openers). Only
  the two boundary *definitions* those rules are built on move.

## Decisions

### D1 — Fix line endings at normalisation, not at the match site

Replace the `\r\n` → `\n` normalisation with one covering all three CommonMark line endings, on both
sides, keeping the existing "normalise, then split on `\n`" shape:

- TypeScript: `content.replace(/\r\n/g, "\n")` → `content.replace(/\r\n?/g, "\n")`
- Kotlin: `content.replace("\r\n", "\n")` → `Regex("""\r\n?""").replace(content, "\n")`
  (Kotlin's two-string `replace` is literal, so this becomes a regex.)

`\r\n?` is greedy on the optional `\n`, so `\r\n` is still consumed as one ending and never becomes two
line breaks.

*Alternatives considered.* **Kotlin `$` → `\z` alone**, as issue #33 suggests: aligns the two on
TypeScript's answer, which the reference renderer contradicts, and leaves the multi-line CR-only file
(row 4 of the proposal's table) broken on both sides. **Strip one trailing `\r` per line after the
split**: fixes rows 1–3 but not row 4, where the `\r` is interior to the single unsplit line rather
than trailing — the symptom is addressed, the cause is not. **Split on a line-ending regex** instead of
normalising first: equivalent in behaviour, but it drops the line-for-line correspondence between the
two files that keeps them auditable, for no gain.

### D2 — `\z` in Kotlin's `CHECKBOX_RE` and `SECTION_RE` anyway

After D1 no line can contain a `\r`, so for the `\r` case `$` and `\z` are equivalent and this looks
cosmetic. It is not. Java's `$` matches before a final line terminator, and Java's terminator set is
larger than CommonMark's — measured on `- [x] a<X>` and `- [x] a<X>b`:

| Trailing char | JS `$` | Java `$` | Java `\z` | Reference |
|---|---|---|---|---|
| U+2028 (line separator) | no match | **match** | no match | no match |
| U+2029 (paragraph separator) | no match | **match** | no match | no match |

`\z` closes U+2028 and U+2029 exactly, and costs nothing. It also makes the two patterns say the same
thing independently of D1, so a future edit that touches the normalisation cannot silently reopen the
`\r` divergence.

*Alternative considered.* `RegexOption.UNIX_LINES`, which reduces Java's terminator set to `\n` alone:
it fixes U+0085 (see Risks) but simultaneously admits U+2028/U+2029 into `.`, where JS excludes them.
One divergence traded for another, with an extra flag to explain. `\z` strictly dominates.

### D3 — A blank line is spaces and tabs only, spelled explicitly

Replace `line.trim() === ""` (TypeScript) and `line.isBlank()` (Kotlin) with an explicit predicate over
`[ \t]`. This is CommonMark's definition, it matches the reference renderer, and it is the same
character class `leadingWhitespace` already uses on both sides — so the file becomes internally
consistent about what whitespace means.

The same substitution applies everywhere the two implementations lean on the runtime's whitespace
table, which is four sites each:

1. the blank-line branch in the main loop,
2. the trailing-blank-line trim in `flush`,
3. the per-line blank test in `flush`'s continuation map,
4. `first.trim()` for a single-line task, and the `##` section title trim.

Sites 1–3 are the blank-line predicate. Site 4 is a *trim*, and needs the same treatment for the same
reason: JS `trim()` strips NBSP and Kotlin's does not, so `- [x] foo<NBSP>` yields different `text` on
the two sides today, and the reference renders the NBSP.

*Alternatives considered.* **Adopt one runtime's notion** — both are wrong against the reference, in
opposite directions, so this only picks which files break. **Normalise exotic whitespace out of the
content**: alters what the user wrote, far beyond a parity fix.

### D4 — Mirrored tests are per-case and explicit

Each table row in the proposal becomes a named test on both sides, with the input built from escape
sequences rather than literal characters, so the intent survives an editor or a `.gitattributes` pass.
The existing reference-renderer test (`packages/web/src/components/TaskText.test.ts`) runs over this
repo's own `tasks.md` files, all of which are LF-normalised and free of exotic whitespace (verified),
so it cannot exercise any of these cases — the new tests must stand alone rather than lean on it.

## Risks / Trade-offs

**U+0085 (NEL) parity is not achieved, only narrowed** → Accepted and documented in the spec. JS `.`
matches U+0085 while Java's does not, so `- [x] a<U+0085>b` is a task in TypeScript and not in Kotlin,
before and after this change (`\z` makes Java reject both forms rather than one). Closing it means
replacing `(.+)` with an identically-spelled negated class on both sides, which trades a rare
divergence for permanent extra complexity in the two most load-bearing patterns in the file. U+0085 has
no natural source in a Markdown task list, unlike `\r` (legacy line endings) and NBSP (copy-paste).

**`total` and `completed` move for some inputs** → Only for files this repo does not contain: verified
by scanning every `.md` under the repo for CR, NBSP, BOM, U+001C, U+2007, U+202F, NEL, U+2028 and
U+2029 — zero hits. CLAUDE.md flags moving `total` as high-consequence because it drives progress bars
and CI badges; here it moves only toward the reference renderer, and only on files that were being
mis-parsed.

**A published package changes observable output** → `@spekjs/core` consumers can see different
`total` / `text` for affected files. Recorded in the proposal's Impact for whoever cuts the release,
with the bump this warrants (minor, not patch).

**The mirrored-test mechanism is still the only guard** → This change fixes two instances and leaves
the mechanism that let them through intact. The follow-up fixture corpus is the real fix; until then a
third instance of the same class is a live possibility. Both instances fixed here were found by
manually comparing engine semantics, which does not scale.
