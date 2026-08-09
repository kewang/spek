## Context

`sortArtifacts(artifacts, mode, schemaOrder?)` is 40 lines of pure logic in
`packages/web/src/utils/artifact-sort.ts` with one call site (`ChangeDetail.tsx:162`) and 72 lines of
tests. It already imports `defaultRank` from `@spekjs/core/artifact-order` — the constant half of the
rule lives in core, the function half does not.

The **module** has a second consumer: `hooks/useArtifactSort.ts` imports `ArtifactSortMode` and keeps
its own runtime list of the three modes to validate what it reads back from `localStorage`.

What the move has to preserve:

- **`@spekjs/core/artifact-order` must stay node-free.** It is imported by a webview bundle today.
  Verified: `packages/core/dist/types.js` is `export {}` — `ChangeArtifact` is a pure type, so a
  `import type` costs nothing at runtime.
- **The three modes are already a cross-surface product requirement**, not a web detail:
  `custom-schema-artifacts` says the ordering control "SHALL be available on every surface that renders
  the change-detail view (web, VS Code, IntelliJ)".
- **Core's test setup is per-module**: `src/*.test.ts`, run by `node --import tsx --test src/*.test.ts`,
  type-checked through `tsconfig.test.json` (which exists precisely so test files are checked without
  the build config emitting them into the published `dist/`).

## Goals / Non-Goals

**Goals:**

- One implementation of the artifact ordering rule, reachable by every TypeScript surface including
  external registry consumers.
- No behavior change anywhere. Same function, same three modes, same output for every input.
- No growth in the package's entry-point surface.

**Non-Goals:**

- **Not moving the sort preference or the fallback messaging into core.** See D5.
- **Not renaming the modes.** See the risk on `"modified"`.
- **Not touching `packages/intellij`.** Checked rather than assumed: `git grep` for
  `ArtifactSortMode` / `sortArtifacts` / `alpha` across its Kotlin sources returns nothing. The
  Comparator in `ArtifactDiscovery.kt:124-133` is the Kotlin mirror of core's *discovery* order
  (`artifacts.ts:142-153`) — mtime desc with a `DEFAULT_ORDER` tiebreak — which is a different rule
  that this change does not touch. IntelliJ's ordering control is the same React SPA, so it picks the
  moved function up through `build:intellij`.

## Decisions

### D1 — Land in `artifact-order.ts`, not a new module behind a new subpath

`sortArtifacts` is built on `defaultRank`, which is already there; the header comment of that file
already claims ownership of "the frontend's ordering logic". Splitting the constant and the function
across two subpaths is the arrangement that produced this duplication in the first place.

Against a new `@spekjs/core/artifact-sort` subpath: every subpath is a permanent compatibility promise
and appears in `core-module`'s "Subpath exports resolve for external consumers" scenario. A second
entry point buys nothing here — both existing consumers already import `artifact-order`, and so would
any new one.

**And it stays off the main entry.** `index.ts` re-exports `extractHeadings` and `changeNodeSlug`
even though both also have subpaths, so "follow the precedent" is ambiguous here — the precedent that
governs is the *module's own*: `DEFAULT_ORDER` and `defaultRank` are subpath-only today, and the
function belongs wherever its constant already is. Adding it to `index.ts` would also hand consumers a
path that pulls in core's server-side modules to reach pure logic, which is the exact thing the
subpath exists to avoid.

### D2 — `ArtifactSortMode` moves with the function; persistence does not

The type is the function's parameter — separating them would leave callers hand-writing the union.
And the modes are not a web-local concern: the spec already requires all three on three surfaces.

What stays per-surface is **where the choice is stored**: web's `localStorage["spek:artifact-sort"]`,
VS Code's settings, IntelliJ's `PersistentStateComponent`. Core owns *what the modes mean*, each host
owns *how the user's pick survives a reload*. That line is already how the aggregation scope preference
is arranged (`getAggregationPrefs` / `setAggregationPrefs` per adapter).

### D3 — `modified` keeps returning the input array, but as a permission plus a caller obligation — not as a guarantee callers may lean on

`sortArtifacts(arts, "modified")` returns `arts` itself, not a copy; the existing test asserts
`assert.equal(out, arts)`. The behavior is kept — this change is a move, and a move that quietly starts
allocating is not a move.

