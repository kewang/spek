## 1. Move the function into core

- [x] 1.1 `packages/core/src/artifact-order.ts`: add `sortArtifacts` below the existing `DEFAULT_ORDER` /
      `defaultRank`. Move the body verbatim — this change is a move, and any edit made in passing is one
      nobody reviewed as a behavior change
- [x] 1.2 Add the mode list and derive the type from it (design D6):
      `export const ARTIFACT_SORT_MODES = ["modified", "schema", "alpha"] as const` and
      `export type ArtifactSortMode = (typeof ARTIFACT_SORT_MODES)[number]`. **Not** a hand-written union
      beside a hand-written array — that pair type-checks while disagreeing
- [x] 1.3 `ChangeArtifact` comes in as `import type { ChangeArtifact } from "./types.js"`. **Type-only** —
      the module must stay node-free. (tsc erases type imports entirely: `graph-node-id.ts`'s type import
      of `GraphNode` leaves no trace in `dist/graph-node-id.js`. The guarantee is the erasure, not that
      `types.js` happens to be empty)
- [x] 1.4 Keep `modified` returning the input array rather than `[...artifacts]` — a move that quietly
      starts allocating is not a move. The spec states this as permission plus a no-mutation obligation
      on callers, **not** as a guarantee, so do not add a comment promising callers can rely on the
      identity (design D3)
- [x] 1.5 Update the file's header comment: it currently explains why the *constant* was lifted out of
      `artifacts.ts`. The file now owns the constant **and** the function that orders by it — which is
      what the comment claimed to be preventing duplication of in the first place
- [x] 1.6 **Do not add an exports subpath, and do not re-export from `index.ts`.**
      `packages/core/package.json` needs no change — both consumers already import
      `@spekjs/core/artifact-order`. Confirm by reading the `exports` block rather than assuming.
      Staying off the main entry matches `DEFAULT_ORDER` / `defaultRank`, which are subpath-only today
      (design D1)

## 2. Move and complete the tests

- [x] 2.1 `packages/web/src/utils/artifact-sort.test.ts` → `packages/core/src/artifact-order.test.ts`.
      Imports become `./artifact-order.js` and `import type { ChangeArtifact } from "./types.js"`
      (no cross-package import). All nine existing cases move unchanged
- [x] 2.2 Rename `modified: does not mutate or reorder` to say what it asserts. It does **two** things —
      `assert.equal(out, arts)` (identity) and order preservation. Identity is now explicitly *not* a
      guarantee (design D3), so keep the assertion as a lock on current behavior but name the case for
      the order 〔scenario "Last-modified mode preserves the input order"〕
- [x] 2.3 **Add** the fallback case the suite is missing: input `[tasks, specs, design, proposal]`
      (recency order — the artifact written last is first), `schemaOrder` absent, expect
      `["proposal", "design", "specs", "tasks"]`
      〔scenario "Schema order unavailable falls back to narrative order"〕.
      **The two existing cases do not carry it**: `:55` has no `design` and does not lead with `tasks`,
      `:61` has only two artifacts and passes `[]` rather than nothing. Both pass today against an
      implementation that merely *reverses* the input — this case is what distinguishes narrative order
      from "not the input order"
- [x] 2.4 **Add**: the set is unchanged in all three modes — same ids in, same ids out, input array
      unmodified for `alpha` and `schema` 〔scenario "The set of artifacts is never changed"〕.
      The existing `:67` checks non-mutation for `schema` only
- [x] 2.5 **Add**: `ARTIFACT_SORT_MODES` contains all three modes and `sortArtifacts` accepts each
      〔scenario "The mode list matches the type"〕
- [x] 2.6 **Strengthen** the alpha tiebreak case (`:30-38`). It asserts only that forward and reversed
      inputs agree — which does show *a* tiebreak exists, but passes just as well if the tiebreak were
      `kind`. Assert the actual id order 〔scenario "Two artifacts sharing a display title"〕
- [x] 2.7 **Add** direct cases for `DEFAULT_ORDER` and `defaultRank` (the constant's value; `+Infinity`
      for an unknown id). They have **no test file of their own today** — covered only indirectly through
      `artifacts.test.ts` — and this change is what gives them one
- [x] 2.8 The remaining five moved cases carry the rest and need no edit: `orders by schemaOrder`
      〔"Schema order applied"〕, `absent from schemaOrder are appended…` 〔"covering only some
      artifacts"〕 whose comment states its own discriminating power, the `apple` / `zebra` ids inside the
      `null` case 〔"Artifacts outside the narrative order"〕, `alpha: sorts by display title`
      〔"Alphabetical mode orders by title"〕, and `schema: does not mutate the input array` (subsumed by
      2.4 but kept — it is the narrower, faster-failing assertion)

## 3. Point web at core

- [x] 3.1 `packages/web/src/pages/ChangeDetail.tsx:17` — import `sortArtifacts` and `ArtifactSortMode`
      from `@spekjs/core/artifact-order`. The call site at `:162` does not change
- [x] 3.2 `packages/web/src/hooks/useArtifactSort.ts:2` — same import move; and replace the local
      `const MODES` at `:5` with `ARTIFACT_SORT_MODES` from core. **This file is why 3.1 alone does not
      compile** — it is the module's second consumer
- [x] 3.3 Delete `packages/web/src/utils/artifact-sort.ts` and `artifact-sort.test.ts`. No compatibility
      re-export (design D7)
- [x] 3.4 `git grep -n "utils/artifact-sort"` returns nothing. **Match the import path, not the string
      `artifact-sort`** — `useArtifactSort.ts:4` holds `const STORAGE_KEY = "spek:artifact-sort"`, which
      this change deliberately does not touch (design D2), so a bare substring gate can never pass.
      `git grep` also keeps the gitignored webview bundles out of the result

## 4. Docs

- [x] 4.1 `packages/core/README.md` — its "Subpath exports" section lists this subpath's exports by name
      (`DEFAULT_ORDER`, `defaultRank`); add the three new ones. This README ships **inside the npm
      tarball**, so it is package API documentation, not the release-time product README: its reader has
      the new export in hand the moment they read it

## 5. Gates

- [x] 5.1 **`npm run build:core` first.** Core's package entry is `dist/`, so web imports the *built*
      copy — running the web tests before rebuilding exercises the previous build and passes, which reads
      as "the move is fine" when web never saw it (CLAUDE.md names this trap)
- [x] 5.2 `npm test` (core + ui + web)
- [x] 5.3 `npm run type-check` — covers the new test file via core's `tsconfig.test.json`
      (`include: ["src"]`, no exclude), while the build config's `exclude: ["src/**/*.test.ts"]` keeps it
      out of the published `dist/`. Confirm both rather than assume
- [x] 5.4 `npm run lint`
- [x] 5.5 `npm run dev`, open a change detail, switch through all three ordering modes, then **reload the
      page** and confirm the mode persisted. Pure-move changes are exactly the ones where a wrong import
      passes every gate and only the screen shows it — and the reload is what exercises 3.2's
      `ARTIFACT_SORT_MODES` swap, which no unit test covers end to end.
      Verified by hand: all three modes order correctly and the choice survives a reload
- [x] 5.6 Automated substitutes for the parts of 5.5 that do not need a browser: `npm run build`
      (a production build resolves every import for real, unlike a dev server answering 200 for
      `index.html`), then execute the **compiled** `packages/core/dist/artifact-order.js` directly and
      confirm: no `import` statements in the emitted file (node-free holds — the type import erased),
      all three modes present, `schema` with no order overturning a recency-ordered input, `schema` with
      an authoritative order following it, and `modified` returning the same array instance
