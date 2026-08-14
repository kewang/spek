import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { setOpenspecRunner, type OpenspecRunner } from "./openspec-cli.js";
import {
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
// 這四個測試的呼叫都發生在第一次 resolve 之前，而它們用的 repoRoot 一定失敗 —— 失敗的結果現在
// resolve 後就被丟棄（見 openspec-cli.ts 的 ttlCached），所以它們釘的是「in-flight 共用」而不是
// 快取視窗本身。視窗由下面走成功路徑的分桶測試涵蓋。

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

// --- 失敗不進快取（issue #46）---
// 這裡改用注入的 runner，因為要驗的是「兩次讀之間環境變了」，而不是分桶。每個測試自帶一個不重複
// 的 repoRoot：provider 的快取是 module-level 且沒有清除入口，共用路徑會讓測試互相汙染。

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
  // 回報的情境逐字：第一次讀時 CLI 還連不上（桌面 app 啟動時才解析 PATH），修好之後的下一次讀就
  // 該拿到權威順序，而不是被同一個「不可用」服務到視窗結束。
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
  // 成功但沒有 planningArtifacts 也是一個答案 —— 與失敗共用 null 這個值，所以只能在呼叫端分辨。
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
  // 成功路徑的分桶：上面那組用的是失敗的 run，改完之後只剩 in-flight 共用的意義，快取視窗本身要
  // 由這個測試守著（issue #15）。
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
  // key 是 schema 級、argv 是 change 級：CLI 拒絕某一個 slug 的結果若被記住，同 schema 的其他
  // change 在整個視窗內都會被服務到那個拒絕。這是這個 change 順手修掉的第二個缺陷。
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
