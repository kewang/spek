## Why

`sortArtifacts` was moved into core (1.6.0) so that a consumer outside this monorepo would consume the
ordering rule instead of re-deriving it. Its signature takes and returns `ChangeArtifact[]` — which is
enough for the only consumer that existed at the time, `packages/web`, because that one uses core's own
`ChangeArtifact`.

It is not enough for the consumers the move exists for. A consumer that keeps its own artifact DTO — a
superset of `ChangeArtifact` — can pass it in (structural typing accepts it) but **gets
`ChangeArtifact[]` back**, so at the type level every field of its own is gone. The values are still
there at runtime; only the signature drops them. Observed in `spekterm`, whose `ChangeArtifactView` adds
the `relPath` it needs to open the artifact's file (issue #45):

```ts
const sorted = sortArtifacts(views, "schema", order)   // accepted
const back: ChangeArtifactView[] = sorted              // TS2322
```

The only way through is a cast the compiler cannot check — on a function whose entire job is to reorder
objects without rebuilding them. So the consumer's choice is an unchecked cast or the duplicate rule the
move was meant to prevent, and `spekterm` is holding on this for its own artifact-ordering fix.

## What Changes

- **`sortArtifacts` becomes generic in its element type**:
  `sortArtifacts<T extends Pick<ChangeArtifact, "id" | "title">>(artifacts: T[], mode, schemaOrder?): T[]`.
  Whatever element type goes in comes back out.
- **`byDefaultOrder` is widened to `Pick<ChangeArtifact, "id">`** — the non-obvious half. Left at
  `ChangeArtifact`, `T` is not assignable to it and the generic version does not compile.
- The constraint is `id | title` because those are the only two fields the rule reads: `id` for the
  narrative rank, the schema-order lookup and both tiebreaks; `title` for `alpha`. Constraining to more
  than the function reads would exclude consumers for no reason; constraining to less would not compile.
- **A type-level regression test** is added, since a type is what regressed here — behavior tests cannot
  see a narrowed return type, so without one the next signature edit can silently take it back.
- The constraint is documented where a consumer will look for it: `packages/core/README.md`'s subpath
  section, and the `core-module` requirement.
- **No runtime change whatsoever** — same comparisons, same order, same array identity rules.
  `packages/web` needs no edit: `T` infers to `ChangeArtifact` and the emitted return type is what it is
  today.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `core-module`: the artifact sort requirement gains element-type preservation — the returned list has
  the same element type it was given, and the input is constrained to the fields the rule actually reads.

## Impact

**Code**

- `packages/core/src/artifact-order.ts` — `sortArtifacts` generic, `byDefaultOrder` widened
- `packages/core/src/artifact-order.test.ts` (or a sibling type-level test) — a case that sorts an array
  of a local interface extending `ChangeArtifact` and assigns the result back to that interface, plus a
  negative case asserting an element type missing `title` is still rejected
- `packages/core/README.md` — the subpath section states the constraint
- **No call-site edits anywhere**: `packages/web` is the only in-repo consumer, and its inference is
  unchanged. Nothing in `packages/intellij` is involved — its Kotlin core mirrors artifact *discovery*,
  not this sort.

**For whoever cuts the next release** (per CLAUDE.md, the bump is not decided inside a change): this is
**minor, not patch**, even though nothing new is exported and no behavior changes. A consumer can now
write code that compiles only against this version — passing its own DTO and keeping the type is exactly
what `spekterm` will do — so a `^1.6.0` range resolving to 1.6.0 would fail to build. That is the test
that separates minor from patch, and it is the same class as core 1.3.0 and 1.4.0, both of which a
commit-prefix rule would have under-bumped.

It is **not** invisible to existing consumers, though, and the release note should say so. Going generic
means `T` is inferred where a fixed type used to be supplied, and three narrow patterns that compiled
against 1.6.0 no longer do (each reproduced against the emitted declaration):

- `let list = sortArtifacts([], "modified")` — with no contextual type, `T` infers `never`, so `list` is
  `never[]` and assigning artifacts *into* it afterwards fails. Reading out of it is unaffected, which is
  why this one is easy to state backwards.
- `sortArtifacts([{ id, title, kind: "markdown", content }], "alpha")` — an inline object-literal array at
  a call with no contextual type now widens `kind` to `string`, where the old parameter type pinned it to
  `ArtifactKind`.
- `ReturnType<typeof sortArtifacts>` / `Parameters<typeof sortArtifacts>` now resolve `T` to its
  constraint, `Pick<ChangeArtifact, "id" | "title">`, not `ChangeArtifact`.

All three come from the contextual type going missing, not from the constraint: annotate the call site
(`const x: ChangeArtifact[] = …`, a typed fixture, a typed return position) and they compile again. A
default type argument (`= ChangeArtifact`) does **not** fix them — tested: `[]` still infers `never`, and
`ReturnType` erases to the constraint rather than the default. Under a strict semver-for-types reading
this is source-breaking and argues major; ecosystem practice ships widenings of this shape as a minor,
which is the call here given the blast radius above and one known external consumer.

**Not in scope**

- The three modes' behavior, the mode list, and the array-identity rule (`modified` may return its
  input) are untouched. `custom-schema-artifacts` specifies user-visible ordering and does not change.
