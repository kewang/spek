## 1. Schema-order failure memory (TypeScript)

- [x] 1.1 Add a non-installing lookup beside `ttlCached` in `packages/core/src/openspec-cli.ts` that reports whether a key holds a current entry, without creating one; export `CACHE_MAX` alongside `CACHE_TTL_MS` so the memo shares the cap rather than restating it
- [x] 1.2 Add a per-change settlement memo in `packages/core/src/schema-order.ts`, keyed by repo root and slug under a prefix that cannot collide with a bucket key (the bucket's NUL sentinel exists for that reason), sharing the cache's TTL and size cap
- [x] 1.3 Order the provider: a current bucket entry is served first (a settled change still gets its schema's answer), then a live mark returns null without consulting the CLI or installing a bucket entry, then consult
- [x] 1.4 Write the mark **inside** the `compute` callback, the only place holding both the failure's reason and the slug the argv named, so a reader that joined another change's run never marks itself
- [x] 1.5 Mark only when `isTransient(reason)` is false, so `cli-unavailable` / `cli-timeout` remain remembered nowhere; keep `failed(null)` for the bucket in every unsuccessful case
- [x] 1.6 State the rule where the code reads — why a settlement is kept against the change, why the bucket is consulted first, why the mark is read outside `ttlCached` but written inside `compute` — and correct the existing comment claiming every unsuccessful run is forgotten
- [x] 1.7 Cover it in `packages/core/src/schema-order.test.ts`: a settled failure is not re-spawned on the next read; a transient one still is; a settled change is served a sibling's cached answer without consulting; a settled change does not deny a sibling its own consultation; a reader joining another change's run is not marked
- [x] 1.8 `npm run build:core` before running the web suite, so the web package tests the built copy
- [x] 1.9 Assert the classification pair on this side too: an unreadable response settles the change and is not cached as the schema's answer (the counterpart to the Kotlin test), and `clearSchemaOrderSettlements` makes the next read consult again

## 2. Schema-order response classification (Kotlin)

- [x] 2.1 In `packages/intellij/src/main/kotlin/com/spek/intellij/core/SchemaOrder.kt`, make the readability boundary `parseToJsonElement` succeeding and nothing more — a parsed root that is not an object, or an object without the fields, is a **readable response with no order**, matching TypeScript, whose boundary is `JSON.parse` alone
- [x] 2.2 Map `OpenspecCli.Outcome` to a `SchemaDegradedReason` at the call site (`StartFailed` → `CLI_UNAVAILABLE`, `TimedOut` → `CLI_TIMEOUT`, non-zero exit → `CLI_FAILED`, exit 0 with an unreadable body → `CLI_UNPARSABLE`), since nothing produces one there today and `isTransient` has no caller to apply it
- [x] 2.3 Route an unreadable body to `TtlCache.Outcome.failed` and a readable-but-orderless body to `answered`
- [x] 2.4 Mirror the per-change mark from task 1, applied outside `getOrCompute` for the reason the slug allowlist already sits there, and written where the reason and the slug are both held
- [x] 2.5 Clear the mark from `SchemaOrder.clearCache()`, which `SpekCaches` already drives from both the resync route and the file watcher — `intellij-embedded-server` requires resync to invalidate the schema-order cache and forbids a manual Refresh invalidating less than an automatic one
- [x] 2.6 Rewrite `SchemaOrderTest.kt`'s `assertNull(parseOrderFromStatus("not json"))` — it changes meaning under the split and must move to the classification boundary rather than be supplemented; add tests for both classifications, for a parsed non-object body, for the mark, and for `clearCache` clearing it

## 3. `@spekjs/ui` colour contract documentation

- [x] 3.1 In `packages/ui/README.md`: state nine members, add the `--spek-node-active` row, and correct every row that no longer describes what the components draw with it — `--spek-border` (no longer the graph's edges), `--spek-bg-primary` (the surface the graph is mounted on, drawn behind node labels; a host mounting the graph elsewhere maps it to that surface), `--spek-text-muted` (also graph edges and archived nodes), `--spek-accent` (also spec nodes)
- [x] 3.2 Delete or rewrite the README's claim that the graph's node colours "are the visualization's own palette, not theme colours, and are fixed" — they resolve from `--spek-accent` / `--spek-node-active` / `--spek-text-muted`, so as written it tells a re-theming host the opposite of the contract
- [x] 3.3 Correct the stale member count and descriptions in `packages/ui/src/theme.ts`, `packages/ui/src/styles.css` and `packages/ui/src/index.ts`
- [x] 3.4 Correct the count in the host-side mapping block in `packages/web/src/styles/global.css`
- [x] 3.5 Guard the README against the drift that shipped: a test asserting every contract member is named in the documentation the published package carries (membership only — a wrong *description* is still beyond what a test can see)

## 4. Graph label paint order

- [x] 4.1 Move node labels out of each node's group into a single labels layer appended after the nodes layer in `packages/ui/src/SpecGraph.tsx`
- [x] 4.2 Apply the hover de-emphasis to the labels selection in both the `mouseenter` and `mouseleave` handlers — it is written as `nodeSel.attr("opacity", …)` today and reaches the labels only because they are inside the node's group; `graph-view` requires non-connected nodes to dim and records label-at-full-strength as the rejected alternative
- [x] 4.3 Position the labels selection from the same tick handler; keep `pointer-events: none` so hover and drag stay with the nodes
- [x] 4.4 Assert the drawing order in `packages/ui`'s suite as a source-level check — the repo has no DOM environment in any package and `packages/ui`'s only suite parses source text, so the overlap geometry itself is covered by task 8.3, not by a test
- [x] 4.5 Assert the labels layer takes no pointer events, bounded by the statement rather than a character count

## 5. Contrast guards

- [x] 5.1 In `packages/ui/src/__tests__/contract.test.ts`, let a member carry every strength it is drawn at with the floor that use answers to: `--spek-text-muted` at 0.85 (edges, archived node fill) as well as full strength, and `--spek-accent` at full strength against **4.5:1** (the timeline's *today* label is text) as well as at 0.85 against 3:1. `packages/web/src/styles/contrast.test.ts`'s `SPEK_MARKS` is already this shape — copy it, do not change it
- [x] 5.2 In `packages/web/src/styles/contrast.test.ts`, add `border-<token>/<alpha>` to the mechanism scan, and state with the scan which mechanisms it enumerates and which it does not
- [x] 5.3 Stop a token's membership in `SURFACES` from accounting for its occurrences: measure a surface token applied as text on a solid fill, starting with `bg-accent text-bg-primary` and its hover state (both pass today — 6.78:1 / 9.12:1 and 8.66:1 / 6.15:1 — so this adds an assertion, not a re-colouring)
- [x] 5.4 Resolve all five occurrences the widened scan surfaces — the jj conflict badge's `border-status-warning/40` and four `border-accent/40` (`DefaultSchemaBadge`, `TimelinePage`, `SchemaFlow`, the second badge in `ChangeList`) — each measured or declared with its reason; the conflict badge is declared decoration, its text naming the state

## 6. Comment language

- [x] 6.1 Correct `openspec/config.yaml`'s `context` block: the `Conventions` line states English comments to match `CLAUDE.md`, and the `Purpose` line is English like the rest of the committed artifact
- [x] 6.2 Translate the Chinese comments added by v1.14.0 in `packages/ui/src/SpecGraph.tsx`, `packages/intellij/.../core/SchemaOrder.kt` and `packages/core/src/schema-order.test.ts`
- [x] 6.3 While in `SpecGraph.tsx`, correct the comment above the node fills claiming those colours are "the visualization's own palette, not the host's theme colours" — the same false statement as task 3.2, one level in

## 7. Documentation of master's implementation

- [x] 7.1 Update `CLAUDE.md` where it states the schema-order cache forgets every unsuccessful run, the colour-contract member count, the contrast guard's three bypass mechanisms, and that IntelliJ's resync clears the schema-order cache (there is a second store after this change)
- [x] 7.2 Update `docs/prd.md` if any statement there is affected

## 8. Gates

- [x] 8.1 `npm run type-check`, `npm run lint`, `npm test`
- [x] 8.2 `./gradlew test` in `packages/intellij`
- [x] 8.3 Verify the graph in a real browser in both themes — label overlap and hover dimming are geometry and paint, and nothing in the repo can assert them
