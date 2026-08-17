import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { setOpenspecRunner, type OpenspecRunner } from "./openspec-cli.js";
import {
  clearSchemaOrderSettlements,
  cliSchemaOrderProvider,
  parseOrderFromStatus,
  resolveSchemaOrder,
  type SchemaArtifactRef,
} from "./schema-order.js";

// 模擬 `openspec status --change <slug> --json` 的輸出
function statusJson(order: string[], paths: Record<string, string>): unknown {
  return {
    actionContext: { planningArtifacts: order },
    artifactPaths: Object.fromEntries(
      Object.entries(paths).map(([id, outputPath]) => [id, { outputPath }]),
    ),
  };
}

test("parseOrderFromStatus: extracts ordered id/outputPath pairs", () => {
  const refs = parseOrderFromStatus(
    statusJson(
      ["brainstorm", "proposal", "specs", "plan"],
      {
        brainstorm: "brainstorm.md",
        proposal: "proposal.md",
        specs: "specs/**/*.md",
        plan: "plan.md",
      },
    ),
  );
  assert.deepEqual(refs, [
    { id: "brainstorm", outputPath: "brainstorm.md" },
    { id: "proposal", outputPath: "proposal.md" },
    { id: "specs", outputPath: "specs/**/*.md" },
    { id: "plan", outputPath: "plan.md" },
  ]);
});

test("parseOrderFromStatus: preserves planningArtifacts order exactly", () => {
  const refs = parseOrderFromStatus(
    statusJson(["tasks", "proposal"], { proposal: "proposal.md", tasks: "tasks.md" }),
  );
  assert.deepEqual(refs!.map((r) => r.id), ["tasks", "proposal"]);
});

test("parseOrderFromStatus: skips ids that have no outputPath", () => {
  const refs = parseOrderFromStatus(
    statusJson(["proposal", "ghost"], { proposal: "proposal.md" }),
  );
  assert.deepEqual(refs, [{ id: "proposal", outputPath: "proposal.md" }]);
});

test("parseOrderFromStatus: non-string ids are ignored", () => {
  const refs = parseOrderFromStatus({
    actionContext: { planningArtifacts: ["proposal", 42, null] },
    artifactPaths: { proposal: { outputPath: "proposal.md" } },
  });
  assert.deepEqual(refs, [{ id: "proposal", outputPath: "proposal.md" }]);
});

test("parseOrderFromStatus: a numeric id is rejected even if its string form is a path key", () => {
  const refs = parseOrderFromStatus({
    actionContext: { planningArtifacts: [42] },
    artifactPaths: { "42": { outputPath: "foo.md" } },
  });
  assert.equal(refs, null);
});

test("parseOrderFromStatus: non-string outputPath is skipped", () => {
  const refs = parseOrderFromStatus({
    actionContext: { planningArtifacts: ["proposal"] },
    artifactPaths: { proposal: { outputPath: 123 } },
  });
  assert.equal(refs, null);
});

test("parseOrderFromStatus: returns null when nothing resolves", () => {
  assert.equal(parseOrderFromStatus(statusJson([], {})), null);
  assert.equal(parseOrderFromStatus(statusJson(["x"], {})), null);
});

test("parseOrderFromStatus: returns null for malformed shapes", () => {
  assert.equal(parseOrderFromStatus(null), null);
  assert.equal(parseOrderFromStatus(undefined), null);
  assert.equal(parseOrderFromStatus("nope"), null);
  assert.equal(parseOrderFromStatus(42), null);
  assert.equal(parseOrderFromStatus({}), null);
  assert.equal(parseOrderFromStatus({ actionContext: { planningArtifacts: "x" }, artifactPaths: {} }), null);
  assert.equal(parseOrderFromStatus({ actionContext: { planningArtifacts: ["a"] } }), null);
});

// --- resolveSchemaOrder ---

function refs(...pairs: [string, string][]): SchemaArtifactRef[] {
  return pairs.map(([id, outputPath]) => ({ id, outputPath }));
}

test("resolveSchemaOrder: maps literal filenames to ids, preserving order", () => {
  const order = resolveSchemaOrder(
    refs(["brainstorm", "brainstorm.md"], ["proposal", "proposal.md"], ["plan", "plan.md"]),
    ["proposal", "plan", "brainstorm"],
  );
  assert.deepEqual(order, ["brainstorm", "proposal", "plan"]);
});

test("resolveSchemaOrder: specs glob maps to the specs artifact", () => {
  const order = resolveSchemaOrder(
    refs(["specs", "specs/**/*.md"], ["proposal", "proposal.md"]),
    ["proposal", "specs"],
  );
  assert.deepEqual(order, ["specs", "proposal"]);
});

