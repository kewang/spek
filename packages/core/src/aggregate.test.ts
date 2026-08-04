import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { scanOpenSpecAggregated, buildGraphDataAggregated, pickActiveWinners } from "./scanner.js";
import type { WorktreeInfo } from "./types.js";

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
  });
}

function writeFile(p: string, content: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function commitAll(dir: string, msg: string): void {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", msg);
}

function initRepo(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  return dir;
}

function addActiveChange(repoDir: string, slug: string, specTopic?: string): void {
  const base = path.join(repoDir, "openspec", "changes", slug);
  writeFile(path.join(base, "proposal.md"), "## Why\ndemo\n");
  if (specTopic) {
    writeFile(path.join(base, "specs", specTopic, "spec.md"), "## ADDED Requirements\n");
  }
}

// 在指定目錄（worktree）為某 change 寫入 tasks.md，completed/total 決定勾選數，供 taskStats 斷言。
function writeTasks(dir: string, slug: string, completed: number, total: number): void {
  const lines = Array.from({ length: total }, (_, i) => `- [${i < completed ? "x" : " "}] task ${i}`);
  writeFile(path.join(dir, "openspec", "changes", slug, "tasks.md"), `## Tasks\n${lines.join("\n")}\n`);
}

// 主 repo（branch main）含 1 spec + 1 archived change；worktree A 帶 add-a（含 delta spec）；
// worktree B 帶 add-b（無 spec）。A、B 皆繼承主 repo 的 archived change。
function makeAggRepo(): string {
  const repo = initRepo("spek-agg-");
  writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
  writeFile(
    path.join(repo, "openspec", "changes", "archive", "2026-01-01-old", "proposal.md"),
    "## Why\n",
  );
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  addActiveChange(wtA, "add-a", "alpha");
  commitAll(wtA, "change a");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);
  addActiveChange(wtB, "add-b");
  commitAll(wtB, "change b");
  return repo;
}

test("scanOpenSpecAggregated: aggregates active changes across worktrees with source", async () => {
  const repo = makeAggRepo();
  const r = await scanOpenSpecAggregated(repo);
  assert.equal(r.aggregated, true);
  assert.equal(r.worktrees.length, 3);
  assert.deepEqual(r.activeChanges.map((c) => c.slug).sort(), ["add-a", "add-b"]);
  for (const c of r.activeChanges) {
    assert.ok(c.source, "every aggregated active change carries a source");
  }
  // specs 取主 worktree
  assert.deepEqual(r.specs.map((s) => s.topic), ["alpha"]);
});

test("scanOpenSpecAggregated: deduplicates archived changes by slug", async () => {
  const repo = makeAggRepo();
  const r = await scanOpenSpecAggregated(repo);
  // 2026-01-01-old 存在於主 repo 與兩個 worktree（繼承），去重後只剩一筆
  assert.equal(r.archivedChanges.filter((c) => c.slug === "2026-01-01-old").length, 1);
});

