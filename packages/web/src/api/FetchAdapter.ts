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
import type { ApiAdapter } from "./types.js";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export class FetchAdapter implements ApiAdapter {
  constructor(private repoPath: string) {}

  private q(): string {
    return `dir=${encodeURIComponent(this.repoPath)}`;
  }

  getOverview(): Promise<OverviewData> {
    return fetchJson(`/api/openspec/overview?${this.q()}`);
  }

  getSpecs(): Promise<SpecInfo[]> {
    return fetchJson(`/api/openspec/specs?${this.q()}`);
  }

  getSpec(topic: string): Promise<SpecDetail> {
    return fetchJson(`/api/openspec/specs/${encodeURIComponent(topic)}?${this.q()}`);
  }

  getSpecAtChange(topic: string, slug: string): Promise<SpecVersionContent> {
    return fetchJson(`/api/openspec/specs/${encodeURIComponent(topic)}/at/${encodeURIComponent(slug)}?${this.q()}`);
  }

  getChanges(): Promise<ChangesData> {
    return fetchJson(`/api/openspec/changes?${this.q()}`);
  }

  getChange(slug: string): Promise<ChangeDetail> {
    return fetchJson(`/api/openspec/changes/${encodeURIComponent(slug)}?${this.q()}`);
  }

  search(query: string): Promise<SearchResult[]> {
    return fetchJson(`/api/openspec/search?${this.q()}&q=${encodeURIComponent(query)}`);
  }

  browse(path: string): Promise<BrowseData> {
    return fetchJson(`/api/fs/browse?path=${encodeURIComponent(path)}`);
  }

  detect(path: string): Promise<DetectData> {
    return fetchJson(`/api/fs/detect?path=${encodeURIComponent(path)}`);
  }

  async resync(): Promise<void> {
    const res = await fetch(`/api/openspec/resync?${this.q()}`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  getGraphData(): Promise<GraphData> {
    return fetchJson(`/api/openspec/graph?${this.q()}`);
  }
}