test("resolveSchemaOrder: literal specs/<topic>/spec.md maps to the specs artifact", () => {
  const order = resolveSchemaOrder(refs(["specs", "specs/foo/spec.md"]), ["specs"]);
  assert.deepEqual(order, ["specs"]);
});

test("resolveSchemaOrder: a non-specs glob does not map", () => {
  const order = resolveSchemaOrder(refs(["anything", "*.md"]), ["proposal", "specs"]);
  assert.equal(order, null);
});

test("resolveSchemaOrder: a spec.md literal NOT under a specs path does not map", () => {
  const order = resolveSchemaOrder(refs(["weird", "docs/spec.md"]), ["specs"]);
  assert.equal(order, null);
});

test("resolveSchemaOrder: outputPath is trimmed before matching", () => {
  const order = resolveSchemaOrder(refs(["design", "  design.md  "]), ["design"]);
  assert.deepEqual(order, ["design"]);
});

test("resolveSchemaOrder: refs pointing at unknown ids are skipped", () => {
  const order = resolveSchemaOrder(
    refs(["ghost", "ghost.md"], ["proposal", "proposal.md"]),
    ["proposal"],
  );
  assert.deepEqual(order, ["proposal"]);
});

test("resolveSchemaOrder: two refs mapping to the same id do not duplicate it", () => {
  const order = resolveSchemaOrder(
    refs(["specs", "specs/**/*.md"], ["specs-again", "specs/foo/spec.md"]),
    ["specs"],
  );
  assert.deepEqual(order, ["specs"]);
});

test("resolveSchemaOrder: null refs yields null", () => {
  assert.equal(resolveSchemaOrder(null, ["proposal"]), null);
});

test("resolveSchemaOrder: no matches yields null", () => {
  assert.equal(resolveSchemaOrder(refs(["ghost", "ghost.md"]), ["proposal"]), null);
});

// --- cliSchemaOrderProvider cache bucketing ---
// 分桶以 Promise 物件同一性驗證：cache hit 回傳同一個 Promise 參照（provider「存 Promise、
// 順帶去重併發呼叫」的設計），即同一桶只 spawn 一次。用不存在的 repoRoot，spawn 立即以 error
// 收斂為 null，不觸發真正的 ~1.25s CLI 啟動。
//
// All four calls happen before the first resolve, and the repoRoot they use always fails — a failure
// is dropped once it resolves (see `ttlCached` in openspec-cli.ts), so what these pin is the
// **in-flight** share, not the cache window itself. The window is covered by the success-path
// bucketing test further down.

function noRepo(suffix: string): string {
  return path.join(os.tmpdir(), `spek-nonexistent-${suffix}`);
}

test("cliSchemaOrderProvider: changes sharing a schema reuse one spawn (identical promise)", async () => {
  const root = noRepo("shared-schema");
  const a = cliSchemaOrderProvider(root, "add-foo", "spec-driven");
  const b = cliSchemaOrderProvider(root, "add-bar", "spec-driven");
  assert.equal(a, b); // 同一 Promise 參照 → 第二個 change 未再 spawn
  await Promise.allSettled([a, b]);
});

test("cliSchemaOrderProvider: different schemas are spawned separately", async () => {
  const root = noRepo("diff-schema");
  const a = cliSchemaOrderProvider(root, "add-foo", "spec-driven");
  const b = cliSchemaOrderProvider(root, "add-foo", "agent-driven");
  assert.notEqual(a, b);
  await Promise.allSettled([a, b]);
});

test("cliSchemaOrderProvider: two schema-less (null) changes share one spawn — the repo default bucket", async () => {
  // 本地無 schema 的 change 都由 CLI 解析出同一 repo 級預設順序，故正確地共用一個桶（每 repo 一次 spawn）
  const root = noRepo("null-schema");
  const a = cliSchemaOrderProvider(root, "add-foo", null);
  const b = cliSchemaOrderProvider(root, "add-bar", null);
  assert.equal(a, b); // 同一 Promise → 兩個 schema-less change 只 spawn 一次
  await Promise.allSettled([a, b]);
});

test("cliSchemaOrderProvider: null and empty-string schema share the same default bucket", async () => {
  const root = noRepo("null-empty");
  const a = cliSchemaOrderProvider(root, "add-foo", null);
  const b = cliSchemaOrderProvider(root, "add-bar", "");
  assert.equal(a, b); // "" 與 null 都折進預設桶
  await Promise.allSettled([a, b]);
});

// --- A failure is not held as an answer (issue #46) ---
// These use an injected runner, because what they check is the environment changing *between* two
// reads rather than bucketing. Each carries its own repoRoot: the provider's caches are module-level,
// so a shared path lets one test pollute the next.

