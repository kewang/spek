## Context

`sortArtifacts` lives in `packages/core/src/artifact-order.ts` and is typed
`(artifacts: ChangeArtifact[], mode, schemaOrder?) => ChangeArtifact[]`. It never constructs an element:
every branch either returns the input array or a reordered copy of it, so the objects that come out are
the objects that went in. The signature does not say that.

Structural typing lets a consumer pass a superset DTO, and the runtime does the right thing with it —
the result loses nothing. Only the *type* collapses to `ChangeArtifact[]`, which is what makes the
problem quiet: nothing fails until the consumer assigns the result back to its own array type, and the
obvious unblock is a cast. That is the state `spekterm` is in with its `ChangeArtifactView` (issue #45).

The web package never hit this because it uses core's own `ChangeArtifact` — so the gap could only appear
once a consumer brought its own DTO, which is the case the 1.6.0 move existed to serve.

## Goals / Non-Goals

**Goals:**

- The element type a caller passes is the element type it gets back, with no cast.
- The input constraint states exactly what the rule reads, so any DTO carrying those fields is accepted.
- Zero runtime change, and zero edits at existing call sites.
- A regression guard at the level that regressed — the type, not the behavior.

**Non-Goals:**

- Changing what any mode does, the mode list, or the array-identity rule (`modified` may return its input).
- Any accommodation for elements that lack `id` or `title` — the rule cannot order those.
- Touching `packages/intellij`'s Kotlin mirror: it reproduces artifact *discovery*, not this sort.

## Decisions

### Generic in the element, constrained to the fields read

```ts
export function sortArtifacts<T extends Pick<ChangeArtifact, "id" | "title">>(
  artifacts: T[],
  mode: ArtifactSortMode,
  schemaOrder?: string[],
): T[]
```

`T` infers from the argument, so nothing at a call site changes and `packages/web` keeps the exact
signature it resolves today (`T` = `ChangeArtifact`).

The constraint is `Pick<ChangeArtifact, "id" | "title">` rather than `ChangeArtifact` because those two
fields are all three modes read: `id` for `defaultRank`, the `schemaOrder` lookup and both tiebreaks;
`title` for `alpha`. Constraining to `ChangeArtifact` would keep out DTOs that carry the ordering fields
but not, say, `content` — which is the shape a viewer that streams file bodies separately would hold.
Deriving the constraint with `Pick` rather than writing `{ id: string; title: string }` keeps it tied to
`ChangeArtifact`: if either field is ever renamed there, this stops compiling instead of quietly
describing a field that no longer exists.

**Alternatives considered:**

- *An overload pair* (`ChangeArtifact[]` plus a generic one) — the generic one already subsumes the
  concrete one, so the overload adds a second thing to keep in step for nothing.
- *`ChangeArtifact & Record<string, unknown>`* — accepts extra fields but still returns the intersection,
  so the caller's named fields are `unknown`. It does not solve the problem it looks like it solves.
- *Leaving the cast to consumers* — it is unchecked, and it sits on the one function whose contract is
  "same objects, different order". The cast is the defect, not the workaround.

### `byDefaultOrder` widens too

```ts
function byDefaultOrder(a: Pick<ChangeArtifact, "id">, b: Pick<ChangeArtifact, "id">): number
```

This is the half that is easy to miss: it is passed straight to `Array.prototype.sort` on a `T[]`, and
`T` is not assignable to a parameter typed `ChangeArtifact`, so leaving it alone makes the generic
version fail to compile. It is widened to `id` alone — the only field it reads — not to the full
`id | title` constraint, for the same reason the public constraint is minimal.

### The regression guard is a type-level test

The signature is what regressed, and no behavior test can see a narrowed return type: the values are
correct either way. The guard therefore has to be checked by `tsc`, and it already is —
`packages/core/tsconfig.test.json` exists precisely so test files are type-checked, and root
`npm run type-check` runs it. So the guard is written in `artifact-order.test.ts` as ordinary code:

- a local interface extending `ChangeArtifact` with a field of its own, sorted and **assigned back to
  its own array type** — a narrowed return type makes that assignment fail;
- the consumer's own field read off the result, so the guard fails on a widened return type too;
- a **negative** case with `@ts-expect-error` on an element type missing `title`. `@ts-expect-error`
  reports an *unused* directive when the error stops occurring, so this fails in both directions: it
  catches a constraint loosened to accept anything, not only one that stays too tight.

No new dependency (no `expect-type` / `tsd`): the assertions are assignments the repo's existing
type-check pass already evaluates. The same test also asserts at runtime that the extra field survives
on the result — which is what makes the type claim true rather than merely stated.

## Risks / Trade-offs

- **Three narrow patterns that compiled against 1.6.0 stop compiling.** Each was reproduced against the
  emitted declaration, and all three share one cause — `T` is inferred where a fixed parameter type used
  to be supplied, so wherever a call has no contextual type, inference now decides what the old signature
  stated. They are recorded in the proposal's Impact because the release note is written from there.
  - `ReturnType<typeof sortArtifacts>` / `Parameters<typeof sortArtifacts>` resolve `T` to its
    constraint, `Pick<ChangeArtifact, "id" | "title">`, not `ChangeArtifact`.
  - `let list = sortArtifacts([], "modified")` infers `T` as `never`, so assigning artifacts *into*
    `list` afterwards fails.
  - An inline object-literal array at an uncontextualised call widens its literal fields — `kind` becomes
    `string` rather than `ArtifactKind`.

  Mitigation: annotating the call site restores every one of them, and the proposal states them for the
  release note. A default type argument (`= ChangeArtifact`) looks like the fix and is not — tested:
  `[]` still infers `never`, and `ReturnType` erases to the constraint rather than the default.
- **The constraint is now part of the published contract** → narrowing it later (adding a third required
  field) breaks consumers whose DTO lacks it. Mitigation: it is stated in the spec and in the README, and
  the negative type test makes any future edit to it deliberate.
- **`alpha` requires `title` even where a caller only ever sorts by `schema`** → a DTO with `id` alone is
  rejected. Accepted deliberately: a per-mode constraint would need overloads or a mode-dependent
  conditional type, which is a large complication for a case nobody has.
- **The one thing that is genuinely unaffected**: reading *out of* a result. `never[]` and any inferred
  element type are assignable to `ChangeArtifact[]`, so `const x: ChangeArtifact[] = sortArtifacts(…)`
  compiles in every case above — which is why the breakage is easy to state backwards and worth pinning
  precisely rather than waving at.
