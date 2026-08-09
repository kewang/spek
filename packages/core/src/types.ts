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

/**
 * 一個工作目錄的完整資訊：git worktree（`git worktree list --porcelain`）
 * 或 jj workspace（`jj workspace list`）。兩者共用此形狀，以 `vcs` 區分來源。
 */
export interface WorktreeInfo {
  /** worktree 絕對路徑 */
  path: string;
  /** branch 名稱（jj workspace 為 workspace name）；detached HEAD 為 null */
  branch: string | null;
  /** HEAD commit hash（jj 為 `@` 的 change id）；無 commit 時為 null */
  head: string | null;
  /** 是否為主工作目錄（git main worktree 或 jj `default` workspace） */
  isMain: boolean;
  /** 是否為 bare repo（jj workspace 恆為 false） */
  isBare: boolean;
  /** 穩定的識別碼（絕對路徑雜湊前 8 碼） */
  key: string;
  /** 來源版控系統：git worktree 或 jj workspace */
  vcs: "git" | "jj";
}

/** 附加在聚合後 change 上的精簡來源資訊（WorktreeInfo 的精簡子集）。 */
export interface WorktreeSource {
  key: string;
  path: string;
  branch: string | null;
  isMain: boolean;
  /** 來源版控系統：git worktree 或 jj workspace */
  vcs: "git" | "jj";
}

export interface ChangeInfo {
  slug: string;
  date: string | null;
  timestamp: string | null;
  createdDate: string | null;
  archivedDate: string | null;
  description: string;
  status: "active" | "archived";
  hasProposal: boolean;
  hasDesign: boolean;
  hasTasks: boolean;
  hasSpecs: boolean;
  /** 此 change 探索到的 artifact 數量（root *.md + specs/ 視為各一個） */
  artifactCount: number;
  /** 此 change 採用的 schema 名稱（.openspec.yaml schema → repo config.yaml fallback），無法判定為 null */
  schema: string | null;
  /** 此 change 所在 worktree 的預設 schema（openspec/config.yaml schema:），無法判定為 null；供 list/dashboard 以「各自 worktree 的預設」判斷是否隱藏 badge */
  defaultSchema: string | null;
  taskStats: TaskStats | null;
  /** 來源 worktree；僅聚合掃描會填入，單一目錄掃描為 undefined */
  source?: WorktreeSource;
  /** 是否為來源 jj workspace 此刻 working-copy commit `@` 正在編輯的 change */
  isCurrent?: boolean;
  /**
   * jj 聚合時，同 slug 的 change 在此 workspace 與基準（base/main）內容相異（分歧版本）。
   * 值為衝突對象的來源標籤（如 branch / "main"），供 UI 顯示「conflicts with …」。
   */
  conflictsWith?: string;
}

/** 一個 change artifact 的 kind，決定解析與渲染方式 */
export type ArtifactKind = "markdown" | "tasks" | "specs";

/** 動態探索到的單一 change artifact；預設依檔案 mtime 由新到舊排序（見 discoverArtifacts），
 *  openspec CLI 只餵給選用的 schema 順序（ChangeDetail.schemaOrder），非此處的預設排序 */
export interface ChangeArtifact {
  /** 穩定識別碼：檔名去副檔名（specs tree 為 "specs"） */
  id: string;
  /** 顯示標題（由檔名 humanize） */
  title: string;
  kind: ArtifactKind;
  /** kind === "markdown"：原始 Markdown 內容 */
  content?: string;
  /** kind === "tasks"：解析後的 tasks */
  tasks?: ParsedTasks;
  /** kind === "specs"：delta spec 清單 */
  specs?: { topic: string; content: string }[];
}

export interface ChangeDetail {
  slug: string;
  status: "active" | "archived";
  createdDate: string | null;
  archivedDate: string | null;
  /** 此 change 採用的 schema 名稱，無法判定為 null */
  schema: string | null;
  /** repo 預設 schema（openspec/config.yaml schema:），無法判定為 null；供 UI 判斷是否隱藏與 default 相同的 badge */
  defaultSchema: string | null;
  /** artifacts，預設依 mtime 由新到舊排序 */
  artifacts: ChangeArtifact[];
  /** schema 權威順序（artifact id 清單，供前端 schema-order 排序用）；CLI 不可用 / archived 時為 null */
  schemaOrder?: string[];
  metadata: Record<string, unknown> | null;
  /** 來源 worktree；僅聚合讀取會填入 */
  source?: WorktreeSource;
}

export interface ChangesData {
  active: ChangeInfo[];
  archived: ChangeInfo[];
  /** 偵測到的 worktree 清單；僅聚合時填入 */
  worktrees?: WorktreeInfo[];
  /** 本次回應是否為跨 worktree 聚合結果 */
  aggregated?: boolean;
  /** repo 預設 schema（openspec/config.yaml schema:），無法判定為 null；供 list 判斷是否隱藏與 default 相同的 badge */
  defaultSchema: string | null;
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
  /** repo 預設 schema（openspec/config.yaml schema:），無法判定為 null */
  defaultSchema: string | null;
}

