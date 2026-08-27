import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseTasks } from "./tasks.js";
import { getTimestamps } from "./git-cache.js";
import { listWorkspaces, toWorktreeSource } from "./worktrees.js";
import { jjCurrentChangeSlugs } from "./jj-workspaces.js";
import { discoverArtifacts } from "./artifact-discovery.js";
import { countArtifacts, changeDirMtime } from "./artifact-files.js";
import {
  cliDivergence,
  committedDivergedSlugs,
  uncommittedDivergedSlugs,
  type DivergenceProvider,
} from "./divergence.js";
import { cliSchemaOrderProvider, resolveSchemaOrder, type SchemaOrderProvider } from "./schema-order.js";
import type {
  SpecInfo,
  ChangeInfo,
  ChangeDetail,
  HistoryEntry,
  ScanResult,
  AggregatedScanResult,
  TaskStats,
  GraphData,
  GraphNode,
  GraphEdge,
  WorktreeInfo,
} from "./types.js";

function openspecDir(repoDir: string): string {
  return path.join(repoDir, "openspec");
}

function readFileOrNull(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

export function parseSlug(slug: string): { date: string | null; description: string } {
  const match = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (match) {
    return { date: match[1], description: match[2].replace(/-/g, " ") };
  }
  return { date: null, description: slug.replace(/-/g, " ") };
}

function safeReadDir(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter((name) => !name.startsWith("."));
}

// 列出某 worktree 中所有 active（非 archive）change 的 slug。list 與 graph 兩條聚合路徑共用此函式，
// 確保餵給 pickActiveWinners 的 slug 集合「由建構保證一致」，而非各自實作、靠人工比對才相同。
function listActiveChangeSlugs(repoDir: string): string[] {
  const changesDir = path.join(openspecDir(repoDir), "changes");
  return safeReadDir(changesDir).filter(
    (name) => name !== "archive" && fs.statSync(path.join(changesDir, name)).isDirectory(),
  );
}

// 讀取 .openspec.yaml 的頂層 key:value 欄位（不支援 nested 結構，目前需求內僅有 schema/created）
export function parseChangeYaml(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  // 以 /\r?\n/ 切行，讓 CRLF 檔案不會在行尾留下 \r 而導致 created: 整行 match 失敗
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) parsed[m[1]] = m[2].trim();
  }
  return parsed;
}

