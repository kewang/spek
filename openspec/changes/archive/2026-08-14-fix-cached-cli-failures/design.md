## Context

`ttlCached` (`packages/core/src/openspec-cli.ts`) memoises every answer spek gets from the `openspec`
CLI, holding the **Promise** rather than the resolved value so concurrent callers share one run. Three
stores use it: the schema-order authority (`schema-order.ts`), the schema catalog and the schema
definitions (`schemas.ts`). `TtlCache` in `OpenspecCli.kt` is the same design written a second time for
the IntelliJ host, and `intellij-embedded-server` already requires it to follow core's caching rules.

The memoiser cannot currently tell an answer from a failure, because nothing tells it. What each caller
hands back is a value either way:

| Caller | Failure looks like | An *answer* that looks the same |
|---|---|---|
| `schema-order.ts` | `null` (`!cli.ok`, or a parse that produced nothing) | `null` — the CLI ran and reported no order |
| `schemas.ts` catalog | `{ …, degradedReason: "cli-unavailable" }` | `degradedReason: null` |
| `schemas.ts` definition | `{ ok: false, reason: "not-found" }` — from a `schema.yaml` that could not be read | `{ ok: false, reason: "not-found" }` — the CLI reported no such schema |

Two of these are the same problem: **values that mean different things and cannot be told apart at the
point where the cache is consulted**. Anything that judges cacheability from the value alone fails on
both, and the definition path is the worse of the two — `readSchemaUncached` returns `not-found` from
four places, one of which is `fs.readFileSync` throwing.

The other half of the classification is *which failures are worth retrying at all*. `!cli.ok` collapses
four reasons, and they do not behave alike:

| reason | cause | does a second read plausibly differ? |
|---|---|---|
| `cli-unavailable` | ENOENT / spawn threw | yes — this is issue #46 |
| `cli-timeout` | the 10s budget fired | yes — load eases |
| `cli-failed` | non-zero exit, no JSON body | no — a CLI too old for a command it still marks experimental, a broken install |
| `cli-unparsable` | exit 0, output that is not JSON | no — a wrapper printing a banner, a shape change |

The costs are not alike either. Measured on this machine: a missing binary fails at spawn in ~5ms, while
a CLI that runs and exits non-zero takes ~0.65s and a successful enumeration ~1.2s. So the two rows that
never change between reads are also the two expensive ones — and the schema views refetch on every
debounced watcher event, which under an editor's autosave is about one per second.

The 30s TTL is itself the fix for the older form of this bug — the cache used to remember failures
forever, so installing `openspec` afterwards never took effect. `CLI_CACHE_TTL_MS` must stay ≥
`CLI_TIMEOUT_MS` (`cli-budget.ts`), a constraint about *successful* entries that this change does not
touch.

## Goals / Non-Goals

**Goals:**

- A failure whose cause the next read could find gone is not remembered: that read retries.
- A failure that would repeat identically is remembered, so nothing pays a process start to be told the
  same thing.
- The judgement is made by whichever function still holds the distinction, and stated there.
- Concurrent callers still share one run, including when that run fails.
- TypeScript and Kotlin keep saying the same thing, at the same layer.

**Non-Goals:**

