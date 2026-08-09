export { parseTasks } from "./tasks.js";
export {
  scanOpenSpec,
  scanOpenSpecAggregated,
  readSpec,
  readChange,
  readSpecAtChange,
  findRelatedChanges,
  buildGraphData,
  buildGraphDataAggregated,
  parseSlug,
} from "./scanner.js";
export {
  listWorktrees,
  listWorkspaces,
  parseWorktreePorcelain,
  worktreeKey,
  toWorktreeSource,
} from "./worktrees.js";
export {
  listJjWorkspaces,
  parseJjWorkspaceList,
  jjCurrentChangeSlugs,
} from "./jj-workspaces.js";
export {
  getTimestamps,
  resyncTimestamps,
  buildChangeTimestamps,
} from "./git-cache.js";
export {
  listSchemas,
  readSchema,
  isSafeSchemaName,
  readDefaultSchema,
  listProjectSchemas,
  parseSchemaYaml,
  parseSchemasList,
  groupSchemaUsage,
  shortenSchemaPath,
  clearSchemaCache,
  // Test seam: lets a consumer's tests drive the openspec CLI with a stub instead of the real
  // binary, so they neither require it to be installed nor pay for spawning it.
  setOpenspecRunner,
} from "./schemas.js";
export type { OpenspecRunner, CliResult } from "./schemas.js";
export { extractHeadings, slugifyHeading } from "./headings.js";
export type { Heading } from "./headings.js";
// 同時由 ./graph-node-id subpath 匯出（node-free），供 browser bundle / 宿主 main process 使用。
export { changeNodeSlug } from "./graph-node-id.js";
export { listChangeMarkdownFiles } from "./artifacts.js";
export { shouldUsePolling, pollingInterval, withAuthoritativeChokidarEnv } from "./watch-polling.js";

export type {
  TaskItem,
  TaskSection,
  TaskStats,
  ParsedTasks,
  ArtifactKind,
  ChangeArtifact,
  SpecInfo,
  SpecDetail,
  HistoryEntry,
  ChangeInfo,
  ChangeDetail,
  ChangesData,
  OverviewData,
  ScanResult,
  AggregatedScanResult,
  WorktreeInfo,
  WorktreeSource,
  SearchResult,
  BrowseEntry,
  BrowseData,
  DetectData,
  SpecVersionContent,
  GraphNode,
  GraphEdge,
  GraphData,
  SchemaSource,
  SchemaDegradedReason,
  SchemaSummary,
  SchemaArtifactDef,
  SchemaApplyDef,
  SchemaShadow,
  SchemaDefinition,
  SchemaReadResult,
  SchemaCatalog,
  SchemaUsage,
  SchemaSummaryWithUsage,
  UnresolvedSchemaUsage,
  SchemasResponse,
} from "./types.js";

export {
  computeArtifactLevels,
  applyStepLevel,
  schemaStageCount,
} from "./schema-flow.js";
