## 1. TypeScript parser (`packages/core/src/tasks.ts`)

- [x] 1.1 Widen the line-ending normalisation in `parseTasks` from `/\r\n/g` to `/\r\n?/g`, so a lone
      carriage return also becomes a line feed before the split
- [x] 1.2 Add an explicit `isBlankLine(line)` helper matching only spaces and tabs, and use it at the
      three blankness sites: the blank-line branch in the main loop, the trailing-blank-line trim in
      `flush`, and the per-line blank test in `flush`'s continuation map
- [x] 1.3 Add an explicit spaces-and-tabs trim helper and use it for a single-line task's `text` and for
      the `##` section title, replacing `String.prototype.trim`
- [x] 1.4 Comment both rules in the style of the surrounding ones — what the runtime would otherwise
      decide, and why CommonMark's answer is the one being pinned

## 2. Kotlin parser (`packages/intellij/src/main/kotlin/com/spek/intellij/core/TaskParser.kt`)

- [x] 2.1 Widen the line-ending normalisation to `Regex("""\r\n?""")` (the two-string `replace` is
      literal, so this becomes a regex)
- [x] 2.2 Replace `$` with `\z` in `CHECKBOX_RE` and `SECTION_RE`, matching what `BLOCK_OPENER_RE`
      already does, and note that Java's `$` also admits U+2028 / U+2029
- [x] 2.3 Mirror 1.2 and 1.3: a spaces-and-tabs `isBlankLine` replacing `isBlank()` at the three sites,
      and a spaces-and-tabs trim replacing `trim()` for task text and section title
- [x] 2.4 Mirror the comments from 1.4, keeping the two files line-for-line comparable

## 3. Tests

- [x] 3.1 `packages/core/src/tasks.test.ts`: line-ending cases — CR-only file, `\r\r\n`, final line
      ending in CR, and a CRLF regression guard. Build inputs from escape sequences so the intent
      survives an editor or `.gitattributes` pass
- [x] 3.2 `packages/core/src/tasks.test.ts`: blank-line cases — U+00A0-only and U+001C-only lines do not
      end a task, a spaces-and-tabs line does, and trailing U+00A0 survives trimming
- [x] 3.3 `packages/intellij/src/test/kotlin/com/spek/intellij/core/TaskParserTest.kt`: mirror every
      case from 3.1 and 3.2, same names, same expectations
- [x] 3.4 Pin the accepted U+0085 divergence on both sides — the TypeScript test asserts it counts, the
      Kotlin test asserts it does not — so the exception stays visible and an accidental change to
      either side fails

## 4. Documentation

- [x] 4.1 Extend the `tasks.md` parsing bullet in `CLAUDE.md` with the two boundary rules now fixed
      (all three CommonMark line endings; blank means spaces and tabs only) and the U+0085 exception,
      since that bullet is where the parser's non-obvious semantics are recorded

## 5. Gates

- [x] 5.1 `npm run build:core` and `npm run build -w @spekjs/ui` before running the Node gates — the web
      package imports core's `dist`, so tests against an unbuilt core exercise the previous build
- [x] 5.2 `npm run type-check`, `npm run lint`, `npm test`
- [x] 5.3 `./gradlew test` in `packages/intellij`