// 從 .openspec.yaml 解出 createdDate；格式不符（非 YYYY-MM-DD）視為 null
function readCreatedDate(changePath: string): string | null {
  const yamlPath = path.join(changePath, ".openspec.yaml");
  if (!fs.existsSync(yamlPath)) return null;
  const meta = parseChangeYaml(fs.readFileSync(yamlPath, "utf-8"));
  const value = meta["created"];
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// 清理 YAML scalar 值供顯示：外層成對引號取其內容（引號內的 # 屬資料，保留），非引號值則去除
// 尾端行內註解（YAML 要求 # 前需空白）。schema 名稱為單純 slug，此處只移除 `schema: "x"  # note`
// 這類格式雜訊，不改變真正的 schema 值。
function cleanScalar(value: string): string {
  const v = value.trim();
  const quoted = v.match(/^"([^"]*)"/) || v.match(/^'([^']*)'/);
  if (quoted) return quoted[1];
  return v.replace(/\s+#.*$/, "").trim();
}

// 讀取 repo openspec/config.yaml 的 schema（change 未宣告 schema 時的 fallback）
// Exported for schemas.ts, so the repo's active schema is read by this one rule rather than a second copy.
export function readRepoSchema(repoDir: string): string | null {
  const configPath = path.join(openspecDir(repoDir), "config.yaml");
  if (!fs.existsSync(configPath)) return null;
  const m = fs.readFileSync(configPath, "utf-8").match(/^schema:\s*(.+)$/m);
  return m ? cleanScalar(m[1]) : null;
}

// change 的 schema：優先取 change .openspec.yaml 的 schema，否則 fallback 回已算好的 repo 預設
// （defaultSchema 由呼叫端算一次後傳入，避免每個 change 重讀 config.yaml）
function readChangeSchema(changePath: string, defaultSchema: string | null): string | null {
  const yamlPath = path.join(changePath, ".openspec.yaml");
  if (fs.existsSync(yamlPath)) {
    const meta = parseChangeYaml(fs.readFileSync(yamlPath, "utf-8"));
    if (meta["schema"]) return cleanScalar(meta["schema"]);
  }
  return defaultSchema;
}

function scanChangeDir(
  changePath: string,
  slug: string,
  status: "active" | "archived",
  defaultSchema: string | null,
): ChangeInfo {
  const { date, description } = parseSlug(slug);
  const hasProposal = fs.existsSync(path.join(changePath, "proposal.md"));
  const hasDesign = fs.existsSync(path.join(changePath, "design.md"));
  const hasTasks = fs.existsSync(path.join(changePath, "tasks.md"));
  const hasSpecs = fs.existsSync(path.join(changePath, "specs"));

  let taskStats: TaskStats | null = null;
  if (hasTasks) {
    const content = fs.readFileSync(path.join(changePath, "tasks.md"), "utf-8");
    const parsed = parseTasks(content);
    taskStats = { total: parsed.total, completed: parsed.completed };
  }

  const createdDate = readCreatedDate(changePath);
  // archive folder 強制 YYYY-MM-DD-slug 命名（parseSlug 已處理），active 一律 null
  const archivedDate = status === "archived" ? date : null;

  return {
    slug,
    date,
    timestamp: null,
    createdDate,
    archivedDate,
    description,
    status,
    hasProposal,
    hasDesign,
    hasTasks,
    hasSpecs,
    artifactCount: countArtifacts(changePath),
    schema: readChangeSchema(changePath, defaultSchema),
    defaultSchema,
    taskStats,
  };
}

// 依 git timestamp 降序排列，無 timestamp 時 fallback 回 slug 日期。
function compareChangesByTimestamp(a: ChangeInfo, b: ChangeInfo): number {
  const ta = a.timestamp || a.date || "";
  const tb = b.timestamp || b.date || "";
  return tb.localeCompare(ta);
}

export async function scanOpenSpec(repoDir: string): Promise<ScanResult> {
  const base = openspecDir(repoDir);
  const specsDir = path.join(base, "specs");
  const changesDir = path.join(base, "changes");
  const archiveDir = path.join(changesDir, "archive");

  // repo 預設 schema 只讀一次，供本次掃描的每個 change 共用（避免 N+M+1 次重讀 config.yaml）
  const defaultSchema = readRepoSchema(repoDir);

  const specs: SpecInfo[] = safeReadDir(specsDir)
    .filter((name) => fs.statSync(path.join(specsDir, name)).isDirectory())
    .map((topic) => ({ topic, path: path.join(specsDir, topic, "spec.md"), historyCount: 0 }))
    .filter((s) => fs.existsSync(s.path))
    .sort((a, b) => a.topic.localeCompare(b.topic));

  // 取得 git timestamps
  const timestamps = await getTimestamps(repoDir);

  const sortByTimestamp = (a: ChangeInfo, b: ChangeInfo) => {
    const ta = a.timestamp || a.date || "";
    const tb = b.timestamp || b.date || "";
    return tb.localeCompare(ta);
  };

  const activeChanges: ChangeInfo[] = listActiveChangeSlugs(repoDir)
    .map((slug) => {
      const info = scanChangeDir(path.join(changesDir, slug), slug, "active", defaultSchema);
      info.timestamp = timestamps.get(slug) || null;
      return info;
    })
    .sort(sortByTimestamp);

  const archivedChanges: ChangeInfo[] = safeReadDir(archiveDir)
    .filter((name) => fs.statSync(path.join(archiveDir, name)).isDirectory())
    .map((slug) => {
      const info = scanChangeDir(path.join(archiveDir, slug), slug, "archived", defaultSchema);
      info.timestamp = timestamps.get(slug) || null;
      return info;
    })
    .sort(sortByTimestamp);

  // 計算每個 spec 被多少 changes 引用
  const allChangeDirs = [
    ...safeReadDir(changesDir).filter((n) => n !== "archive").map((n) => path.join(changesDir, n)),
    ...safeReadDir(archiveDir).map((n) => path.join(archiveDir, n)),
  ];
  for (const spec of specs) {
    spec.historyCount = allChangeDirs.filter((dir) =>
      fs.existsSync(path.join(dir, "specs", spec.topic, "spec.md"))
    ).length;
  }

  return { specs, activeChanges, archivedChanges, defaultSchema };
}

export async function readSpec(
  repoDir: string,
  topic: string,
): Promise<{ topic: string; content: string; relatedChanges: string[]; history: HistoryEntry[] } | null> {
  const specPath = path.join(openspecDir(repoDir), "specs", topic, "spec.md");
  const content = readFileOrNull(specPath);
  if (content === null) return null;

  const relatedChanges = findRelatedChanges(repoDir, topic);

  // 取得 git timestamp cache
  const timestamps = await getTimestamps(repoDir);

  // 建立歷史紀錄，含日期、git timestamp 與描述
  const base = openspecDir(repoDir);
  const changesDir = path.join(base, "changes");
  const archiveDir = path.join(changesDir, "archive");

  const history: HistoryEntry[] = relatedChanges.map((slug) => {
    const { date, description } = parseSlug(slug);
    const isArchived = fs.existsSync(path.join(archiveDir, slug));
    const timestamp = timestamps.get(slug) || null;
    return { slug, date, timestamp, description, status: isArchived ? "archived" : "active" };
  });

  // 按 git timestamp 降序排列，無 timestamp 時 fallback 回 slug 日期
  history.sort((a, b) => {
    const ta = a.timestamp || a.date || "";
    const tb = b.timestamp || b.date || "";
    return tb.localeCompare(ta);
  });

  return { topic, content, relatedChanges, history };
}

export async function readChange(
  repoDir: string,
  slug: string,
  orderProvider: SchemaOrderProvider = cliSchemaOrderProvider,
): Promise<ChangeDetail | null> {
  // 空 slug 不是 change：path.join(changesDir, "") 會指向 changes/ 目錄本身（存在），若不擋下會被
  // 當成 active change，並以 repo 預設 schema 為 key 把 null 寫進該 schema 的快取桶而污染真實 change。
  if (!slug) return null;

  const base = openspecDir(repoDir);
  const changesDir = path.join(base, "changes");

  // 在 active 和 archive 中尋找
  let changePath = path.join(changesDir, slug);
  let status: "active" | "archived" = "active";
  if (!fs.existsSync(changePath)) {
    changePath = path.join(changesDir, "archive", slug);
    status = "archived";
  }
  if (!fs.existsSync(changePath)) return null;

  // 讀取 .openspec.yaml metadata（保留所有 key 供未來擴充）
  const metaPath = path.join(changePath, ".openspec.yaml");
  let metadata: Record<string, unknown> | null = null;
  if (fs.existsSync(metaPath)) {
    metadata = parseChangeYaml(fs.readFileSync(metaPath, "utf-8"));
  }

  const defaultSchema = readRepoSchema(repoDir);
  const schema = readChangeSchema(changePath, defaultSchema);
  // artifact 依 mtime 由新到舊排序（見 discoverArtifacts）
  const artifacts = discoverArtifacts(changePath);

  // schema 權威順序（供前端 schema-order 排序用）：只對 active change 查詢 CLI，
  // archived change 無 planningArtifacts，直接為 null（前端顯示 archived 退回訊息）
  // 只對 active change 查 CLI（archived 無 planningArtifacts）。schema 為 null 不代表無權威順序——
  // CLI 會自行解析出內建預設並回傳（provider 內以 repo 級預設桶快取），故 null schema 仍要查。
  const refs = status === "active" ? await orderProvider(repoDir, slug, schema) : null;
  // A data artifact's title is its exact filename, so this maps a declared data outputPath to the right id
  // even when a markdown sibling shares its stem (asyncapi.md + asyncapi.yaml).
  const dataFileToId = new Map(
    artifacts.filter((a) => a.kind === "data").map((a) => [a.title, a.id] as const),
  );
  const schemaOrder = resolveSchemaOrder(refs, artifacts.map((a) => a.id), dataFileToId) ?? undefined;

  const createdDate = readCreatedDate(changePath);
  const archivedDate = status === "archived" ? parseSlug(slug).date : null;

  return {
    slug,
    status,
    createdDate,
    archivedDate,
    schema,
    defaultSchema,
    artifacts,
    schemaOrder,
    metadata,
  };
}

export function readSpecAtChange(
  repoDir: string,
  topic: string,
  slug: string,
): { content: string } | null {
  const base = openspecDir(repoDir);
  const changesDir = path.join(base, "changes");

  // 先檢查 active changes
  let specPath = path.join(changesDir, slug, "specs", topic, "spec.md");
  let content = readFileOrNull(specPath);
  if (content !== null) return { content };

  // 再檢查 archive
  specPath = path.join(changesDir, "archive", slug, "specs", topic, "spec.md");
  content = readFileOrNull(specPath);
  if (content !== null) return { content };

  return null;
}

export function buildGraphData(repoDir: string): GraphData {
  const base = openspecDir(repoDir);
  const specsDir = path.join(base, "specs");
  const changesDir = path.join(base, "changes");
  const archiveDir = path.join(changesDir, "archive");

  // 收集所有 spec topics
  const specTopics = safeReadDir(specsDir)
    .filter((name) => fs.statSync(path.join(specsDir, name)).isDirectory())
    .filter((topic) => fs.existsSync(path.join(specsDir, topic, "spec.md")));

  // 收集所有 change dirs（active + archived）
  const changeDirs: { slug: string; dirPath: string; status: "active" | "archived" }[] = [];
  for (const slug of safeReadDir(changesDir)) {
    if (slug === "archive") continue;
    const dirPath = path.join(changesDir, slug);
    if (fs.statSync(dirPath).isDirectory()) {
      changeDirs.push({ slug, dirPath, status: "active" });
    }
  }
  for (const slug of safeReadDir(archiveDir)) {
    const dirPath = path.join(archiveDir, slug);
    if (fs.statSync(dirPath).isDirectory()) {
      changeDirs.push({ slug, dirPath, status: "archived" });
    }
  }

  // 建立邊：掃描每個 change 的 specs/ 子目錄
  const edges: GraphEdge[] = [];
  const changeSpecCounts = new Map<string, number>();
  const specHistoryCounts = new Map<string, number>();

  for (const { slug, dirPath, status: _status } of changeDirs) {
    const changeSpecsDir = path.join(dirPath, "specs");
    if (!fs.existsSync(changeSpecsDir)) continue;

    let specCount = 0;
    for (const topic of safeReadDir(changeSpecsDir)) {
      if (fs.existsSync(path.join(changeSpecsDir, topic, "spec.md"))) {
        edges.push({
          source: `change:${slug}`,
          target: `spec:${topic}`,
        });
        specCount++;
        specHistoryCounts.set(topic, (specHistoryCounts.get(topic) || 0) + 1);
      }
    }
    if (specCount > 0) {
      changeSpecCounts.set(slug, specCount);
    }
  }

  // 建立節點
  const nodes: GraphNode[] = [];

  // Spec 節點
  for (const topic of specTopics) {
    nodes.push({
      id: `spec:${topic}`,
      type: "spec",
      label: topic,
      historyCount: specHistoryCounts.get(topic) || 0,
    });
  }

  // Change 節點（只包含有 specs 的 changes）
  for (const { slug, status } of changeDirs) {
    const specCount = changeSpecCounts.get(slug);
    if (!specCount) continue;
    const { date, description } = parseSlug(slug);
    nodes.push({
      id: `change:${slug}`,
      type: "change",
      label: description,
      date,
      status,
      specCount,
    });
  }

  return { nodes, edges };
}

export function findRelatedChanges(repoDir: string, topic: string): string[] {
  const base = openspecDir(repoDir);
  const changesDir = path.join(base, "changes");
  const archiveDir = path.join(changesDir, "archive");
  const related: string[] = [];

  // 搜尋 active changes
  for (const slug of safeReadDir(changesDir)) {
    if (slug === "archive") continue;
    const deltaSpec = path.join(changesDir, slug, "specs", topic, "spec.md");
    if (fs.existsSync(deltaSpec)) related.push(slug);
  }

  // 搜尋 archived changes
  for (const slug of safeReadDir(archiveDir)) {
    const deltaSpec = path.join(archiveDir, slug, "specs", topic, "spec.md");
    if (fs.existsSync(deltaSpec)) related.push(slug);
  }

  return related;
}

/**
 * 跨 worktree 為每個 active change slug 選出勝出的副本，回傳 `slug → WorktreeInfo`。
 *
 * 勝出訊號是 **git 分歧**，非檔案 mtime。候選是「已自 merge-base 推進」的副本：非主 worktree 在其
 * `HEAD` 對該 slug 超前與 main 的 merge-base（三點 diff）或有未提交修改時分歧。**main 以同等條件參賽**
 * —— 當該 slug 至少有一個 worktree 分歧（競賽成立）且 main 自己也對某個分歧 worktree 的 merge-base
 * 有推進（反向三點 diff）或有未提交修改時，main 亦為候選；沒有 main 特例、也沒有「非主一律優先」的
 * 無條件規則。沒有任何 worktree 分歧時 slug 留在 main。只是繼承、未曾推進的副本永不入選。在所有候選
 * 之間以 `changeDirMtime` 較新者 tiebreak。非主 worktree 的分歧走可注入的 `diverge`（利於測試）；
 * main 的反向分歧直接用 `committedDivergedSlugs`／`uncommittedDivergedSlugs`——後者（工作區狀態）與
 * contender 無關，只算一次，不必每個 contender 重跑 main 的 `git status`。
 */
export async function pickActiveWinners(
  entries: { wt: WorktreeInfo; slugs: string[] }[],
  mainWt: WorktreeInfo,
  diverge: DivergenceProvider = cliDivergence,
): Promise<Map<string, WorktreeInfo>> {
  // 每個非主 worktree 平行算一次其分歧 slug 集合
  const nonMain = entries.filter((e) => e.wt !== mainWt);
  const divergedByWt = new Map<WorktreeInfo, Set<string>>();
  await Promise.all(
    nonMain.map(async (e) => {
      divergedByWt.set(e.wt, await diverge(e.wt, mainWt.head));
    }),
  );

  // main 以同等條件參賽：對每個「確實分歧」的 worktree，看 main 是否也自該 worktree 的 merge-base
  // 有推進。「已提交」需對照各 contender 的 merge-base（反向三點）分別算；「未提交」是 main 的工作區
  // 狀態、與 contender 無關，只算一次（避免每個 contender 重跑一次 main 的 git status）。
  const contenders = nonMain.filter((e) => (divergedByWt.get(e.wt)?.size ?? 0) > 0);
  let mainUncommitted = new Set<string>();
  const mainCommittedVsWt = new Map<WorktreeInfo, Set<string>>();
  if (contenders.length > 0) {
    await Promise.all([
      uncommittedDivergedSlugs(mainWt.path).then((s) => {
        mainUncommitted = s;
      }),
      ...contenders.map((e) =>
        committedDivergedSlugs(mainWt.path, mainWt.head, e.wt.head).then((s) => {
          mainCommittedVsWt.set(e.wt, s);
        }),
      ),
    ]);
  }
  const mainAdvancedOn = (slug: string, wt: WorktreeInfo): boolean =>
    mainUncommitted.has(slug) || (mainCommittedVsWt.get(wt)?.has(slug) ?? false);

  // slug → 持有它的 worktree 清單
  const holders = new Map<string, WorktreeInfo[]>();
  for (const { wt, slugs } of entries) {
    for (const slug of slugs) {
      const list = holders.get(slug);
      if (list) list.push(wt);
      else holders.set(slug, [wt]);
    }
  }

  const pickByMtime = (slug: string, candidates: WorktreeInfo[]): WorktreeInfo => {
    if (candidates.length === 1) return candidates[0];
    let best = candidates[0];
    let bestMtime = changeDirMtime(path.join(openspecDir(best.path), "changes", slug));
    for (const wt of candidates.slice(1)) {
      const m = changeDirMtime(path.join(openspecDir(wt.path), "changes", slug));
      if (m > bestMtime) {
        best = wt;
        bestMtime = m;
      }
    }
    return best;
  };

  const winners = new Map<string, WorktreeInfo>();
  for (const [slug, wts] of holders) {
    const diverging = wts.filter((wt) => wt !== mainWt && divergedByWt.get(wt)?.has(slug));
    if (diverging.length === 0) {
      // 無人分歧：留在 main；main 未持有的罕見情形（如 git 失敗）以持有者中最新 mtime 者保底。
      winners.set(slug, pickByMtime(slug, wts.includes(mainWt) ? [mainWt] : wts));
      continue;
    }
    // 競賽成立：分歧的非主副本入選；main 若也持有且對某個分歧 worktree 的 merge-base 有推進，亦入選。
    const candidates = [...diverging];
    if (wts.includes(mainWt) && diverging.some((wt) => mainAdvancedOn(slug, wt))) {
      candidates.push(mainWt);
    }
    winners.set(slug, pickByMtime(slug, candidates));
  }
  return winners;
}

/**
 * 計算單一 active change 目錄的內容指紋（目錄內所有檔案的相對路徑 + 內容雜湊）。
 * 用於 jj 聚合判斷不同 workspace 的同名 change 是否內容相同（相同則去重）。
 */
function changeContentFingerprint(repoDir: string, slug: string): string {
  const dir = path.join(openspecDir(repoDir), "changes", slug);
  const hash = createHash("sha1");
  const walk = (rel: string) => {
    const abs = rel ? path.join(dir, rel) : dir;
    let st: fs.Stats;
    try {
      st = fs.statSync(abs);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) {
        walk(rel ? path.join(rel, name) : name);
      }
    } else if (st.isFile()) {
      hash.update(rel + "\0");
      hash.update(fs.readFileSync(abs));
      hash.update("\0");
    }
  };
  walk("");
  return hash.digest("hex");
}