test("scanOpenSpecAggregated: when two worktrees both diverge on a slug, newest mtime wins the tiebreak", async () => {
  const repo = initRepo("spek-agg-dup-");
  writeFile(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  addActiveChange(wtA, "shared");
  writeTasks(wtA, "shared", 1, 2);
  commitAll(wtA, "a");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);
  addActiveChange(wtB, "shared");
  writeTasks(wtB, "shared", 2, 2);
  commitAll(wtB, "b");
  // 兩者皆確實分歧（各自 commit 了 shared）；tiebreak 才輪到 mtime。B 的副本給予明確較新的
  // mtime，模擬 B 才是目前正在編輯此 change 的 worktree。
  const past = new Date("2020-01-01T00:00:00Z");
  const future = new Date("2030-01-01T00:00:00Z");
  for (const f of ["proposal.md", "tasks.md"]) {
    fs.utimesSync(path.join(wtA, "openspec", "changes", "shared", f), past, past);
    fs.utimesSync(path.join(wtB, "openspec", "changes", "shared", f), future, future);
  }

  const r = await scanOpenSpecAggregated(repo);
  const shared = r.activeChanges.filter((c) => c.slug === "shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].source?.branch, "wb");
  assert.deepEqual(shared[0].taskStats, { total: 2, completed: 2 });
});

test("scanOpenSpecAggregated: a worktree that edits a change shadows main's copy of that slug", async () => {
  const repo = initRepo("spek-agg-shadow-");
  addActiveChange(repo, "shared");
  writeTasks(repo, "shared", 0, 2);
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  writeTasks(wtA, "shared", 2, 2); // wa 實際編輯（未提交分歧）

  const r = await scanOpenSpecAggregated(repo);
  const shared = r.activeChanges.filter((c) => c.slug === "shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].source?.isMain, false);
  assert.equal(shared[0].source?.branch, "wa");
  assert.deepEqual(shared[0].taskStats, { total: 2, completed: 2 });
});

test("scanOpenSpecAggregated: an idle fork created later does not roll back the editing worktree's progress", async () => {
  // main 有 change-a（基準 0/4）；wa 提交推進到 3/4；之後才建立 wb（繼承 0/4，從未編輯）。
  // wb 的 checkout mtime 較新，舊的 mtime 規則會讓 wb 勝出而回捲成 0/4；分歧選舉須讓 wa 以 3/4 勝出。
  const repo = initRepo("spek-agg-scenario1-");
  addActiveChange(repo, "change-a");
  writeTasks(repo, "change-a", 0, 4);
  commitAll(repo, "init change-a at 0/4");
  const wa = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wa);
  writeTasks(wa, "change-a", 3, 4);
  commitAll(wa, "advance change-a to 3/4");
  const wb = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wb);

  const r = await scanOpenSpecAggregated(repo);
  const changeA = r.activeChanges.filter((c) => c.slug === "change-a");
  assert.equal(changeA.length, 1);
  assert.equal(changeA[0].source?.branch, "wa");
  assert.deepEqual(changeA[0].taskStats, { total: 4, completed: 3 });
});

test("scanOpenSpecAggregated: main's uncommitted progress wins over an idle fork that inherited the baseline", async () => {
  // main 有 change-x（基準 0/4）；建立 wb 繼承 0/4；之後 main 把 change-x 編輯到 4/4 但未提交。
  // wb 繼承的副本 == main 的 HEAD、但 != main 工作區 → wb 未分歧 → main 以工作區的 4/4 勝出。
  const repo = initRepo("spek-agg-scenario2-");
  addActiveChange(repo, "change-x");
  writeTasks(repo, "change-x", 0, 4);
  commitAll(repo, "init change-x at 0/4");
  const wb = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wb);
  writeTasks(repo, "change-x", 4, 4); // main 編輯到 4/4，未提交

  const r = await scanOpenSpecAggregated(repo);
  const changeX = r.activeChanges.filter((c) => c.slug === "change-x");
  assert.equal(changeX.length, 1);
  assert.equal(changeX[0].source?.isMain, true);
  assert.deepEqual(changeX[0].taskStats, { total: 4, completed: 4 });
});

test("scanOpenSpecAggregated: main's committed advance wins over an idle fork that inherited the baseline", async () => {
  // main 有 change-x（基準 0/4）；建立 wb 繼承 0/4；之後 main 把 change-x 推進到 4/4 並「提交」。
  // wb 只是繼承、從未編輯 → 不因 main 自己的提交而分歧（三點 diff 對照 merge-base）→ main 以 4/4 勝出。
  const repo = initRepo("spek-agg-main-committed-");
  addActiveChange(repo, "change-x");
  writeTasks(repo, "change-x", 0, 4);
  commitAll(repo, "init change-x at 0/4");
  const wb = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wb); // inherits 0/4
  writeTasks(repo, "change-x", 4, 4);
  commitAll(repo, "main advances change-x to 4/4"); // COMMITTED, mainHead now != wb's head

  const r = await scanOpenSpecAggregated(repo);
  const changeX = r.activeChanges.filter((c) => c.slug === "change-x");
  assert.equal(changeX.length, 1);
  assert.equal(changeX[0].source?.isMain, true);
  assert.deepEqual(changeX[0].taskStats, { total: 4, completed: 4 });
});

