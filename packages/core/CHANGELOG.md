# Changelog

`@spekjs/core` has its own version line, independent of the spek product releases tracked in the
repository root `CHANGELOG.md`.

## 1.9.1

- **A cached CLI failure no longer outlives its cause.** `ttlCached` — behind `schemaOrder`, the schema
  catalog and the schema definition read — remembered every outcome for the full 30-second window,
  including "the `openspec` binary could not be reached". A consumer that fixes `PATH` (or resolves the
  user's shell environment after startup, which is how this surfaced from an Electron host) got 30 more
  seconds of "unavailable" from a CLI that was by then working.
  Failures are now classified: an unreachable or timed-out CLI is retried on the next read, while a CLI
  that answered unusably is still cached, because that answer is identical a second later and is the
  expensive one to re-ask. No exported type changed and no export was added — if you worked around the
  old behaviour by shortening a poll interval or restarting, you can stop
  ([#46](https://github.com/spekhq/spek/issues/46)).
- **The build script no longer depends on a Unix shell.** `rm -rf` (and `cp`) are replaced by `node -e` one-liners, with no new dependencies, so building this package from a clone works under Windows `cmd.exe`. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) ([#47](https://github.com/spekhq/spek/pull/47))

## 1.9.0

- **New: `specHeadingLabel(text)`**, exported from the package root and from the browser-safe
  `@spekjs/core/headings` subpath beside `extractHeadings` / `slugifyHeading`. Given a spec heading's
  text it returns what a host should *display* for it: a leading OpenSpec format keyword
  (`Requirement:` / `Scenario:`) removed, anything else returned unchanged. Matching is
  case-sensitive and anchored, and a heading whose entire content is the keyword is returned as-is.

- **Nothing else changes, deliberately.** `extractHeadings` does not call it: `Heading.text` remains
  the text as authored and `Heading.slug` remains derived from that text, so every anchor a consumer
  has already minted still resolves. The label is a third value that nothing is derived from —
  deriving a slug from it would silently invalidate existing links.

- **Pass the whole heading text.** The decision of whether a keyword is present, and whether anything
  survives its removal, is only correct over the complete heading: a requirement named after a code
  span begins with a text run that is exactly `Requirement: `, and judging that fragment alone
  concludes there is nothing left and keeps the keyword.

## 1.8.0

- **New runtime dependency: `yaml`.** Until now the package's only runtime dependency was
  `cross-spawn`. A `schema.yaml` carries a nested artifact list and multi-line instruction blocks,
  which the single-line parsing used for `openspec/config.yaml` cannot handle. If your install
  budget or supply-chain review cares about the dependency set, this is the change to note.

- **Schema enumeration and reading.** `listSchemas(repoRoot)` returns every workflow schema the
  `openspec` CLI resolves for a repo — `project`, `user` and `package` sources are all reported, each
  labelled — and `readSchema(repoRoot, name)` parses the definition at the directory the CLI reports.

  **Which schemas exist is only ever asked of the CLI, including for the repo's own
  `openspec/schemas/`.** A schema is configuration for OpenSpec's resolver, spread across three
  directories with precedence and shadowing, of which a repo holds one. Reading it yourself answers a
  question OpenSpec owns, with a more forgiving parser, against a format whose commands are still
  marked experimental. There is no disk fallback.

  A CLI failure is **not** an exception: you get an empty list plus a `degradedReason`, the same shape
  `schemaOrder` already degrades to. Callers must handle that case — an empty list does not mean the
  repo has no schemas.

- **New browser-safe subpath `@spekjs/core/schema-flow`**, alongside the existing `headings` subpath,
  for consumers that need the `requires`-graph maths without pulling in `child_process`:
  `computeArtifactLevels`, `applyStepLevel`, `schemaArtifactCount`, `drawableRequires`.

  `drawableRequires` returns the **transitive reduction** — a `requires` entry that a longer path
  already implies is omitted, because drawing it detours around the very step that implies it.

Additive throughout: no existing signature changes, and nothing is removed.

## 1.7.0

- **`sortArtifacts` keeps the element type you give it.** It is now generic in the element, so an
  array of your own artifact type comes back as your own type instead of `ChangeArtifact[]` — no
  cast, and your fields stay reachable on the result:

  ```ts
  interface MyArtifact extends ChangeArtifact { relPath: string }

  const sorted: MyArtifact[] = sortArtifacts(myArtifacts, 'schema', order)
  sorted[0].relPath // typed
  ```

  Previously the signature returned `ChangeArtifact[]` whatever went in. Structural typing let you
  pass your own DTO and every value survived at runtime, but the type dropped your fields, leaving an
  unchecked cast as the only way through — on a function whose whole contract is reordering the
  objects it was handed without rebuilding them.

- **The element only has to carry what the rule reads** — `id` (the narrative rank, the `schemaOrder`
  lookup and both tiebreaks) and `title` (`alpha`). It need not be a `ChangeArtifact`; one missing
  either is rejected at compile time.

- **No runtime change.** Same comparisons, same order, same array-identity rule (`modified` may still
  return the array it was passed). Nothing was added, removed or renamed.

- **Three narrow source-level caveats**, all from a call losing its contextual type rather than from
  the constraint — annotating the call site restores each one. If your build breaks on the upgrade, it
  is one of these:
  - `ReturnType<typeof sortArtifacts>` / `Parameters<typeof sortArtifacts>` now resolve the element to
    `Pick<ChangeArtifact, 'id' | 'title'>`, not `ChangeArtifact`.
  - `let list = sortArtifacts([], 'modified')` infers `never[]`, so assigning artifacts *into* `list`
    afterwards fails. Reading out of a result is unaffected in every case.
  - An inline object-literal array at an uncontextualised call widens its literal fields: `kind`
    becomes `string` rather than `ArtifactKind`.

## 1.6.0

- **`sortArtifacts` is now part of the package**, exported from the `@spekjs/core/artifact-order`
  subpath beside `DEFAULT_ORDER` and `defaultRank`. It orders a change's artifacts by one of three
  modes and was previously private to spek's web package, so a consumer could import the narrative
  order constant but had to reimplement the sort that applies it.

  ```js
  import { sortArtifacts, ARTIFACT_SORT_MODES } from '@spekjs/core/artifact-order'
  ```

  - `modified` — the order given, unchanged. **May return the array it was passed**, so callers must
    not mutate a returned list.
  - `schema` — the authoritative sequence in `ChangeDetail.schemaOrder`, with artifacts absent from it
    following in narrative order. When `schemaOrder` is absent or empty the whole list takes the
    narrative order — which is what every archived change gets, since the order is only queried for
    active ones.
  - `alpha` — by display title via `localeCompare`, with the artifact id as a tiebreak. The comparison
    is locale- and ICU-dependent: two titles may order differently on two hosts, so impose your own
    order if you need one that is host-independent.

- **`ARTIFACT_SORT_MODES` and `ArtifactSortMode` ship with it**, and the type is *derived from* the
  array (`(typeof ARTIFACT_SORT_MODES)[number]`). Validate a persisted preference against the array
  rather than a hand-written copy: a copy that is missing an entry still satisfies the type, and the
  omitted mode silently stops restoring.

- **Additive only.** Nothing was removed or renamed, no existing behavior changed, and no new subpath
  was added — these land on the subpath that already existed. The module remains free of any runtime
  Node import, so it stays safe to value-import from a browser bundle or a host's main process.

## 1.5.0

- **`parseTasks` states its line-ending and blank-line boundaries instead of inheriting them from the
  JavaScript runtime.** Both were previously delegated: line splitting normalised only `\r\n`, and
  blankness was `line.trim() === ""`. Neither matches CommonMark, and neither matches what the Kotlin
  re-implementation shipped in spek's IntelliJ plugin did, so the same `tasks.md` could produce
  different results on different surfaces (issue #33).

  **Behavior change for consumers**, on content this affects:

  - All three CommonMark line endings — `\n`, `\r\n`, and a **lone `\r`** — are now recognised. Content
    using carriage-return line endings, or carrying a stray `\r` before a `\r\n`, previously had
    checkboxes on those lines skipped entirely; they are now counted, so `total`, `completed` and
    `sections` change for such content.
  - A line is blank only when it is empty or contains **spaces and tabs alone**. `trim()` also strips
    U+00A0, U+FEFF, U+2007 and U+202F, so a line holding one of those used to end a task's
    continuation and drop the text after it from `TaskItem.text`; it is now content, as CommonMark and
    a reference renderer treat it. The same class governs the trim applied to a single-line task's
    `text` and to a section `title`, so a trailing U+00A0 there is now preserved rather than stripped.

  Content using ordinary `\n` line endings and no exotic whitespace — the overwhelming majority —
  parses identically to 1.4.0.

  One divergence from the Kotlin implementation is knowingly retained and pinned by a test on both
  sides: U+0085 is an ordinary character to JavaScript's `.` and a line terminator to Java's, so a
  checkbox line containing it is a task here and not there.

## 1.4.0

- **`parseTasks` keeps a task's continuation lines instead of discarding them.** The line loop
  previously kept only lines matching the checkbox or section pattern and dropped everything else, so
  sub-bullets, explanatory paragraphs and code blocks written underneath a `- [ ]` item never entered
  the data model at all.

  **Behavior change for consumers: `TaskItem.text` may now contain newlines, where it was previously
  always single-line.** No type or field change, and additive in effect — but a consumer rendering it
  as a one-line label may now wrap. The field's contract is "Markdown, possibly multi-line": render
  it, don't treat it as a plain string label.

  Continuation lines are newline-joined onto the first line and each dedented by up to 2 leading
  whitespace characters — the `- ` marker's CommonMark content offset — so the folded text renders the
  way a standard CommonMark+GFM renderer displays the same source in place. A task with no
  continuation lines is byte-identical to the previous output.

- **A column-0 line that opens a block ends the task.** Lazy continuation applies to paragraph text
  only, so a bullet, ordered marker, ATX heading, blockquote, code fence or thematic break at column 0
  terminates the preceding item rather than being folded into it. Indented to the content offset, the
  same line still belongs to the task. Two divergences from a reference renderer are knowingly kept: a
  folded setext underline (`===`) renders as a heading, and a column-0 checkbox inside a fenced code
  block still counts as a task — the alternatives are deleting content and moving `total`.

- **`total`, `completed` and section grouping are unchanged.** `CHECKBOX_RE` remains anchored at
  column 0, so an indented `- [ ]` belongs to its parent task's text and is not counted. Verified by
  parsing every `tasks.md` in the spek repository with the old and new parsers: no difference in
  `total` / `completed`, per-section counts, section titles, or any task's first line.

## 1.3.0

- **New export: `changeNodeSlug(node)`** — resolves a graph change node back to its change slug,
  removing the worktree key that `buildGraphDataAggregated` namespaces aggregated ids with
  (`change:<worktreeKey>:<slug>`). It derives the slug from the node's `source` rather than by
  splitting on `:`, because the id alone cannot distinguish a worktree key from the leading segment of
  a slug, and it leaves an already-normalised id untouched.
- **New subpath: `@spekjs/core/graph-node-id`** — the same function, in a module with no runtime
  imports, so a browser bundle or a host's main process can use it without pulling in `node:fs` or
  `cross-spawn`. Joins `./headings` and `./artifact-order`; `changeNodeSlug` is also exported from the
  package root.

  This exists because the parsing previously lived in `@spekjs/ui`, one package away from the code
  that writes the format — the split that allowed
  [#25](https://github.com/spekhq/spek/issues/25), where core began namespacing ids and ui's parser
  did not follow. A downstream host that needed the parsing outside a bundler could not reach ui's
  copy either, since that package's only entry point carries React and d3
  ([#28](https://github.com/spekhq/spek/issues/28)). Producer and parser now sit in one place.

## 1.2.0

- **Jujutsu (jj) workspace aggregation (experimental).** `scanOpenSpecAggregated` and
  `buildGraphDataAggregated` take a new `includeJj` option (**default `false`**); when set, active
  changes are also collected from every jj workspace of the repo and merged into the same aggregated
  result as git worktrees. Contributed by [@DannyGoodall](https://github.com/DannyGoodall) (Danny
  Goodall).
- jj copies are **never** fed into the git-divergence election used for git worktrees — a jj
  working-copy commit is a change id, not a git ref, and every jj workspace materialises the full
  trunk, so history-based election is meaningless there. They get their own path: dedup by **content
  fingerprint**, keeping a diverged copy as its own entry. The git-worktree path is byte-for-byte
  unchanged, and with `includeJj` off (the default) behaviour is identical to 1.1.3.
- New exports: `listWorkspaces(dir, { includeJj })` (git worktrees + jj workspaces, deduped by path
  so a colocated main directory is counted once, with the git entry winning to keep its branch),
  `listJjWorkspaces(dir)`, `parseJjWorkspaceList(stdout)`, and `jjCurrentChangeSlugs(dir)`
  (read-only, `--ignore-working-copy`). All of them resolve to `[]` when the `jj` CLI is absent or
  the directory is not a jj repo — `jj` is never required, and nothing is spawned unless jj is
  requested.
- `ChangeInfo` gains two optional fields: `isCurrent` (this copy is what the source workspace's `@`
  is editing) and `conflictsWith` (a diverged jj copy, valued with the label of what it diverged
  from).
- **Type change (source-level breaking for constructors):** `WorktreeInfo` and `WorktreeSource`
  gain a **required** `vcs: "git" | "jj"` field. Code that only *reads* these types is unaffected;
  code that *constructs* one (a test fixture, a hand-built worktree list) must now supply `vcs`.

## 1.1.3

- `cliSchemaOrderProvider` now caches the authoritative artifact order under
  `${repoRoot}::${schema}` instead of `${repoRoot}::${slug}`. The order returned by
  `openspec status` (`planningArtifacts` + `artifactPaths`) is a property of the change's **schema**,
  not of the individual change, so changes sharing a schema now share **one** CLI spawn per 30s TTL
  window rather than paying one each. Changes whose schema cannot be resolved locally share a
  repo-level default bucket, since the CLI resolves the same built-in default for all of them.
  `resolveSchemaOrder` still runs on every read, so the `schemaOrder` delivered for any given change
  is unchanged.
- `SchemaOrderProvider` takes a third argument, `schema` (`string | null`) — the change's locally
  resolved schema name, which `readChange` passes through. It is used only to bucket the cache and
  never reaches the CLI's argv. Two-parameter providers stay assignable to the type, so injected
  providers need no change.
- `readChange` now returns `null` for an empty slug rather than resolving it to the `changes/`
  directory itself and reporting that directory as an active change.

## 1.1.2

- `scanOpenSpecAggregated` and `buildGraphDataAggregated` now **deduplicate active changes across
  worktrees by slug** instead of returning one entry (or graph node) per worktree that inherited a
  copy. The surviving copy is elected by **git divergence**: a copy is a candidate only when it has
  advanced that change past its merge-base — committed (three-dot `git diff <mainHead>...<wtHead>`
  under `openspec/changes/`) or uncommitted (`git status`). The main worktree competes on the same
  terms (reverse three-dot for its side); when no copy diverges the slug stays on main, and ties
  among the advanced copies — main included — break by most-recently-modified file (mtime). A copy
  that merely inherited an untouched change no longer shadows the copy being edited, so a change's
  `taskStats` no longer roll back to the fork-point snapshot. **No public API signature changes** —
  only which entries survive deduplication differs.
- `buildGraphDataAggregated` no longer runs a `scanOpenSpec` per worktree solely to obtain slugs; it
  derives them from the per-worktree graph it already builds, one fewer subprocess pass per worktree.

## 1.1.0

> [!WARNING]
> **This release contains a source-breaking type change, despite being a minor version.**
>
> `ChangeInfo` gains a **required** `defaultSchema: string | null` property. If your code
> *constructs* `ChangeInfo` objects — for example to feed `<ChangeTimeline changes={...} />`
> from `@spekjs/ui` — it will fail to type-check with `TS2741: Property 'defaultSchema' is
> missing`. Reading `ChangeInfo` values produced by this package is unaffected.
>
> **Migration:** add `defaultSchema` to any `ChangeInfo` you build. Pass the repo default
> schema (the `schema:` value in that change's `openspec/config.yaml`), or `null` if unknown —
> `null` simply means "no default known", and consumers that compare against it will show the
> schema badge rather than hiding it.
>
> This was shipped as a minor rather than a major because the package had no known external
> consumers at the time of release. Semver would normally call for `2.0.0`; if you were relying
> on `^1.0.0` resolving to a compatible type, pin `@spekjs/core@1.0.0`.

- `ChangeInfo` now carries `defaultSchema` — the default schema of the worktree the change was
  scanned in — so consumers can decide per change whether its `schema` diverges from its own
  repo baseline. Under cross-worktree aggregation each change carries its *own* worktree's
  default, which keeps list and detail views consistent when worktrees declare different
  `config.yaml` schemas.
- `scanOpenSpec` now reads `openspec/config.yaml` **once per scan** instead of once per change
  (it was re-read on every change that didn't declare its own `schema:`, i.e. the common case).

## 1.0.0

First public release on npm.

- **Renamed from `@spek/core` to `@spekjs/core`.** The `@spek` scope on npm is registered to another
  account, so the package could never have been published under its original name. The public API is
  unchanged — every function signature, type and subpath export is identical.
- **Runtime dependencies trimmed to `cross-spawn` alone.** The package previously declared `fuse.js`
  and `gray-matter`, neither of which it imports. Consumers no longer download them, nor
  `gray-matter`'s own transitive dependencies (`js-yaml`, `kind-of`, `section-matter`,
  `strip-bom-string`).
- Published with `dist/` and its type declarations only; sources are not shipped.