/**
 * 跨工作目錄聚合掃描。探索 repoDir 所屬 repo 的所有 git worktree 與 jj workspace，
 * active changes 分兩套去重機制並存：git worktree 之間以 **git 分歧選舉**去重（勝出者為對該 slug
 * 確實推進 main HEAD 或有未提交修改的 worktree，見 pickActiveWinners）；jj workspace 因共用 commit
 * graph 會 materialise 整份 trunk，故以**內容指紋**對基準去重（相同丟棄、分歧者保留並標 conflictsWith、
 * `@` 正在編輯者標 isCurrent）。jj workspace 對 git 隱形且其 `head` 是 jj change id 而非 git sha，
 * 無法餵進 git 分歧選舉，故兩者刻意走各自路徑。皆附 source；archived changes 依 slug 去重
 * （主工作目錄優先）、specs 取主工作目錄。關閉聚合、非版控、或單一工作目錄時等同 scanOpenSpec(repoDir)。
 */
export async function scanOpenSpecAggregated(
  repoDir: string,
  options: { aggregate?: boolean; includeJj?: boolean } = {},
): Promise<AggregatedScanResult> {
  const aggregate = options.aggregate !== false;
  // 一律探索工作目錄，讓 UI 即使在關閉聚合時仍知道有多個工作目錄（可重新開啟聚合）
  const worktrees = await listWorkspaces(repoDir, {
    includeJj: options.includeJj,
  });

  if (!aggregate || worktrees.length <= 1) {
    const single = await scanOpenSpec(repoDir);
    return { ...single, worktrees, aggregated: false };
  }

  // 只要 repo 含 jj workspace 就計算 `@` 高亮——colocated 主目錄雖去重成 git 那筆，
  // 仍可能是使用者實際編輯的 default workspace，故對每個工作目錄都查（非 jj 路徑回空集合）。
  const repoUsesJj = worktrees.some((w) => w.vcs === "jj");

  // 各工作目錄平行掃描；含 jj 時另平行取 `@` 正在編輯的 change slug
  const scans = await Promise.all(
    worktrees.map(async (wt) => ({
      wt,
      scan: await scanOpenSpec(wt.path),
      currentSlugs: repoUsesJj
        ? await jjCurrentChangeSlugs(wt.path)
        : (null as Set<string> | null),
    })),
  );

  // 主工作目錄 = 第一個非 bare（通常即 worktrees[0]）
  const main = scans.find((s) => !s.wt.isBare) ?? scans[0];

  // active changes 分兩套去重機制並存（jj workspace 對 git 隱形、其 head 是 jj change id 而非 git
  // sha，無法餵進 git 分歧選舉，故刻意走各自路徑）：
  //  - git worktree（含 colocated main）：以 git 分歧選舉去重（勝出者為對該 slug 確實推進 main HEAD
  //    或有未提交修改的 worktree，多個分歧副本間以 mtime tiebreak；見 pickActiveWinners）
  //  - jj workspace：因共用 commit graph 而 materialise 整份 trunk，同名且內容相同的 change 會在每個
  //    workspace 重複出現，故以「slug + 內容指紋」對基準（main）與彼此去重；內容分歧者保留並標 conflictsWith
  const activeChanges: ChangeInfo[] = [];
  const sourceLabel = (wt: typeof main.wt) =>
    wt.isMain ? "main" : (wt.branch ?? (wt.vcs === "jj" ? "jj" : "detached"));

  // git worktree：git 分歧選舉去重。jj workspace 不參選（見上），故先濾掉。
  const gitScans = scans.filter((s) => s.wt.vcs !== "jj");
  const activeEntries = gitScans.map((s) => ({
    wt: s.wt,
    slugs: s.scan.activeChanges.map((c) => c.slug),
  }));
  const activeWinners = await pickActiveWinners(activeEntries, main.wt);
  for (const { wt, scan, currentSlugs } of gitScans) {
    const source = toWorktreeSource(wt);
    for (const c of scan.activeChanges) {
      if (activeWinners.get(c.slug) !== wt) continue; // 只輸出選舉勝出的副本
      const isCurrent = currentSlugs?.has(c.slug) ? true : undefined;
      activeChanges.push({ ...c, source, ...(isCurrent ? { isCurrent } : {}) });
    }
  }

  // jj workspace：以內容指紋對基準去重。基準（jjSeen）由 main 的內容種下——main 是 trunk 基準，
  // 不論它在上面的 git 選舉是否勝出該 slug。colocated repo 的 main 是 git worktree，已由 git 路徑
  // 輸出；純 jj repo（無 git 後端）的 main 本身是 jj workspace，git 選舉不涵蓋它，於此補上輸出。
  if (repoUsesJj) {
    const jjSeen = new Map<string, { fp: string; label: string }[]>();
    const emitMainAsJj = main.wt.vcs === "jj";
    for (const c of main.scan.activeChanges) {
      if (emitMainAsJj) {
        const isCurrent = main.currentSlugs?.has(c.slug) ? true : undefined;
        activeChanges.push({
          ...c,
          source: toWorktreeSource(main.wt),
          ...(isCurrent ? { isCurrent } : {}),
        });
      }
      jjSeen.set(c.slug, [
        { fp: changeContentFingerprint(main.wt.path, c.slug), label: sourceLabel(main.wt) },
      ]);
    }

    for (const { wt, scan, currentSlugs } of scans) {
      if (wt === main.wt || wt.vcs !== "jj") continue;
      const source = toWorktreeSource(wt);
      for (const c of scan.activeChanges) {
        const isCurrent = currentSlugs?.has(c.slug) ? true : undefined;
        const fp = changeContentFingerprint(wt.path, c.slug);
        const seen = jjSeen.get(c.slug);
        if (seen?.some((e) => e.fp === fp)) continue; // 內容相同 → 丟棄重複
        const conflictsWith = seen?.length ? seen[0].label : undefined;
        activeChanges.push({
          ...c,
          source,
          ...(isCurrent ? { isCurrent } : {}),
          ...(conflictsWith ? { conflictsWith } : {}),
        });
        if (seen) seen.push({ fp, label: sourceLabel(wt) });
        else jjSeen.set(c.slug, [{ fp, label: sourceLabel(wt) }]);
      }
    }
  }

  // archived changes：依 slug 去重，主 worktree 優先，其餘只在獨有時加入
  const archivedBySlug = new Map<string, ChangeInfo>();
  for (const c of main.scan.archivedChanges) {
    archivedBySlug.set(c.slug, { ...c, source: toWorktreeSource(main.wt) });
  }
  for (const { wt, scan } of scans) {
    if (wt === main.wt) continue;
    const source = toWorktreeSource(wt);
    for (const c of scan.archivedChanges) {
      if (!archivedBySlug.has(c.slug)) {
        archivedBySlug.set(c.slug, { ...c, source });
      }
    }
  }
  const archivedChanges = [...archivedBySlug.values()];

  activeChanges.sort(compareChangesByTimestamp);
  archivedChanges.sort(compareChangesByTimestamp);

  return {
    specs: main.scan.specs,
    activeChanges,
    archivedChanges,
    worktrees,
    aggregated: true,
    defaultSchema: main.scan.defaultSchema,
  };
}

