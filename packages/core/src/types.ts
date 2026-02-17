import type { ParsedTasks, TaskStats } from "./tasks.js";

export interface SpecInfo {
  topic: string;
  path: string;
  historyCount: number;
}

export interface HistoryEntry {
  slug: string;
  date: string | null;
  timestamp: string | null;
  description: string;
  status: "active" | "archived";
}

export interface SpecDetail {
  topic: string;
  content: string;
  relatedChanges: string[];
  history: HistoryEntry[];
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
  tasks: ParsedTasks | null;
  specs: { topic: string; content: string }[];
  metadata: Record<string, unknown> | null;
}

export interface ChangesData {
  active: ChangeInfo[];
  archived: ChangeInfo[];
}

export interface OverviewData {
  specsCount: number;
  changesCount: { active: number; archived: number };
  taskStats: TaskStats;
}

export interface ScanResult {
  specs: SpecInfo[];
  activeChanges: ChangeInfo[];
  archivedChanges: ChangeInfo[];
}

export interface SearchResult {
  type: "spec" | "change";
  title: string;
  slug?: string;
  topic?: string;
  context: string;
  file?: string;
}

export interface BrowseEntry {
  name: string;
  type: "directory" | "file";
  path: string;
}

export interface BrowseData {
  path: string;
  entries: BrowseEntry[];
}

export interface DetectData {
  hasOpenSpec: boolean;
  schema?: string;
}

export interface SpecVersionContent {
  content: string;
}

export interface GraphNode {
  id: string;
  type: "spec" | "change";
  label: string;
  date?: string | null;
  status?: "active" | "archived";
  historyCount?: number;
  specCount?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type { TaskItem, TaskSection, TaskStats, ParsedTasks } from "./tasks.js";