// 建立「main 與 worktree 皆自 merge-base 推進同一 slug」的競賽場景；mainNewer 決定哪一方的副本 mtime 較新。
function bothAdvance(prefix: string, mainNewer: boolean): string {
  const repo = initRepo(prefix);
  addActiveChange(repo, "change-a");
  writeTasks(repo, "change-a", 0, 4);
  commitAll(repo, "fork point 0/4");
  const wa = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wa);
  writeTasks(wa, "change-a", 3, 4);
  commitAll(wa, "wa advances to 3/4"); // wa diverges past merge-base
  writeTasks(repo, "change-a", 4, 4);
  commitAll(repo, "main advances to 4/4"); // main diverges past merge-base too
  // 兩者皆真的推進 → mtime 是決勝訊號；此處確定性地設定較新者。
  const past = new Date("2020-01-01T00:00:00Z");
  const future = new Date("2030-01-01T00:00:00Z");
  const newer = mainNewer ? repo : wa;
  const older = mainNewer ? wa : repo;
  for (const f of ["proposal.md", "tasks.md"]) {
    fs.utimesSync(path.join(older, "openspec", "changes", "change-a", f), past, past);
    fs.utimesSync(path.join(newer, "openspec", "changes", "change-a", f), future, future);
  }
  return repo;
}

test("scanOpenSpecAggregated: both main and a worktree advance a slug — main can win on recency", async () => {
  // 兩邊都真的推進了 change-a；main 的副本較新 → main 勝出（B：main 不再被分歧 worktree 無條件擊敗）
  const repo = bothAdvance("spek-agg-both-main-", true);
  const r = await scanOpenSpecAggregated(repo);
  const c = r.activeChanges.filter((c) => c.slug === "change-a");
  assert.equal(c.length, 1);
  assert.equal(c[0].source?.isMain, true);
  assert.deepEqual(c[0].taskStats, { total: 4, completed: 4 });
});

test("scanOpenSpecAggregated: both main and a worktree advance a slug — worktree can win on recency", async () => {
  // 對稱情形：worktree 的副本較新 → worktree 勝出
  const repo = bothAdvance("spek-agg-both-wt-", false);
  const r = await scanOpenSpecAggregated(repo);
  const c = r.activeChanges.filter((c) => c.slug === "change-a");
  assert.equal(c.length, 1);
  assert.equal(c[0].source?.branch, "wa");
  assert.deepEqual(c[0].taskStats, { total: 4, completed: 3 });
});

test("scanOpenSpecAggregated: main's UNCOMMITTED advance competes in a live contest", async () => {
  // wa 提交推進 change-a（分歧，競賽成立）；main 對 change-a 有「未提交」編輯（也算推進）；main 副本較新
  // → main 勝。此路徑走只算一次的 main git status（mainUncommitted），與「idle fork」的無競賽情形不同。
  const repo = initRepo("spek-agg-main-uncommitted-contest-");
  addActiveChange(repo, "change-a");
  writeTasks(repo, "change-a", 0, 4);
  commitAll(repo, "fork 0/4");
  const wa = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wa);
  writeTasks(wa, "change-a", 3, 4);
  commitAll(wa, "wa advances to 3/4 (committed)"); // wa diverges (committed)
  writeTasks(repo, "change-a", 4, 4); // main advances 4/4, UNCOMMITTED → diverges via status
  const past = new Date("2020-01-01T00:00:00Z");
  const future = new Date("2030-01-01T00:00:00Z");
  for (const f of ["proposal.md", "tasks.md"]) {
    fs.utimesSync(path.join(wa, "openspec", "changes", "change-a", f), past, past);
    fs.utimesSync(path.join(repo, "openspec", "changes", "change-a", f), future, future);
  }

  const r = await scanOpenSpecAggregated(repo);
  const c = r.activeChanges.filter((c) => c.slug === "change-a");
  assert.equal(c.length, 1);
  assert.equal(c[0].source?.isMain, true);
  assert.deepEqual(c[0].taskStats, { total: 4, completed: 4 });
});