/**
 * 跨 worktree 聚合的關聯圖。change 節點涵蓋所有 worktree（active 以分歧選舉去重、archived 依 slug
 * 去重，與 list 路徑同一套 pickActiveWinners），節點 id 命名為 `change:<worktreeKey>:<slug>` 避免碰撞；
 * spec 節點只取主 worktree。
 * 關閉聚合、非 git、或單一 worktree 時等同 buildGraphData(repoDir)。
 */
export async function buildGraphDataAggregated(
  repoDir: string,
  options: { aggregate?: boolean; includeJj?: boolean } = {},
): Promise<GraphData> {
  const aggregate = options.aggregate !== false;
  const worktrees = aggregate
    ? await listWorkspaces(repoDir, { includeJj: options.includeJj })
    : [];

  if (!aggregate || worktrees.length <= 1) {
    return buildGraphData(repoDir);
  }

  const main = worktrees.find((w) => !w.isBare) ?? worktrees[0];

  // 每個非 bare worktree 只建一次 graph，重用於「取 active slug 做選舉」與「輸出節點」，
  // 不再為了取 slug 而額外 scanOpenSpec（pickActiveWinners 只需 {wt, slugs}）。主 worktree 先處理，
  // 確保 archived 去重以主 worktree 為準。
  const ordered = [main, ...worktrees.filter((w) => w !== main)];
  const graphs = new Map<WorktreeInfo, GraphData>();
  for (const wt of ordered) {
    if (wt.isBare) continue;
    graphs.set(wt, buildGraphData(wt.path));
  }

  // 與 scanOpenSpecAggregated 共用同一套 active-change 勝出邏輯（分歧選舉），避免 list 與 graph
  // 兩處對「哪個 worktree 擁有這個 slug」給出不同答案。選舉輸入用 listActiveChangeSlugs（與 list
  // 路徑同一函式），而非 graph 節點——後者只含有 delta spec 的 change，會漏掉無 spec 的 active change
  // 而讓兩條路徑選出不同勝出者。仍不做完整 scanOpenSpec（僅列目錄取 slug）。
  // jj workspace 不參與 git 分歧選舉（其 head 是 jj change id、對 git 隱形），故濾掉；
  // jj 的去重在下方節點迴圈以內容指紋處理，與 list 路徑一致。
  const activeEntries = [...graphs.keys()]
    .filter((wt) => wt.vcs !== "jj")
    .map((wt) => ({
      wt,
      slugs: listActiveChangeSlugs(wt.path),
    }));
  const activeWinners = await pickActiveWinners(activeEntries, main);

  // spec 節點：只取主 worktree
  const nodes: GraphNode[] = (graphs.get(main)?.nodes ?? [])
    .filter((n) => n.type === "spec")
    .map((n) => ({ ...n }));
  const edges: GraphEdge[] = [];
  const seenArchivedSlugs = new Set<string>();
  const historyCounts = new Map<string, number>();
  // jj active 去重：slug -> 已見內容指紋集合（由 main 種子；僅含 jj 時使用），
  // 避免共用 commit graph 的 jj workspace 把同一個 change 重複成多個節點。
  const repoUsesJj = worktrees.some((w) => w.vcs === "jj");
  const jjSeenActive = new Map<string, Set<string>>();

  for (const wt of ordered) {
    const g = graphs.get(wt);
    if (!g) continue;
    const source = toWorktreeSource(wt);
    const idMap = new Map<string, string>();
    for (const node of g.nodes) {
      if (node.type !== "change") continue;
      const slug = node.id.slice("change:".length);
      if (node.status === "archived") {
        if (seenArchivedSlugs.has(slug)) continue;
        seenArchivedSlugs.add(slug);
      } else if (wt.vcs !== "jj") {
        // git worktree active 節點：只保留 git 分歧選舉勝出的副本（見 pickActiveWinners）。
        // main 另外種下 jj 去重基準，讓 jj workspace 得以對 main 的內容去重（不論 main 是否勝出）。
        if (wt === main && repoUsesJj && !jjSeenActive.has(slug)) {
          jjSeenActive.set(slug, new Set([changeContentFingerprint(wt.path, slug)]));
        }
        if (activeWinners.get(slug) !== wt) continue;
      } else {
        // jj workspace active 節點：以內容指紋對基準（main）與其他 jj workspace 去重；
        // jj 重複者跳過（連帶略過其 edges，不灌水 spec historyCount）
        const fp = changeContentFingerprint(wt.path, slug);
        const seen = jjSeenActive.get(slug);
        if (seen?.has(fp)) continue;
        if (seen) seen.add(fp);
        else jjSeenActive.set(slug, new Set([fp]));
      }
      const newId = `change:${wt.key}:${slug}`;
      idMap.set(node.id, newId);
      nodes.push({ ...node, id: newId, source });
    }
    for (const edge of g.edges) {
      const newSource = idMap.get(edge.source);
      if (!newSource) continue;
      edges.push({ source: newSource, target: edge.target });
      historyCounts.set(edge.target, (historyCounts.get(edge.target) || 0) + 1);
    }
  }

  // 依聚合後的 edge 重算 spec 節點 historyCount
  for (const node of nodes) {
    if (node.type === "spec") {
      node.historyCount = historyCounts.get(node.id) || 0;
    }
  }

  return { nodes, edges };
}
