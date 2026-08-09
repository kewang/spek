## Why

`packages/core/src/artifact-order.ts` states its own purpose in its header comment: the constant was
lifted out of the server-only `artifacts.ts` so that it could be imported from a webview bundle,
"avoiding a duplicate definition of the frontend's ordering logic".

**Only the constant was lifted.** The function that orders artifacts by it — `sortArtifacts` in
`packages/web/src/utils/artifact-sort.ts` — stayed in the web package, where nothing outside that
package can reach it. Which makes the lift half-done rather than done: an external consumer gets the
vocabulary of the rule and has to write the rule.

A second copy is about to be written by a registry consumer outside this monorepo, which has hit
exactly the case `sortArtifacts`'s `schema` branch already handles: `schemaOrder` unavailable, falling
back to the narrative order rather than to the delivered mtime order. It cannot import the answer,
so it will re-derive it — and the two will drift the first time either side learns something.

The rule is not web-specific. `custom-schema-artifacts` already requires the ordering control to exist
on **every** surface that renders change detail ("web, VS Code, IntelliJ"), and `core-module` already
carries two precedents for exactly this shape — `Heading extraction utility` and `Graph node id parsing`,
both node-free helpers that core owns because more than one surface consumes them. Artifact ordering
belongs in the same place, next to the constant it is built on.

## What Changes

- **`sortArtifacts` and `ArtifactSortMode` move into `packages/core/src/artifact-order.ts`**, beside
  `DEFAULT_ORDER` and `defaultRank`. The file stays pure logic with no runtime Node import — the
  `ChangeArtifact` it needs comes in as a **type-only** import, which tsc erases entirely (verified:
  `graph-node-id.ts`'s type import of `GraphNode` leaves no trace in `dist/graph-node-id.js`).
- **`ARTIFACT_SORT_MODES` is exported alongside them**, with the type derived from it. The web hook
  currently hand-maintains `const MODES: ArtifactSortMode[] = [...]` to validate a persisted
  preference — every consumer needs that same list, and TypeScript cannot catch one that is missing an
  entry (a subset still type-checks). Deriving the type from the constant makes the mismatch
  unrepresentable rather than merely tested.
- **No new subpath.** They ship through the existing `@spekjs/core/artifact-order`, which both current
  consumers already import. Every subpath is a permanent compatibility promise; this one buys nothing
  a second entry point would. **Subpath-only** — not re-exported from the package's main entry, which
  is how `DEFAULT_ORDER` and `defaultRank` already sit.
- `artifact-sort.test.ts` moves to core alongside it.
- `packages/web` imports from core and deletes its local copy. **No behavior change on any surface** —
  same function, same order, same three modes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `core-module`: add a requirement covering the artifact sort utility, mirroring the existing
  `Heading extraction utility` and `Graph node id parsing` requirements.

## Impact

**Code**

- `packages/core/src/artifact-order.ts` — gains `ARTIFACT_SORT_MODES`, `ArtifactSortMode` and `sortArtifacts`
- `packages/core/src/artifact-order.test.ts` — the moved tests (core has no test file for this module yet)
- `packages/core/README.md` — its "Subpath exports" section documents this subpath's exports by name
- `packages/web/src/utils/artifact-sort.ts` and `artifact-sort.test.ts` — deleted
- `packages/web/src/pages/ChangeDetail.tsx` — the only `sortArtifacts` call site; import changes, call
  site does not
- `packages/web/src/hooks/useArtifactSort.ts` — imports `ArtifactSortMode` from the same module and
  hand-maintains the runtime mode list; both come from core after this

**For whoever cuts the next release** (per CLAUDE.md, the bump is not decided inside a change): this
adds **new public exports** to an already-published subpath and removes nothing, so it is **additive —
minor, not patch**. Same class as core 1.3.0, which was under-bumpable by a `fix:` prefix rule. The
additions are **subpath-only** (`@spekjs/core/artifact-order`), not on the main entry — worth stating
precisely in the release notes, since the two are different promises.

**Not in scope**

- **Nothing in `packages/intellij` changes.** Its Kotlin `core/` mirrors scanning and artifact
  *discovery* (`ArtifactDiscovery.kt` reproduces core's mtime-plus-tiebreak discovery order), not this
  sort: it has no `ArtifactSortMode`, no alpha mode, and no preference. IntelliJ's ordering control is
  the same React SPA the web serves, so it consumes the moved function for free. The Kotlin copy of
  `DEFAULT_ORDER` predates this change and is unaffected by it.
- No change to `custom-schema-artifacts`: it specifies user-visible ordering behavior, which is
  untouched. This change moves where the rule lives, not what it does.