- Letting the *consumer* distinguish a failure from an absence (issue #46's third suggestion). It
  changes the exported `SchemaOrderProvider` type — a minor bump on `@spekjs/core` with an edge for
  external consumers — and deserves deciding on its own.
- A shorter negative TTL. It would bound the repeat cost of failures with a second duration to explain
  and keep aligned with the first; classifying by reason bounds the same cost by not repeating the calls
  that cannot come out differently, which is a rule rather than a number.
- Changing what any failure is *reported* as. `readSchemaUncached` reporting `not-found` for a file it
  could not read is arguably wrong, but it is a separate defect about wording, not about memory.
- Changing what any surface *displays*. "Schema order unavailable" stays the wording; the change is that
  it stops outliving its cause.
- A cache-clearing entry point for schema-order on the TypeScript side. It has none today, and this
  change removes the reason anyone wanted one.

## Decisions

### The compute returns its outcome plus whether to remember it

`ttlCached` takes a compute that resolves to a small wrapper, and returns the unwrapped value:

```ts
export interface CliOutcome<T> { value: T; remember: boolean }
export const answered = <T>(value: T): CliOutcome<T> => ({ value, remember: true });
export const failed = <T>(value: T): CliOutcome<T> => ({ value, remember: false });

export function ttlCached<T>(
  store: Map<string, CacheEntry<T>>,
  key: string,
  compute: () => Promise<CliOutcome<T>>,
): Promise<T>;
```

At the call sites it reads as the sentence it is:

```ts
// schema-order.ts — the two nulls finally say different things
const cli = await runOpenspec(["status", "--change", slug, "--json"], repoRoot);
if (!cli.ok) return failed(null);
return answered(parseOrderFromStatus(cli.json));

// schemas.ts — the catalog's degradation names its own reason, so the split reads off it
const catalog = await listSchemasUncached(repoRoot);
return catalog.degradedReason && isTransient(catalog.degradedReason)
  ? failed(catalog)
  : answered(catalog);
```

The parameter is **required**, not an option defaulting to "remember". Every existing call site is one
that got this wrong; a default would let the next one get it wrong silently, which is the shape of the
original bug. `ttlCached` is internal — not exported from the package index, not in `exports` — so
requiring it costs nothing outside the module.

*Alternatives considered.* A predicate — `ttlCached(store, key, compute, isCacheable)` — is smaller, but
it can only read the value, and schema-order's two nulls are indistinguishable there; making it work
would mean widening the cached type purely so a predicate can re-derive a judgement the compute already
made. Throwing on failure would reuse promise rejection as the signal, but failures are *values*
throughout this codebase (`CliResult`, `degradedReason`, `SchemaReadResult`), and a degraded catalog is
still the thing the caller returns and the page displays — turning it into an exception inverts the
design to save a field.

### Which failures are forgotten is decided by the reason, stated once

`isTransient(reason)` — true for `cli-unavailable` and `cli-timeout`, false for `cli-failed` and
`cli-unparsable` — lives beside the reasons themselves in `openspec-cli.ts`, so both languages' callers
and both stores read one rule rather than each listing reasons of their own. Its name says what it
decides: whether a second read could plausibly come out differently.

The temptation is to call every failure transient, because the reported one is. It is not: the two rows
that repeat identically are also the two that cost a full Node start, and the schema views re-read on
every debounced watcher event. Forgetting those would replace a 30-second wrong answer with a permanent
~1s tax on a machine whose CLI simply does not speak the command — a worse trade than the bug, and one
that never stops. `SchemaDegradedReason` is the type the rule reads, so a reason added later must be
placed on one side of it or the compiler is the one that notices.

### The definition path decides where the distinction still exists

`readSchemaUncached` returns `not-found` from four places: an unsafe name (the CLI is never consulted),
the CLI answering that no such schema resolves, a resolution missing its fields — and a `schema.yaml`
that **could not be read**, which is `fs.readFileSync` throwing on a file being rewritten or on a
permission error. By the time `readSchema` reaches the cache, those four are one value, which is the same
"two nulls" argument one function further out.

So this call site does not classify: `readSchemaUncached` returns the `CliOutcome` itself, marking only
that fourth path as failed. It is internal — `index.ts` exports `readSchema`, not the uncached form — so
the signature change reaches nothing outside the package. What the caller is *told* does not change; only
whether it is remembered.

### schema-order forgets every unsuccessful consultation — for a reason of its own

The reason split above is about the environment. schema-order has a second, sharper reason not to
remember anything but an answer: **its key names a schema while its argv names a change**
(`${repoRoot}::${schema}`, `status --change <slug>`). Any outcome that could depend on the change is
therefore wrong for the rest of the bucket, and a non-zero exit is exactly such an outcome — the CLI
refusing that one slug. Today that refusal is served to every other change sharing the schema for the
rest of the window. So here the rule is the blunt one, and the comment must say why: not because the
failure is transient, but because it may not be the bucket's to keep.

### The entry is installed while in flight and dropped on the way out

Sharing the run is the whole reason the cache holds a Promise, and it must keep working for a failing
run — otherwise "don't cache failures" quietly becomes "don't dedupe them", and a host with no
`openspec` on `PATH` spawns one process per concurrent read.

So the entry is installed exactly as today, and removed *after* it resolves, if it resolved to a failure:

```ts
const outcome = compute();
const promise = outcome.then((o) => o.value);
const entry = { at: Date.now(), promise };
store.set(key, entry);
const forget = () => { if (store.get(key) === entry) store.delete(key); };
outcome.then((o) => { if (!o.remember) forget(); }, forget);
return promise;
```

The sketch omits the freshness check and the `CACHE_MAX` eviction that already surround this; both stay
exactly as they are. Two details in what is shown are load-bearing. The identity check
(`store.get(key) === entry`) means a fresher entry installed since is not deleted — the same reason
Kotlin's `TtlCache` already uses two-arg `remove`. And a **rejected** compute is forgotten too: today a
thrown error is cached for the full 30s and every caller in the window gets the same rejection, which is
the reported bug with an exception in place of a null.

### Kotlin says the same thing in its own idiom

`TtlCache.getOrCompute` takes a compute returning `TtlCache.Outcome<V>` with the same two constructors,
holds `FutureTask<Outcome<V>>`, and — on the thread that installed the entry, the only one that runs
it — removes the entry when the outcome is not worth remembering or when the task threw. The throwing
case needs a `try`/`finally` around the run, not a check on its result: a compute that throws never
produces one, and skipping the removal there rebuilds the exact bug in the one path nothing tests.

One Kotlin-only correction comes with it, and it is **not** a `failed(null)`. `SchemaOrder`'s allowlist
rejection of an unsafe slug (a Windows argument-injection boundary, deliberately absent on the TS side)
currently returns `null` from *inside* `getOrCompute`, into a cache keyed by `${repoRoot}::${schema}` —
a slug-specific refusal installed under a schema-wide key. Marking it not-worth-remembering would still
leave a concurrent read of a legitimate change joining that entry in flight and getting the refusal.
It spawns nothing, so there is no run to share and nothing to dedupe: the guard belongs **above** the
cache, returning before `getOrCompute` is reached. `scanner.ts`'s empty-slug guard sits outside the
provider for exactly this reason, and says so.

### What the tests must pin

The behavior is a *second* read, so every test is a pair of reads with a stub that changes its answer
between them — which is precisely the shape of the reported failure (a `PATH` fixed between two reads).

- `ttlCached`, in a new `openspec-cli.test.ts`: a remembered outcome computes once; a failed one computes
  again; a rejection computes again; two concurrent callers on a cold key still share one run even when
  it fails.
- `schema-order.ts`, through `setOpenspecRunner`: a failing runner then a succeeding one, back to back,
  yields the order on the second read — the issue, verbatim. And the answer that is *not* a failure —
  the CLI running fine with no order to report — is still cached.
- `schemas.ts`: a catalog degraded by an unreachable CLI is retried, one degraded by an unusable answer
  is not; `not-found` for a name the CLI reports no schema for is remembered, while a `schema.yaml` that
  could not be read is re-read.
- Kotlin: the mirror of each, and the whole of `TtlCacheTest` moves with the signature — all eight cases,
  not only `a null result is cacheable`. That one is re-framed rather than deleted: a null *answer* is
  still cacheable, which is what it was always testing, and a null *failure* is not.
- Kotlin needs a seam before any of this can be written. `SchemaCatalog` has one (`internal var
  cliRunner`); `SchemaOrder.cli` calls `OpenspecCli.run` directly and no test reaches it — so the
  unsafe-slug guard, the one change here that touches a security boundary, would otherwise ship untested.

The existing schema-order bucketing tests assert cache-hit by Promise identity against a nonexistent
repo, i.e. against a failing run. They keep passing, because the calls are made before the first
resolves, but they now pin **in-flight sharing** rather than the cache window — worth a note where they
sit, and worth one success-path bucketing test beside them so the window itself stays covered.

## Risks / Trade-offs

- **An unreachable CLI now costs one spawn per read instead of one per window.** → In-flight sharing
  bounds only *concurrent* readers, and the reads that produce this bug are sequential — a change opened,
  then another; a page refetching on each watcher event — so the honest bound is one spawn per read. What
  actually bounds the cost is the reason split: the failure this leaves uncached is the unreachable CLI,
  which fails at spawn in ~5ms, while the ~0.65–1.3s failures are the ones now remembered. The remaining
  exposure is a CLI that times out on every read, at 10s each, and a host in that state has a problem the
  cache was hiding rather than solving.
- **`scripts/build-demo.ts` reads every change in a loop** — the one caller that reads N changes at once.
  With an unreachable CLI that is N spawns rather than one. At ~5ms each on a repo's worth of changes it
  is not worth a mechanism, but it is the number to check if the demo build ever slows down.
- **Two languages, one policy, and the second copy is where it drifts.** → The mechanism is a required
  parameter in both, so a call site cannot omit the judgement and inherit the old behavior; and the
  Kotlin tests mirror the TS ones case for case.
- **A caller could label a genuine answer `failed` and quietly lose caching.** → It is visible at the
  call site rather than hidden in the helper, and each of the four sites is covered by a test that
  fails if its judgement flips.

## Open Questions

- Whether the schema-order provider should eventually resolve `{ order, reason }` so consumers can tell
  "queried, there is none" from "the query failed" (issue #46's third suggestion). Deferred here; this
  change removes the reported symptom without touching the exported type, so that decision stays open
  rather than being made by accident.