test("pickActiveWinners: a worktree whose divergence check fails does not shadow main", async () => {
  // 注入一個永遠回空集合的 divergence provider，模擬對該 worktree 的 git 指令失敗。
  // fork 持有 foo 但被判為未分歧 → main 保留 foo（不因 git 失敗而錯顯 fork 的繼承副本）。
  const mainWt: WorktreeInfo = { path: "/repo", branch: "main", head: "aaa", isMain: true, isBare: false, key: "m", vcs: "git" };
  const fork: WorktreeInfo = { path: "/repo-x", branch: "wx", head: "bbb", isMain: false, isBare: false, key: "x", vcs: "git" };
  const failing = async () => new Set<string>();

  const winners = await pickActiveWinners(
    [
      { wt: mainWt, slugs: ["foo"] },
      { wt: fork, slugs: ["foo"] },
    ],
    mainWt,
    failing,
  );
  assert.equal(winners.get("foo"), mainWt);
});

test("scanOpenSpecAggregated: active change absent from every worktree stays on main", async () => {
  // wtA 先分岔，之後才在主 repo 新增 main-only → wtA 的樹裡根本沒有這個 change 目錄
  const repo = initRepo("spek-agg-main-only-");
  writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  addActiveChange(wtA, "other");
  commitAll(wtA, "a");
  addActiveChange(repo, "main-only");
  writeTasks(repo, "main-only", 2, 3);
  commitAll(repo, "main change after fork");

  const r = await scanOpenSpecAggregated(repo);
  const mainOnly = r.activeChanges.filter((c) => c.slug === "main-only");
  assert.equal(mainOnly.length, 1);
  assert.equal(mainOnly[0].source?.isMain, true);
  assert.deepEqual(mainOnly[0].taskStats, { total: 3, completed: 2 });
});

