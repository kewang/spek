import fs from "node:fs";
import path from "node:path";
import { parseTasks } from "./tasks.js";
import { getTimestamps } from "./git-cache.js";
import type {
  SpecInfo,
  ChangeInfo,
  ChangeDetail,
  HistoryEntry,
  ScanResult,
  TaskStats,
  GraphData,
  GraphNode,
  GraphEdge,
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

function scanChangeDir(
  changePath: string,
  slug: string,
  status: "active" | "archived",
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

  return { slug, date, timestamp: null, description, status, hasProposal, hasDesign, hasTasks, hasSpecs, taskStats };
}

export async function scanOpenSpec(repoDir: string): Promise<ScanResult> {
  const base = openspecDir(repoDir);
  const specsDir = path.join(base, "specs");
  const changesDir = path.join(base, "changes");
  const archiveDir = path.join(changesDir, "archive");

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

  const activeChanges: ChangeInfo[] = safeReadDir(changesDir)
    .filter((name) => name !== "archive")
    .filter((name) => fs.statSync(path.join(changesDir, name)).isDirectory())
    .map((slug) => {
      const info = scanChangeDir(path.join(changesDir, slug), slug, "active");
      info.timestamp = timestamps.get(slug) || null;
      return info;
    })
    .sort(sortByTimestamp);

  const archivedChanges: ChangeInfo[] = safeReadDir(archiveDir)
    .filter((name) => fs.statSync(path.join(archiveDir, name)).isDirectory())
    .map((slug) => {
      const info = scanChangeDir(path.join(archiveDir, slug), slug, "archived");
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

  return { specs, activeChanges, archivedChanges };
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

export function readChange(repoDir: string, slug: string): ChangeDetail | null {
  const base = openspecDir(repoDir);
  const changesDir = path.join(base, "changes");

  // 在 active 和 archive 中尋找
  let changePath = path.join(changesDir, slug);
  if (!fs.existsSync(changePath)) {
    changePath = path.join(changesDir, "archive", slug);
  }
  if (!fs.existsSync(changePath)) return null;

  const proposal = readFileOrNull(path.join(changePath, "proposal.md"));
  const design = readFileOrNull(path.join(changePath, "design.md"));

  const tasksContent = readFileOrNull(path.join(changePath, "tasks.md"));
  const tasks = tasksContent ? parseTasks(tasksContent) : null;

  const specsDir = path.join(changePath, "specs");
  const specs: { topic: string; content: string }[] = [];
  if (fs.existsSync(specsDir)) {
    for (const topic of safeReadDir(specsDir)) {
      const specPath = path.join(specsDir, topic, "spec.md");
      const content = readFileOrNull(specPath);
      if (content) specs.push({ topic, content });
    }
  }

  // 讀取 .openspec.yaml metadata
  const metaPath = path.join(changePath, ".openspec.yaml");
  let metadata: Record<string, unknown> | null = null;
  if (fs.existsSync(metaPath)) {
    const metaContent = fs.readFileSync(metaPath, "utf-8");
    const parsed: Record<string, string> = {};
    for (const line of metaContent.split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) parsed[m[1]] = m[2].trim();
    }
    metadata = parsed;
  }

  return { slug, proposal, design, tasks, specs, metadata };
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
