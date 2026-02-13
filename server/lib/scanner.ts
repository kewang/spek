import fs from "node:fs";
import path from "node:path";
import { parseTasks, type TaskStats } from "./tasks.js";

export interface SpecInfo {
  topic: string;
  path: string;
}

export interface ChangeInfo {
  slug: string;
  date: string | null;
  description: string;
  status: "active" | "archived";
  hasProposal: boolean;
  hasDesign: boolean;
  hasTasks: boolean;
  hasSpecs: boolean;
  taskStats: TaskStats | null;
}

export interface ChangeDetail {
  slug: string;
  proposal: string | null;
  design: string | null;
  tasks: ReturnType<typeof parseTasks> | null;
  specs: { topic: string; content: string }[];
  metadata: Record<string, unknown> | null;
}

export interface ScanResult {
  specs: SpecInfo[];
  activeChanges: ChangeInfo[];
  archivedChanges: ChangeInfo[];
}

function openspecDir(repoDir: string): string {
  return path.join(repoDir, "openspec");
}

function readFileOrNull(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

function parseSlug(slug: string): { date: string | null; description: string } {
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

  return { slug, date, description, status, hasProposal, hasDesign, hasTasks, hasSpecs, taskStats };
}

export function scanOpenSpec(repoDir: string): ScanResult {
  const base = openspecDir(repoDir);
  const specsDir = path.join(base, "specs");
  const changesDir = path.join(base, "changes");
  const archiveDir = path.join(changesDir, "archive");

  const specs: SpecInfo[] = safeReadDir(specsDir)
    .filter((name) => fs.statSync(path.join(specsDir, name)).isDirectory())
    .map((topic) => ({ topic, path: path.join(specsDir, topic, "spec.md") }))
    .filter((s) => fs.existsSync(s.path))
    .sort((a, b) => a.topic.localeCompare(b.topic));

  const activeChanges: ChangeInfo[] = safeReadDir(changesDir)
    .filter((name) => name !== "archive")
    .filter((name) => fs.statSync(path.join(changesDir, name)).isDirectory())
    .map((slug) => scanChangeDir(path.join(changesDir, slug), slug, "active"))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const archivedChanges: ChangeInfo[] = safeReadDir(archiveDir)
    .filter((name) => fs.statSync(path.join(archiveDir, name)).isDirectory())
    .map((slug) => scanChangeDir(path.join(archiveDir, slug), slug, "archived"))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return { specs, activeChanges, archivedChanges };
}

interface HistoryEntry {
  slug: string;
  date: string | null;
  description: string;
  status: "active" | "archived";
}

export function readSpec(
  repoDir: string,
  topic: string,
): { topic: string; content: string; relatedChanges: string[]; history: HistoryEntry[] } | null {
  const specPath = path.join(openspecDir(repoDir), "specs", topic, "spec.md");
  const content = readFileOrNull(specPath);
  if (content === null) return null;

  const relatedChanges = findRelatedChanges(repoDir, topic);

  // 建立歷史紀錄，含日期與描述
  const base = openspecDir(repoDir);
  const changesDir = path.join(base, "changes");
  const archiveDir = path.join(changesDir, "archive");

  const history: HistoryEntry[] = relatedChanges.map((slug) => {
    const { date, description } = parseSlug(slug);
    const isArchived = fs.existsSync(path.join(archiveDir, slug));
    return { slug, date, description, status: isArchived ? "archived" : "active" };
  });

  // 按日期降序排列
  history.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

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