test("scanOpenSpecAggregated: carries the main worktree's defaultSchema", async () => {
  // config.yaml 於建立 worktree 前 commit，故各 worktree 皆繼承同一份；聚合結果的
  // defaultSchema 取主 worktree（見 scanner），供 list badge 的隱藏基準。
  const repo = initRepo("spek-agg-schema-");
  writeFile(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  addActiveChange(wtA, "add-a");
  commitAll(wtA, "a");
  const r = await scanOpenSpecAggregated(repo);
  assert.equal(r.aggregated, true);
  assert.equal(r.defaultSchema, "spec-driven");
});

test("scanOpenSpecAggregated: each change carries its own worktree's defaultSchema", async () => {
  // 主 worktree 預設 spec-driven；worktree B 的 config.yaml 分歧為 agent-driven。
  // B 的 change 未宣告自己的 schema → 繼承 B 的預設；其 defaultSchema 必須是 B 的（agent-driven），
  // 而非主 worktree 的（spec-driven），否則 list badge 會對錯基準而誤顯示。
  // 自然建立順序：main-change 先於 fork 提交，wtB 繼承但從未編輯 → 分歧選舉讓 main-change 留在 main、
  // b-change 歸 wtB，兩者不因 dedup 合併（不需舊 mtime 規則下「先分岔」的 fixture 繞法）。
  const repo = initRepo("spek-agg-divergent-");
  writeFile(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  addActiveChange(repo, "main-change");
  commitAll(repo, "init with main-change");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);
  writeFile(path.join(wtB, "openspec", "config.yaml"), "schema: agent-driven\n");
  addActiveChange(wtB, "b-change");
  commitAll(wtB, "b diverge");

  const r = await scanOpenSpecAggregated(repo);
  const bChange = r.activeChanges.find((c) => c.slug === "b-change");
  const mainChange = r.activeChanges.find((c) => c.slug === "main-change");
  assert.ok(bChange);
  assert.ok(mainChange);
  // B 的 change：schema 與 defaultSchema 都是 B 的 agent-driven → badge 應隱藏（無誤報）
  assert.equal(bChange.schema, "agent-driven");
  assert.equal(bChange.defaultSchema, "agent-driven");
  // 主 worktree 的 change：defaultSchema 為 spec-driven
  assert.equal(mainChange.defaultSchema, "spec-driven");
  // 聚合結果的 header defaultSchema 仍取主 worktree
  assert.equal(r.defaultSchema, "spec-driven");
});

test("scanOpenSpecAggregated: single worktree falls back without source", async () => {
  const repo = initRepo("spek-agg-single-");
  addActiveChange(repo, "only-one");
  commitAll(repo, "init");
  const r = await scanOpenSpecAggregated(repo);
  assert.equal(r.aggregated, false);
  assert.equal(r.activeChanges.length, 1);
  assert.equal(r.activeChanges[0].source, undefined);
});

test("scanOpenSpecAggregated: aggregate=false scans only the given directory", async () => {
  const repo = makeAggRepo();
  const r = await scanOpenSpecAggregated(repo, { aggregate: false });
  assert.equal(r.aggregated, false);
  // 主 worktree 在 branch main，active changes 都在其他 worktree 的分支上
  assert.equal(r.activeChanges.length, 0);
});

test("buildGraphDataAggregated: namespaces change node ids by worktree", async () => {
  const repo = makeAggRepo();
  const g = await buildGraphDataAggregated(repo);
  const changeNodes = g.nodes.filter((n) => n.type === "change");
  // add-a 有 delta spec → 成為節點；add-b 無 spec → 不列入
  assert.equal(changeNodes.length, 1);
  assert.match(changeNodes[0].id, /^change:[0-9a-f]{8}:add-a$/);
  assert.ok(changeNodes[0].source);
  assert.ok(g.nodes.some((n) => n.id === "spec:alpha"));
});

test("buildGraphDataAggregated: deduplicates active change nodes shared with main", async () => {
  // add-foo 存在於主 repo（先 commit）與 wtA（分岔後繼承並實際編輯 → 分歧）→ 合併成一個節點，來源為 wtA
  const repo = initRepo("spek-agg-graph-dedup-");
  writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
  addActiveChange(repo, "add-foo", "alpha");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  writeFile(path.join(wtA, "openspec", "changes", "add-foo", "proposal.md"), "## Why\nedited in wa\n");

  const g = await buildGraphDataAggregated(repo);
  const changeNodes = g.nodes.filter((n) => n.type === "change");
  assert.equal(changeNodes.length, 1);
  assert.equal(changeNodes[0].source?.isMain, false);

  const changeEdges = g.edges.filter((e) => e.source === changeNodes[0].id);
  assert.equal(changeEdges.length, 1);
  const specNode = g.nodes.find((n) => n.id === "spec:alpha");
  assert.ok(specNode);
  assert.equal(specNode.historyCount, 1);
});

test("buildGraphDataAggregated: an inherited-but-untouched fork does not own the change node", async () => {
  // main 有 add-foo（含 delta spec）；wtB 分岔後繼承但從未編輯 → 節點歸 main，非 wtB；
  // 且與 list 路徑選出相同的勝出者（both via pickActiveWinners），historyCount 去重為 1。
  const repo = initRepo("spek-agg-graph-inherit-");
  writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
  addActiveChange(repo, "add-foo", "alpha");
  commitAll(repo, "init");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);

  const g = await buildGraphDataAggregated(repo);
  const changeNodes = g.nodes.filter((n) => n.type === "change");
  assert.equal(changeNodes.length, 1);
  assert.equal(changeNodes[0].source?.isMain, true);
  const changeEdges = g.edges.filter((e) => e.source === changeNodes[0].id);
  assert.equal(changeEdges.length, 1);
  const specNode = g.nodes.find((n) => n.id === "spec:alpha");
  assert.equal(specNode?.historyCount, 1);
});