function useRunner(r: OpenspecRunner): void {
  const prev = setOpenspecRunner(r);
  if (restoreRunner === null) restoreRunner = prev;
}

let restoreRunner: OpenspecRunner | null = null;

test.afterEach(() => {
  if (restoreRunner) setOpenspecRunner(restoreRunner);
  restoreRunner = null;
});

test("cliSchemaOrderProvider: a failed consultation is retried on the next read", async () => {
  // The reported case, verbatim: the CLI is not reachable on the first read (a desktop app resolving
  // PATH at startup), and the read after it is repaired must get the authoritative order rather than
  // being served the same "unavailable" until the window closes.
  const root = noRepo("retry-after-failure");
  let calls = 0;
  useRunner(async () => {
    calls += 1;
    return calls === 1
      ? { ok: false, reason: "cli-unavailable" }
      : { ok: true, json: statusJson(["proposal", "tasks"], { proposal: "proposal.md", tasks: "tasks.md" }) };
  });

  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  const second = await cliSchemaOrderProvider(root, "add-foo", "spec-driven");
  assert.deepEqual(second?.map((r) => r.id), ["proposal", "tasks"]);
  assert.equal(calls, 2);
});

test("cliSchemaOrderProvider: a successful run reporting no order is cached", async () => {
  // A success with no planningArtifacts is an answer too — it shares the value null with a failure,
  // so the two can only be told apart where the CLI was consulted.
  const root = noRepo("cached-empty-answer");
  let calls = 0;
  useRunner(async () => {
    calls += 1;
    return { ok: true, json: {} };
  });

  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.equal(await cliSchemaOrderProvider(root, "add-bar", "spec-driven"), null);
  assert.equal(calls, 1);
});

test("cliSchemaOrderProvider: two changes sharing a schema spawn once when the CLI answers", async () => {
  // Bucketing on the success path: the group above runs against failures, which since the fix pin
  // only the in-flight share, so the cache window itself is guarded here (issue #15).
  const root = noRepo("shared-schema-success");
  let calls = 0;
  useRunner(async () => {
    calls += 1;
    return { ok: true, json: statusJson(["proposal"], { proposal: "proposal.md" }) };
  });

  const first = await cliSchemaOrderProvider(root, "add-foo", "spec-driven");
  const second = await cliSchemaOrderProvider(root, "add-bar", "spec-driven");
  assert.deepEqual(first?.map((r) => r.id), ["proposal"]);
  assert.deepEqual(second?.map((r) => r.id), ["proposal"]);
  assert.equal(calls, 1);
});

test("cliSchemaOrderProvider: one change's refusal does not deny the order to the rest of its schema", async () => {
  // The key is schema-level while the argv is change-level: held in the bucket, the CLI's refusal of
  // one slug would be served to every other change sharing that schema for the whole window. It is
  // remembered against the refused change instead — which is what the next test pins.
  const root = noRepo("refusal-not-shared");
  const calls: string[] = [];
  useRunner(async (args) => {
    const slug = args[args.indexOf("--change") + 1];
    calls.push(slug);
    return slug === "odd-one"
      ? { ok: false, reason: "cli-failed" }
      : { ok: true, json: statusJson(["proposal"], { proposal: "proposal.md" }) };
  });

  assert.equal(await cliSchemaOrderProvider(root, "odd-one", "spec-driven"), null);
  const sibling = await cliSchemaOrderProvider(root, "add-foo", "spec-driven");
  assert.deepEqual(sibling?.map((r) => r.id), ["proposal"]);
  assert.deepEqual(calls, ["odd-one", "add-foo"]);
});

// --- A settled change is remembered against itself ---

test("cliSchemaOrderProvider: a settled refusal is not consulted again on the next read", async () => {
  // An installation that cannot answer at all — one too old for `status --change --json` — exits
  // non-zero for every slug. Dropping that outcome entirely cost a full process start (~0.65-1.3s)
  // on every change-detail read and on every watcher-driven refetch, forever.
  const root = noRepo("settled-not-respawned");
  let calls = 0;
  useRunner(async () => {
    calls += 1;
    return { ok: false, reason: "cli-failed" };
  });

  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.equal(calls, 1);
});