/** scanOpenSpecAggregated 的回傳：ScanResult 外加 worktree 清單與是否聚合。 */
export interface AggregatedScanResult extends ScanResult {
  worktrees: WorktreeInfo[];
  aggregated: boolean;
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
  /** change 節點的來源 worktree；僅聚合圖會填入 */
  source?: WorktreeSource;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Where a workflow schema was resolved from.
 *
 * The OpenSpec resolver searches three places, in precedence order: the repo's own
 * `openspec/schemas/` (`project`), the machine's global data directory (`user`), then the schemas
 * shipped inside the openspec package (`package`). A name found earlier shadows the same name
 * found later.
 *
 * `user` was missing here at first, and the cost was not cosmetic: an unrecognised source made the
 * enumeration drop that schema entirely, so anyone with a machine-level schema would have seen it
 * silently absent from the list rather than mislabelled.
 */
export type SchemaSource = "package" | "user" | "project";

/**
 * Why package schemas could not be enumerated. A code rather than a sentence, so each surface
 * writes its own copy and core stays free of host-specific wording.
 */
export type SchemaDegradedReason =
  | "cli-unavailable"
  | "cli-failed"
  | "cli-timeout"
  | "cli-unparsable";

/** One schema as it appears in the list: enough to render a row, never the instruction text. */
export interface SchemaSummary {
  name: string;
  description: string | null;
  source: SchemaSource;
  /**
   * Distinct dependency levels the schema's steps occupy — its stage count. Null when the schema's
   * definition could not be read.
   *
   * This is the only size a summary reports. A count of declared artifacts was carried here at
   * first and is deliberately gone: it is exact but reads as a number of files, and a step whose
   * output is a pattern produces one file per match.
   */
  stageCount: number | null;
  /** True when this is the schema named by the repo's openspec/config.yaml. */
  isDefault: boolean;
}

/** One artifact (workflow step) declared by a schema. */
export interface SchemaArtifactDef {
  id: string;
  /** The output path or glob this step produces, e.g. `proposal.md` or `specs/**\/*.md`. */
  generates: string | null;
  description: string | null;
  /** Artifact ids that must exist before this one can be written; empty when it declares none. */
  requires: string[];
  /** The schema's own guidance for this step, as authored (Markdown). */
  instruction: string | null;
}

/** A schema's apply step: when a change authored under it becomes implementable. */
export interface SchemaApplyDef {
  requires: string[];
  /** The file progress is tracked in, e.g. `tasks.md`. */
  tracks: string | null;
  instruction: string | null;
}

/** A same-named schema this one takes precedence over. */
export interface SchemaShadow {
  source: SchemaSource;
  path: string;
}

/** One schema's full definition, read from its schema.yaml. */
export interface SchemaDefinition {
  name: string;
  version: number | null;
  description: string | null;
  source: SchemaSource;
  /** Directory the schema resolved to (the parent of its schema.yaml). */
  path: string;
  /**
   * The same location written in the terms its source means: relative to the repo for a project
   * schema, `~`-prefixed for a user one, and stripped of the npm install prefix for a package one.
   * `path` remains the absolute truth.
   */
  displayPath: string;
  isDefault: boolean;
  /** Same-named schemas this one shadows; empty when it shadows nothing. */
  shadows: SchemaShadow[];
  /** Artifacts in the order the schema declares them — the authoritative sequence. */
  artifacts: SchemaArtifactDef[];
  apply: SchemaApplyDef | null;
}

/** Active changes declaring a schema. Counted from ChangeInfo.schema — no artifact reads. */
export interface SchemaUsage {
  count: number;
  slugs: string[];
}

/** A schema row as the API serves it: the summary plus who is using it. */
export interface SchemaSummaryWithUsage extends SchemaSummary {
  usage: SchemaUsage;
}

/**
 * Active changes whose declared schema matched no enumerated schema, grouped by that name (null
 * groups changes declaring no schema at all). Present so the per-schema counts reconcile against
 * the Changes page rather than quietly losing changes.
 */
export interface UnresolvedSchemaUsage {
  schema: string | null;
  count: number;
  slugs: string[];
}

/** The `/schemas` response: the catalog joined with change usage. */
export interface SchemasResponse {
  defaultSchema: string | null;
  schemas: SchemaSummaryWithUsage[];
  degradedReason: SchemaDegradedReason | null;
  unresolved: UnresolvedSchemaUsage[];
}

/**
 * Reading one schema either works or explains why not. "We could not look" (`cli-*`) and "it does
 * not exist" (`not-found`) are kept apart all the way to the view — only one of them is the user's
 * to fix.
 */
export type SchemaReadResult =
  | { ok: true; schema: SchemaDefinition }
  | { ok: false; reason: "not-found" | SchemaDegradedReason };

/** The schemas available to a repo, plus why the list may be incomplete. */
export interface SchemaCatalog {
  /**
   * The schema named by openspec/config.yaml, whether or not it resolved to an enumerated schema;
   * null when the repo declares none.
   */
  defaultSchema: string | null;
  schemas: SchemaSummary[];
  /** Set when package schemas could not be enumerated; null on a complete enumeration. */
  degradedReason: SchemaDegradedReason | null;
}

export type { TaskItem, TaskSection, TaskStats, ParsedTasks } from "./tasks.js";
