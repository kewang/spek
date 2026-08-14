## Why

Every answer spek gets from the `openspec` CLI goes through one memoiser, `ttlCached`, and it remembers a
failure on exactly the same terms as an answer: 30 seconds. Among the failures it remembers that way are
the ones a running host repairs by itself — the CLI not resolvable *yet*, the 10s timeout firing under
load. So one bad moment becomes half a minute of wrong answers, and nothing tells the reader the answer
is stale rather than settled.

Reported from outside the repo (issue #46): `spekterm`, an Electron consumer of `@spekjs/core`, resolves
the user's interactive-shell `PATH` at startup because a desktop-launched app inherits none. Reads landing
before that finishes get `null` — and keep getting `null` for 30s *after* `PATH` is fixed. For a user
that is: open a change right after launch, see "schema order unavailable", reopen it for the next half
minute and see the same thing. It also makes any test of "the authoritative order was used" flaky by
construction — the same assertion was red in one launch mode and green in the other, on the same commit.

The cache's own history is this lesson one order of magnitude apart: it used to remember failures
*forever*, so installing `openspec` afterwards never took effect. The TTL fixed the permanent case and
left the half-minute one.

## What Changes

- **A CLI failure the next read could resolve is not remembered.** The next read retries; a successful
  answer is cached as it is today. This covers all three stores that share the memoiser — the
  schema-order authority (`schema-order.ts`), the schema catalog and the schema definitions
  (`schemas.ts`) — because the policy is a property of the memoiser, not of any one caller.
- **Not every failure qualifies, and the difference is stated.** A CLI that was never reached or was cut
  short says nothing about the answer and is routinely fixed within seconds. A CLI that ran and answered
  unusably — a non-zero exit with no body, output that cannot be parsed — is reporting the installation
  itself, which the next read a second later will find identical. Retrying that on every read buys
  nothing and costs a full process start each time (measured: ~0.65–1.3s against ~5ms for a missing
  binary). Only the first kind is forgotten.
- **The memoiser is told what a failure is; it does not guess.** `null` from the schema-order provider
  conflates "the query failed" with "the CLI answered and there is no order" — the second is a real
  answer and stays cached. The same collapse happens again on the schema-definition path, where
  "no schema by that name" and "that schema's file could not be read" arrive as one value. So the
  decision belongs to whichever function still holds the distinction, expressed there rather than
  inferred downstream from the value's shape.
- **In-flight sharing is unchanged.** Concurrent callers still share one run; the entry is dropped only
  once it resolves as a failure. Without that, "don't cache failures" would also mean "don't dedupe
  them", and a page that reads several changes at once would spawn a CLI per read on a machine where the
  CLI is missing — the spawn storm the cache exists to prevent.
- **The Kotlin side moves with it.** `TtlCache` in `OpenspecCli.kt` is the same policy written a second
  time, and `intellij-embedded-server` already requires the Kotlin implementation to follow core's
  caching rules. A fix applied to one language only would leave the two hosts disagreeing about how long
  a failure lasts.

Deliberately **not** in this change: giving the caller a reason with the null (issue #46's third
suggestion). It changes the exported `SchemaOrderProvider` type, so it is a minor bump on `@spekjs/core`
with a real edge for external consumers, and it is worth deciding on its own — the negative-caching fix
already removes the reported symptom.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `core-module`: adds the policy — a cached CLI answer and a cached CLI *failure* are not the same thing.
  The module already states the CLI's timing budget once; this states, once, what that budget applies to.
- `custom-schema-artifacts`: its "Schema-order authority is cached per schema" requirement is silent on
  what happens when the authority cannot be reached, which is how a momentary failure came to be as
  durable as an answer. Adds the observable behavior: an unsuccessful consultation is retried on the
  next read, and one change's refusal stops being served to the rest of its schema.
- `schema-browsing`: same for the catalog and definition caches — its caching requirement states a bounded
  lifetime and in-flight sharing, but not that a degraded enumeration is held for that full lifetime.

The Kotlin side needs no delta of its own. `custom-schema-artifacts` and `core-module` are written about
the behavior, not about one host, and `intellij-embedded-server`'s parity clause — which is scoped to the
schemas endpoints, not to schema-order — carries the catalog half explicitly.

A second defect falls out of the same fix, worth naming because it is not what was reported: the
schema-order cache is keyed by **schema** while the query names a **change**, so today a change the CLI
refuses denies the authoritative order to every other change sharing its schema for the rest of the
window. Not remembering that outcome ends the cross-change part of it.

## Impact

- **`packages/core/src/openspec-cli.ts`** — `ttlCached` gains a way for the caller to say an outcome is
  not worth remembering, and the eviction that follows a failed resolve.
- **`packages/core/src/schema-order.ts`** — distinguishes a failed `runOpenspec` from a successful run
  with no order to report.
- **`packages/core/src/schemas.ts`** — a catalog degraded because the CLI could not be reached is a
  failure; one degraded because the CLI answered unusably is remembered. The definition path needs the
  judgement made inside `readSchemaUncached`, which is the last place that still knows which of its four
  `not-found` returns came from a file it could not read.
- **`packages/intellij/src/main/kotlin/com/spek/intellij/core/OpenspecCli.kt`** (`TtlCache`) and its two
  callers, `SchemaOrder.kt` / `SchemaCatalog.kt`.
- **Behavioral cost**: on a machine where the CLI cannot be reached, reads that used to be answered from
  a cached failure now spawn one process each. In-flight sharing bounds only *concurrent* readers, and
  the reads that produce this bug are sequential, so the honest bound is one spawn per read — at ~5ms for
  a missing binary, which is the case that matters, and never for the failures that repeat identically.
- **`@spekjs/core` is published**, so this ships on its own version line. No exported type changes, no
  new export: the behavior change is that a cached failure no longer outlives its cause. For whoever cuts
  the release, that is the note the CHANGELOG needs — a consumer that worked around the old behavior can
  stop.
