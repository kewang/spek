## 1. The memoiser (`packages/core/src/openspec-cli.ts`)

- [x] 1.1 Add `CliOutcome<T>` with the `answered(value)` / `failed(value)` constructors, and change `ttlCached`'s compute to return `Promise<CliOutcome<T>>` while `ttlCached` still resolves to `T`. The parameter is required — no default that means "remember" — and none of the three names is added to `index.ts` or to `exports`, so the package's public surface is unchanged
- [x] 1.2 Add `isTransient(reason: SchemaDegradedReason)` beside the taxonomy: true for `cli-unavailable` and `cli-timeout`, false for `cli-failed` and `cli-unparsable`. One rule for both stores and both languages, rather than each listing reasons of its own
- [x] 1.3 Install the entry while the computation is in flight, exactly as today — freshness check and `CACHE_MAX` eviction unchanged — and drop it after it resolves to a failure, guarding the delete with an identity check (`store.get(key) === entry`) so a fresher entry installed since is not discarded
- [x] 1.4 Drop the entry when the computation rejects, and make sure the internal handler chain leaves no unhandled rejection of its own
- [x] 1.5 State the policy on `ttlCached`: what makes an outcome an answer, why the judgement belongs to the caller, why a failure that would repeat is still remembered, and why the entry exists while in flight. Update the `Stryker disable all` note at the top of the file, which justifies itself by this module being a thin spawn wrapper — it now holds the policy

## 2. Core call sites

- [x] 2.1 `schema-order.ts`: `answered(parseOrderFromStatus(cli.json))` when the run succeeded — including when it yields `null`, which is the CLI reporting no order — and `failed(null)` for every unsuccessful run, regardless of reason. Comment why the reason split does **not** apply here: the key names a schema while the argv names a change, so a refusal may not be the bucket's to keep
- [x] 2.2 `schemas.ts` catalog: `failed` when `degradedReason` is transient, `answered` otherwise — including a degraded catalog whose CLI ran and answered unusably
- [x] 2.3 `schemas.ts` definition: `readSchemaUncached` returns the `CliOutcome` itself, marking only the `schema.yaml`-could-not-be-read path as failed. The four `not-found` returns are one value by the time `readSchema` reaches the cache, so the call site cannot make this judgement. It is internal (`index.ts` exports `readSchema`, not the uncached form) and what the caller is told is unchanged
- [x] 2.4 Update the comments this makes false: `schema-order.ts`'s "The CLI's failure taxonomy is deliberately discarded here" and its cache note, `schemas.ts`'s "why failures must not be remembered forever"

## 3. Core tests

- [x] 3.1 New `openspec-cli.test.ts` for `ttlCached`: an answered outcome computes once; a failed one computes again on the next read; a rejection computes again; two callers arriving on a cold key share one run even when it fails
- [x] 3.2 `schema-order.test.ts`: through `setOpenspecRunner`, a failing runner followed by a succeeding one yields the order on the second read — issue #46 verbatim — and a successful run reporting no order stays cached
- [x] 3.3 `schema-order.test.ts`: add a success-path bucketing test beside the existing ones, which assert Promise identity against a failing run and from now on pin in-flight sharing rather than the cache window. Note that narrowing where they sit
- [x] 3.4 `schemas.test.ts`: a catalog degraded by an unreachable CLI is re-read on the next request while one degraded by an unusable answer is not; a `not-found` definition the CLI answered is served from cache, while one whose `schema.yaml` could not be read is re-read

## 4. Kotlin parity (`packages/intellij`)

- [x] 4.1 `OpenspecCli.kt`: `TtlCache.Outcome<V>` with the same two constructors, entries holding `FutureTask<Outcome<V>>`, and removal — by the thread that installed the entry, via two-arg `remove` — when the outcome is not worth remembering. A compute that **throws** produces no outcome to inspect, so the removal belongs in a `try`/`finally` around the run, not in a check on its result
- [x] 4.2 Give `SchemaOrder` a CLI seam mirroring `SchemaCatalog`'s `internal var cliRunner`. It calls `OpenspecCli.run` directly today and no test reaches it, so without this both 4.3 and its tests are unwritable
- [x] 4.3 `SchemaOrder.kt`: every unsuccessful run becomes `failed(null)`, matching 2.1. Move the unsafe-slug allowlist refusal **above** `getOrCompute` rather than marking it failed inside — it spawns nothing, so there is no run to share, and inside the cache a concurrent read of a legitimate change in the same bucket would join it and be handed the refusal. `scanner.ts`'s empty-slug guard sits outside the provider for the same reason
- [x] 4.4 `SchemaCatalog.kt`: mirror 2.2 and 2.3, including `isTransient` over the same reasons and the four-way `not-found` judgement inside the read
- [x] 4.5 Update the Kotlin comments this makes false: `SchemaOrder.kt`'s "「已查過、但沒有權威順序」也必須是可快取的結果" and its policy list, `OpenspecCli.kt`'s note on why the entry wraps a nullable value, `SchemaCatalog.kt`'s copy of the "not forever" rationale
- [x] 4.6 Kotlin tests mirroring 3.1–3.4. The signature change moves all eight `TtlCacheTest` cases, not only `a null result is cacheable` — that one is re-framed rather than deleted: a null *answer* is still cacheable, which is what it always tested; a null *failure* is not. Add a `SchemaOrderTest` case for the unsafe-slug guard, the one path here that is a security boundary

## 5. Gates and verification

- [x] 5.1 `npm run build:core` before running the web tests, so they exercise this change rather than the previous build
- [x] 5.2 `npm run type-check`, `npm run lint`, `npm test`
- [x] 5.3 `./gradlew test` in `packages/intellij`
- [x] 5.4 Reproduce the reported symptom by hand and confirm it is gone: open a change with `openspec` off `PATH`, restore `PATH`, reopen the change within 30s, and see the authoritative order rather than "Schema order unavailable"
- [x] 5.5 Confirm the other half by hand: with a CLI that exits non-zero, the Schemas page refetching on watcher events spawns one process, not one per refetch