test("cliSchemaOrderProvider: a settled change is still served its schema's cached answer", async () => {
  // The order is a property of the **schema**. Once a sibling has fetched it, it is this change's
  // too — so the mark replaces a consultation, never an answer. Read the other way round, this is
  // the regression the mark must not introduce: before it, the refused change was served the
  // sibling's answer for free, and a mark consulted ahead of the bucket would hand back null.
  const root = noRepo("settled-still-served");
  const calls: string[] = [];
  useRunner(async (args) => {
    const slug = args[args.indexOf("--change") + 1];
    calls.push(slug);
    return slug === "odd-one"
      ? { ok: false, reason: "cli-failed" }
      : { ok: true, json: statusJson(["proposal"], { proposal: "proposal.md" }) };
  });

  assert.equal(await cliSchemaOrderProvider(root, "odd-one", "spec-driven"), null);
  await cliSchemaOrderProvider(root, "add-foo", "spec-driven");
  const again = await cliSchemaOrderProvider(root, "odd-one", "spec-driven");
  assert.deepEqual(again?.map((r) => r.id), ["proposal"]);
  assert.deepEqual(calls, ["odd-one", "add-foo"]);
});

test("cliSchemaOrderProvider: an unreadable response settles the change, and is not the schema's answer", async () => {
  // Exit 0 with output that will not parse. `runOpenspec` classifies it as `cli-unparsable` before the
  // extractor ever sees it, so it never reaches this caller as "the CLI reported no order" — the mistake
  // the Kotlin side made, where one function did both jobs and collapsed the two into the same null.
  //
  // The Kotlin counterpart is `an unreadable body settles the change rather than answering for the schema`.
  // The pair is the whole of "each host asserts the classification for the same documented responses": there
  // is no shared fixture, so what keeps them honest is that each asserts the same two consequences.
  const root = noRepo("unparsable-settles");
  const calls: string[] = [];
  useRunner(async (args) => {
    calls.push(args[args.indexOf("--change") + 1]);
    return { ok: false, reason: "cli-unparsable" };
  });

  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  // Not the schema's answer: a sibling still gets its own consultation...
  assert.equal(await cliSchemaOrderProvider(root, "add-bar", "spec-driven"), null);
  // ...while the change it was about is not consulted a second time.
  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.deepEqual(calls, ["add-foo", "add-bar"]);
});

test("cliSchemaOrderProvider: clearing settlements makes the next read consult again", async () => {
  // No TypeScript host invalidates the schema-order cache today — the bucket is bounded by its TTL alone —
  // so this is the seam a host would clear on, and the one the Kotlin side already drives from its resync
  // route and file watcher. Untested, an exported clear is a promise nothing keeps.
  const root = noRepo("settlements-cleared");
  let calls = 0;
  useRunner(async () => {
    calls += 1;
    return { ok: false, reason: "cli-failed" };
  });

  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.equal(calls, 1);

  clearSchemaOrderSettlements();
  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.equal(calls, 2, "a settlement survived clearSchemaOrderSettlements");
});

test("cliSchemaOrderProvider: a transient failure marks nothing", async () => {
  // `isTransient` is the one rule, and it decides this too: an absent binary and a timeout are what a
  // running host repairs by itself, so neither is held anywhere.
  const root = noRepo("transient-unmarked");
  let calls = 0;
  useRunner(async () => {
    calls += 1;
    return { ok: false, reason: "cli-timeout" };
  });

  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.equal(await cliSchemaOrderProvider(root, "add-foo", "spec-driven"), null);
  assert.equal(calls, 2);
});

test("cliSchemaOrderProvider: a reader joining another change's consultation is not marked", async () => {
  // Joining an in-flight run is required — otherwise not remembering a failure would also mean not
  // deduping one. So the mark is written inside `compute`, the only place holding the slug the argv
  // actually named: marked by whoever awaits the provider instead, the joiner would take the run's
  // null and record a settlement against a change the CLI was never asked about.
  const root = noRepo("joiner-unmarked");
  const calls: string[] = [];
  let release: (() => void) | null = null;
  const started = new Promise<void>((resolve) => {
    release = resolve;
  });
  useRunner(async (args) => {
    const slug = args[args.indexOf("--change") + 1];
    calls.push(slug);
    if (calls.length === 1) {
      release?.();
      return { ok: false, reason: "cli-failed" };
    }
    return { ok: true, json: statusJson(["proposal"], { proposal: "proposal.md" }) };
  });

  const first = cliSchemaOrderProvider(root, "odd-one", "spec-driven");
  await started;
  const joiner = cliSchemaOrderProvider(root, "add-foo", "spec-driven");
  assert.equal(await first, null);
  assert.equal(await joiner, null); // joined the run about odd-one, so it got that run's outcome

  // add-foo was never consulted, so nothing about it was settled: its next read consults.
  const afterwards = await cliSchemaOrderProvider(root, "add-foo", "spec-driven");
  assert.deepEqual(afterwards?.map((r) => r.id), ["proposal"]);
  assert.deepEqual(calls, ["odd-one", "add-foo"]);
});
