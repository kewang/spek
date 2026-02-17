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
} from "@spek/core";

export interface ApiAdapter {
  getOverview(): Promise<OverviewData>;
  getSpecs(): Promise<SpecInfo[]>;
  getSpec(topic: string): Promise<SpecDetail>;
  getSpecAtChange(topic: string, slug: string): Promise<SpecVersionContent>;
  getChanges(): Promise<ChangesData>;
  getChange(slug: string): Promise<ChangeDetail>;
  search(query: string): Promise<SearchResult[]>;
  browse(path: string): Promise<BrowseData>;
  detect(path: string): Promise<DetectData>;
  resync(): Promise<void>;
  getGraphData(): Promise<GraphData>;
}