test("buildGraphDataAggregated: graph election matches the list even when a slug's spec exists in only one worktree", async () => {
  // main 有 change-foo（無 delta spec）並推進到 4/4；wtA 繼承後才加了 delta spec 並推進到 3/4。
  // list 依 mtime 選 main（較新）。graph 的選舉輸入若只取「有 spec 的節點」會漏掉 main（它沒有節點）
  // → 誤把 change-foo 當成 wtA 擁有的節點。改以各 worktree 的 changes 目錄列出全部 active slug 後，
  // 兩條路徑選出相同勝出者：main 勝且無 spec → 圖上不出現 change-foo 節點。
  const repo = initRepo("spek-agg-graph-specless-");
  addActiveChange(repo, "change-foo"); // no spec
  writeTasks(repo, "change-foo", 0, 4);
  commitAll(repo, "fork: change-foo (no spec) 0/4");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  writeFile(
    path.join(wtA, "openspec", "changes", "change-foo", "specs", "alpha", "spec.md"),
    "## ADDED Requirements\n",
  );
  writeTasks(wtA, "change-foo", 3, 4);
  commitAll(wtA, "wa adds a delta spec + advances to 3/4");
  writeTasks(repo, "change-foo", 4, 4);
  commitAll(repo, "main advances to 4/4");
  // main 的副本較新 → 依 B 應由 main 勝出
  const past = new Date("2020-01-01T00:00:00Z");
  const future = new Date("2030-01-01T00:00:00Z");
  for (const f of ["proposal.md", "tasks.md", "specs/alpha/spec.md"]) {
    fs.utimesSync(path.join(wtA, "openspec", "changes", "change-foo", f), past, past);
  }
  for (const f of ["proposal.md", "tasks.md"]) {
    fs.utimesSync(path.join(repo, "openspec", "changes", "change-foo", f), future, future);
  }

  // list 選 main
  const list = await scanOpenSpecAggregated(repo);
  assert.equal(list.activeChanges.find((c) => c.slug === "change-foo")?.source?.isMain, true);

  // graph 必須一致：勝出者是 main（無 spec）→ 不得出現由落敗的 wtA 擁有的 change-foo 節點
  const g = await buildGraphDataAggregated(repo);
  const fooNodes = g.nodes.filter((n) => n.type === "change" && n.id.endsWith(":change-foo"));
  assert.equal(fooNodes.length, 0, "graph must not show change-foo owned by the losing worktree");
});
// --- jj workspace 聚合（與真實 jj 整合） ---

