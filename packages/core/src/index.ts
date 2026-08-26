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
  parseSchemaYaml,
  parseSchemasList,
  groupSchemaUsage,
  countSchemaUsage,
  shortenSchemaPath,
  clearSchemaCache,
  affectsSchemas,
  // Test seam: lets a consumer's tests drive the openspec CLI with a stub instead of the real
  // binary, so they neither require it to be installed nor pay for spawning it.
  setOpenspecRunner,
} from "./schemas.js";
export type { OpenspecRunner, CliResult } from "./schemas.js";
export { extractHeadings, slugifyHeading, specHeadingLabel } from "./headings.js";
export type { Heading } from "./headings.js";
// 同時由 ./graph-node-id subpath 匯出（node-free），供 browser bundle / 宿主 main process 使用。
export { changeNodeSlug } from "./graph-node-id.js";
export { listChangeMarkdownFiles, listChangeArtifactFiles, DATA_EXTENSIONS } from "./artifact-files.js";
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
  levelArtifacts,
  resolveImplementationOrdering,
  postApplyArtifacts,
  applyStepLevel,
  schemaArtifactCount,
} from "./schema-flow.js";
// `RequiresNode` is a param of the level fns; `ArtifactLevelling` is `levelArtifacts`'s return. Both
// were unnameable from the root. `drawableEdges` and its `OriginEdge`/`OriginNode` stay subpath-only.
export type { OrderingSource, RequiresNode, ArtifactLevelling } from "./schema-flow.js";

// Also on the `@spekjs/core/cli-budget` subpath, for clients that must not pull in the index.
export { CLI_TIMEOUT_MS, CLI_CACHE_TTL_MS } from "./cli-budget.js";
