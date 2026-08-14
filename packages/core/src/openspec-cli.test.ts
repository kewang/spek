import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answered,
  failed,
  isTransient,
  ttlCached,
  type CacheEntry,
  type CliOutcome,
} from "./openspec-cli.js";

/**
 * `ttlCached` holds the one rule the whole CLI layer shares: an answer is remembered for the cache
 * lifetime, a failure the next read could find gone is not. Every test here is therefore a *pair* of
 * reads — the shape of the reported bug, where a host repaired its `PATH` between two of them and
 * kept being served the first one's failure (issue #46).
 */

function store<T>(): Map<string, CacheEntry<T>> {
  return new Map<string, CacheEntry<T>>();
}

/** A compute that counts its runs and returns whatever the caller lines up for each one. */
function counted<T>(...outcomes: CliOutcome<T>[]): { compute: () => Promise<CliOutcome<T>>; runs: () => number } {
  let runs = 0;
  return {
    compute: async () => {
      const outcome = outcomes[Math.min(runs, outcomes.length - 1)];
      runs += 1;
      return outcome;
    },
    runs: () => runs,
  };
}

test("an answer is computed once and served from the cache after that", async () => {
  const s = store<string>();
  const { compute, runs } = counted(answered("order"));

  assert.equal(await ttlCached(s, "k", compute), "order");
  assert.equal(await ttlCached(s, "k", compute), "order");
  assert.equal(runs(), 1);
});

test("a null answer is still an answer", async () => {
  // The distinction the value cannot carry: `parseOrderFromStatus` returning null means the CLI
  // answered and there is no order. Caching that is the point of classifying at the call site.
  const s = store<string | null>();
  const { compute, runs } = counted<string | null>(answered(null));

  assert.equal(await ttlCached(s, "k", compute), null);
  assert.equal(await ttlCached(s, "k", compute), null);
  assert.equal(runs(), 1);
});

test("a failure is not remembered, so the next read retries", async () => {
  const s = store<string | null>();
  const { compute, runs } = counted<string | null>(failed(null), answered("order"));

  assert.equal(await ttlCached(s, "k", compute), null);
  // Issue #46 verbatim: the environment is repaired between the two reads, and the second sees it
  // rather than being served the first one's failure for the rest of the 30s window.
  assert.equal(await ttlCached(s, "k", compute), "order");
  assert.equal(runs(), 2);
});

test("a failure leaves nothing behind for a later answer to be checked against", async () => {
  // A failed entry that lingered would also make the *third* read a hit on stale data. Reading a
  // third time pins that the answer installed by read two is the one being cached.
  const s = store<string | null>();
  const { compute, runs } = counted<string | null>(failed(null), answered("order"));

  await ttlCached(s, "k", compute);
  await ttlCached(s, "k", compute);
  assert.equal(await ttlCached(s, "k", compute), "order");
  assert.equal(runs(), 2);
});

test("a rejection is not remembered either", async () => {
  // Today's bug with an exception in place of a value: held for the lifetime, every caller in the
  // window gets the same error even after its cause is gone.
  const s = store<string>();
  let runs = 0;
  const compute = async (): Promise<CliOutcome<string>> => {
    runs += 1;
    if (runs === 1) throw new Error("boom");
    return answered("order");
  };

  await assert.rejects(() => ttlCached(s, "k", compute), /boom/);
  assert.equal(await ttlCached(s, "k", compute), "order");
  assert.equal(runs, 2);
});

test("callers arriving mid-flight share the run, even one that fails", async () => {
  // Not remembering a failure must not become not deduping one: on a host with no `openspec` on
  // PATH, every concurrent reader would otherwise spawn its own process.
  const s = store<string | null>();
  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const compute = async (): Promise<CliOutcome<string | null>> => {
    runs += 1;
    await gate;
    return failed(null);
  };

  const first = ttlCached(s, "k", compute);
  const second = ttlCached(s, "k", compute);
  assert.equal(first, second, "the second caller started its own run instead of joining");
  release();
  assert.deepEqual(await Promise.all([first, second]), [null, null]);
  assert.equal(runs, 1);

  // …and the shared entry is gone once it resolves, so the next reader is not handed it.
  assert.equal(s.has("k"), false);
});

test("keys do not share an entry", async () => {
  const s = store<string>();
  assert.equal(await ttlCached(s, "a", async () => answered("a")), "a");
  assert.equal(await ttlCached(s, "b", async () => answered("b")), "b");
  assert.equal(s.size, 2);
});

test("a late failure does not delete an entry installed since", async () => {
  // The identity check. Without it, a slow failing run evicts whatever a later caller cached under
  // the same key — turning one failure into a permanently cold entry.
  const s = store<string | null>();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const slow = ttlCached(s, "k", async () => {
    await gate;
    return failed(null);
  });
  s.delete("k"); // stand in for the eviction paths that drop an entry mid-flight
  const fresh = await ttlCached(s, "k", async () => answered("order"));

  release();
  await slow;
  assert.equal(fresh, "order");
  assert.equal(s.get("k") !== undefined, true, "the late failure deleted a newer entry");
});

test("isTransient splits the taxonomy by whether a second read could differ", () => {
  assert.equal(isTransient("cli-unavailable"), true);
  assert.equal(isTransient("cli-timeout"), true);
  // The CLI ran and answered; re-asking spawns a process to be told the same thing.
  assert.equal(isTransient("cli-failed"), false);
  assert.equal(isTransient("cli-unparsable"), false);
});