**The tempting justification for promising it does not survive checking.** At the only call site
(`ChangeDetail.tsx:161-164`) the result is already wrapped in a `useMemo` keyed on
`[rawArtifacts, sortMode, schemaOrder]`, so identity across renders comes from the memo, not from the
absence of a copy: when the deps are unchanged the function is never called, and when they change a new
value is expected anyway. Only a caller with **no** memo would observe the difference.

Meanwhile the cost of promising it is concrete. The returned array is an alias of `ChangeDetail.artifacts`;
a consumer doing an in-place `.sort()` on what it got back mutates the change data it was handed. Turning
that aliasing into a `SHALL` would publish a contract that rewards the bug.

So the spec states it as **permission, not guarantee** — `modified` MAY return the input array itself,
and callers SHALL NOT mutate a returned list. That keeps the behavior, keeps the existing test
meaningful, and leaves core free to copy later without breaking anyone who read the contract. The other
two modes return a new array and SHALL NOT mutate the input; that stays explicit.

### D4 — Tests move to `packages/core/src/artifact-order.test.ts`

Straight move; the file already uses `node:test` + `assert/strict`, which is exactly core's harness.
It gains coverage of `DEFAULT_ORDER` / `defaultRank`, which have no test file of their own today —
the module is currently covered only indirectly through `artifacts.test.ts`.

`ChangeArtifact` is imported in the test as a value-shaped literal via a local `art()` helper; it
becomes a `import type` from `./types.js` — no cross-package import, no fixture.

### D5 — The "why is it falling back" message stays in each surface

Verified in `ChangeDetail.tsx:231-238`: the reason is decided from `data.status === "archived"` and
rendered as one of two English strings. That is a UI decision over data every surface already has —
core would add nothing but a translation seam. The message text is also product copy, and this package
publishes logic, not copy.

### D6 — `ARTIFACT_SORT_MODES` ships too, and the type is derived from it

`useArtifactSort.ts:5` hand-maintains `const MODES: ArtifactSortMode[] = ["modified", "schema", "alpha"]`
to validate the persisted preference. Every consumer that persists a choice needs that list, and
**TypeScript cannot catch a stale one** — a subset still satisfies `ArtifactSortMode[]`, so dropping a
mode type-checks and silently makes that mode unrestorable.

Exporting the constant and deriving the type from it (`(typeof ARTIFACT_SORT_MODES)[number]`) makes the
two unable to disagree, rather than keeping them in agreement by hand. It also gives the spec's "three
modes" a carrier a program can check. Cost: one frozen array of strings, still node-free.

Without this, moving only the *type* into core would leave the runtime projection of that type behind —
and the next consumer would write the duplicate this change exists to prevent, in a different shape.

### D7 — `packages/web`'s copy is deleted, not re-exported

One consumer, one import line. A compatibility re-export would only preserve a path no one outside the
package can use anyway (`packages/web` is not published).

## Risks / Trade-offs

- **[A core change makes web tests meaningless until core is rebuilt]** → `@spekjs/core`'s entry is
  `dist/`, so `npm test` after editing core exercises the *previous* build and passes. Ordering
  (`build:core`, then test) is a task step, not a note — this is the trap CLAUDE.md calls out by name.
- **[`"modified"` names a fact about core's delivery order, and that fact could change]** → the string
  means "whatever order core handed us", which today is mtime-newest-first. If core's default order
  ever changes, the mode name becomes a lie while the code stays correct. Renaming now is worse: the
  string is the persisted value in every user's `localStorage` and in VS Code settings, so a rename
  needs a migration for a problem that does not exist yet.
- **[Adding a public export is permanent]** → mitigated by it being close to the smallest possible
  addition: one function, one type, one constant, no new subpath, no new dependency, and the function
  and type were already written and tested.
- **[`alpha` orders by `localeCompare`, which is locale- and ICU-dependent]** → today all three
  surfaces run the same SPA under a browser's default locale, so the variance is unobservable.
  Published, the same call can order differently in a Node main process under a different `LANG`, or
  on a small-icu build. The behavior is unchanged (`artifacts.ts:152` already does this), but this is
  the first time it becomes an external contract, so the requirement **names the comparison** instead
  of saying "A–Z" — a reader who needs a stable cross-host order can then see that they must not
  assume one.
