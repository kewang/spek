import type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  SpecVersionContent,
  ChangesData,
  ChangeDetail,
  SearchResult,
  BrowseData,
  DetectData,
  GraphData,
  WorktreeInfo,
  SchemasResponse,
  SchemaReadResult,
} from "@spekjs/core";

export interface ApiAdapter {
  getOverview(aggregate?: boolean, includeJj?: boolean): Promise<OverviewData>;
  getSpecs(): Promise<SpecInfo[]>;
  getSpec(topic: string): Promise<SpecDetail>;
  getSpecAtChange(topic: string, slug: string): Promise<SpecVersionContent>;
  getChanges(aggregate?: boolean, includeJj?: boolean): Promise<ChangesData>;
  getChange(slug: string, wt?: string): Promise<ChangeDetail>;
  search(query: string): Promise<SearchResult[]>;
  browse(path: string): Promise<BrowseData>;
  detect(path: string): Promise<DetectData>;
  resync(): Promise<void>;
  getGraphData(aggregate?: boolean, includeJj?: boolean): Promise<GraphData>;
  getWorktrees(includeJj?: boolean): Promise<WorktreeInfo[]>;
  // Workflow schemas available to the repo. getSchema resolves rather than rejects when the schema
  // is unreadable, so the view can tell "does not exist" from "the CLI could not be consulted".
  getSchemas(aggregate?: boolean, includeJj?: boolean): Promise<SchemasResponse>;
  getSchema(name: string): Promise<SchemaReadResult>;
  // Read/write the aggregation-scope preference, abstracting each host's native storage:
  // Web = localStorage, VS Code = settings.
  getAggregationPrefs(): Promise<AggregationPrefs>;
  setAggregationPrefs(aggregate: boolean, includeJj: boolean): Promise<void>;
}

export interface AggregationPrefs {
  aggregate: boolean;
  includeJj: boolean;
}