function jjAvailable(): boolean {
  try {
    execFileSync("jj", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
const HAS_JJ = jjAvailable();
const jjSkip = HAS_JJ ? false : "jj not installed";

function jj(cwd: string, ...args: string[]): void {
  execFileSync("jj", args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, JJ_CONFIG: "/dev/null" },
  });
}

// colocated git+jj repo（main 同時是 git main 與 jj default workspace）
function initColocated(prefix: string): string {
  const repo = initRepo(prefix);
  jj(repo, "git", "init", "--colocate");
  return repo;
}

test(
  "scanOpenSpecAggregated: surfaces a change from a jj-only workspace",
  { skip: jjSkip },
  async () => {
    const repo = initColocated("spek-agg-jj-");
    const ws = repo + "-jw";
    jj(repo, "workspace", "add", "--name", "feature", ws);
    addActiveChange(ws, "jj-only");
    jj(ws, "status"); // 觸發快照，讓 `@` 認得這個 change

    const r = await scanOpenSpecAggregated(repo);
    assert.equal(r.aggregated, true);
    assert.ok(r.worktrees.length >= 2);
    const jjChange = r.activeChanges.find((c) => c.slug === "jj-only");
    assert.ok(jjChange, "jj-only change is surfaced");
    assert.equal(jjChange.source?.vcs, "jj");
    assert.equal(jjChange.isCurrent, true); // `@` 正在編輯
  },
);

test(
  "scanOpenSpecAggregated: jj toggle off excludes jj-only workspace changes",
  { skip: jjSkip },
  async () => {
    const repo = initColocated("spek-agg-jj-off-");
    const ws = repo + "-jw";
    jj(repo, "workspace", "add", "--name", "feature", ws);
    addActiveChange(ws, "jj-only");
    jj(ws, "status");

    const r = await scanOpenSpecAggregated(repo, { includeJj: false });
    assert.ok(!r.activeChanges.some((c) => c.slug === "jj-only"));
  },
);

test(
  "scanOpenSpecAggregated: colocated main change is not double-counted across git+jj",
  { skip: jjSkip },
  async () => {
    const repo = initColocated("spek-agg-jj-dedup-");
    addActiveChange(repo, "on-main");
    commitAll(repo, "add change");

    const r = await scanOpenSpecAggregated(repo);
    // 唯一工作目錄（git main 與 jj default 去重成一筆）→ 走單目錄 fallback
    assert.equal(r.aggregated, false);
    assert.equal(r.activeChanges.filter((c) => c.slug === "on-main").length, 1);
  },
);

// 在 trunk 上提交一個 shared change，再開 n 個 workspace（皆繼承 trunk → 各自都有一份 shared）
function repoWithSharedChangeAndWorkspaces(prefix: string, names: string[]): string {
  const repo = initColocated(prefix);
  addActiveChange(repo, "shared");
  jj(repo, "describe", "-m", "add shared change");
  jj(repo, "new"); // 把含 shared 的 working copy 提交到 trunk，@ 前進到空 commit
  for (const n of names) jj(repo, "workspace", "add", "--name", n, repo + "-" + n);
  return repo;
}

test(
  "scanOpenSpecAggregated: a change shared across jj workspaces appears once",
  { skip: jjSkip },
  async () => {
    const repo = repoWithSharedChangeAndWorkspaces("spek-agg-jj-dup-", ["wa", "wb", "wc"]);
    const r = await scanOpenSpecAggregated(repo);
    assert.equal(r.worktrees.length, 4);
    // 4 個 workspace 各有一份相同的 shared，內容去重後只留一筆
    assert.equal(r.activeChanges.filter((c) => c.slug === "shared").length, 1);
  },
);

test(
  "scanOpenSpecAggregated: a divergent jj copy is kept and flagged conflictsWith",
  { skip: jjSkip },
  async () => {
    const repo = repoWithSharedChangeAndWorkspaces("spek-agg-jj-div-", ["wa", "wb"]);
    // wb 修改 shared 的內容 → 與基準分歧
    writeFile(
      path.join(repo + "-wb", "openspec", "changes", "shared", "proposal.md"),
      "## Why\nedited in wb\n",
    );
    jj(repo + "-wb", "status"); // 快照

    const r = await scanOpenSpecAggregated(repo);
    const shared = r.activeChanges.filter((c) => c.slug === "shared");
    // 基準一份 + wb 分歧版一份；wa 與基準相同被去重
    assert.equal(shared.length, 2);
    const base = shared.find((c) => !c.conflictsWith);
    const diverged = shared.find((c) => c.conflictsWith);
    assert.ok(base, "base copy present without conflict flag");
    assert.ok(diverged, "divergent copy present");
    assert.equal(diverged.conflictsWith, "main");
    assert.equal(diverged.source?.vcs, "jj");
    assert.equal(diverged.source?.branch, "wb");
  },
);

test(
  "scanOpenSpecAggregated: git-worktree election and jj content-dedup coexist without interfering",
  { skip: jjSkip },
  async () => {
    // 混合場景：colocated main + 一個 git worktree（分歧 change）+ 一個 jj workspace（jj-only change）。
    // 兩套去重機制必須各走各的：git worktree 走 git 分歧選舉、jj workspace 走內容指紋——jj workspace
    // 不得被餵進 git 選舉（其 head 是 jj change id），git worktree 也不得被內容指紋吞掉。
    const repo = initColocated("spek-agg-mixed-");
    writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
    addActiveChange(repo, "git-change", "alpha");
    commitAll(repo, "init");

    // git worktree：繼承 git-change 並實際編輯 → git 分歧選舉應讓 wtA（非 main）勝出
    const wtA = repo + "-a";
    git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
    writeFile(
      path.join(wtA, "openspec", "changes", "git-change", "proposal.md"),
      "## Why\nedited in wa\n",
    );

    // jj workspace：帶一個 jj-only change
    const jw = repo + "-jw";
    jj(repo, "workspace", "add", "--name", "feature", jw);
    addActiveChange(jw, "jj-only");
    jj(jw, "status"); // 快照，讓 `@` 認得 jj-only

    const r = await scanOpenSpecAggregated(repo);
    assert.equal(r.aggregated, true);

    // git 路徑：git-change 依分歧選舉去重成一筆，勝出者是實際編輯它的 git worktree（非 main）
    const gitChanges = r.activeChanges.filter((c) => c.slug === "git-change");
    assert.equal(gitChanges.length, 1, "git-change deduped once via divergence election");
    assert.equal(gitChanges[0].source?.vcs, "git");
    assert.equal(gitChanges[0].source?.isMain, false, "editing git worktree wins, not main");

    // jj 路徑：jj-only 照常浮現、標記為 jj 來源，未被 git 選舉吞掉
    const jjChanges = r.activeChanges.filter((c) => c.slug === "jj-only");
    assert.equal(jjChanges.length, 1, "jj-only surfaced via content-fingerprint path");
    assert.equal(jjChanges[0].source?.vcs, "jj");
  },
);
