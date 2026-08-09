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
  SchemaDefinition,
} from "@spekjs/core";
import type { ApiAdapter, AggregationPrefs } from "./types.js";
import { getAggregatePref, setAggregatePref } from "../utils/aggregatePref.js";
import { getJjWorkspacePref, setJjWorkspacePref } from "../utils/jjWorkspacePref.js";

export interface DemoData {
  overview: OverviewData;
  specs: SpecInfo[];
  specDetails: Record<string, SpecDetail>;
  changes: ChangesData;
  changeDetails: Record<string, ChangeDetail>;
  specVersions: Record<string, Record<string, string>>;
  graphData: GraphData;
  // Captured at build time, so the demo needs no openspec CLI and no filesystem at view time.
  // Optional: a demo payload built before schema browsing existed still loads.
  schemas?: SchemasResponse;
  schemaDetails?: Record<string, SchemaDefinition>;
}

export class StaticAdapter implements ApiAdapter {
  private data: DemoData;

  constructor() {
    this.data = (window as unknown as Record<string, unknown>).__DEMO_DATA__ as DemoData;
    if (!this.data) {
      throw new Error("Demo data not found. Ensure __DEMO_DATA__ is set.");
    }
  }

  getOverview(): Promise<OverviewData> {
    return Promise.resolve(this.data.overview);
  }

  getSpecs(): Promise<SpecInfo[]> {
    return Promise.resolve(this.data.specs);
  }

  getSpec(topic: string): Promise<SpecDetail> {
    const spec = this.data.specDetails[topic];
    if (!spec) return Promise.reject(new Error(`Spec not found: ${topic}`));
    return Promise.resolve(spec);
  }

  getSpecAtChange(topic: string, slug: string): Promise<SpecVersionContent> {
    const versions = this.data.specVersions?.[topic];
    const content = versions?.[slug];
    if (content === undefined) return Promise.reject(new Error(`Spec version not found: ${topic}@${slug}`));
    return Promise.resolve({ content });
  }

  getChanges(): Promise<ChangesData> {
    return Promise.resolve(this.data.changes);
  }

  getChange(slug: string): Promise<ChangeDetail> {
    const change = this.data.changeDetails[slug];
    if (!change) return Promise.reject(new Error(`Change not found: ${slug}`));
    return Promise.resolve(change);
  }

  search(query: string): Promise<SearchResult[]> {
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    // 搜尋 specs
    for (const [topic, detail] of Object.entries(this.data.specDetails)) {
      if (detail.content.toLowerCase().includes(q) || topic.toLowerCase().includes(q)) {
        const idx = detail.content.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 60);
        const end = Math.min(detail.content.length, idx + query.length + 60);
        const context = (start > 0 ? "..." : "") + detail.content.slice(start, end) + (end < detail.content.length ? "..." : "");
        results.push({ type: "spec", title: topic, topic, context });
      }
    }

    // 搜尋 changes：合併所有 markdown artifact 內容（不再限定 proposal/design）
    for (const [slug, detail] of Object.entries(this.data.changeDetails)) {
      const texts = detail.artifacts
        .map((a) => a.content)
        .filter((c): c is string => Boolean(c));
      const combined = texts.join("\n");
      if (combined.toLowerCase().includes(q) || slug.toLowerCase().includes(q)) {
        const idx = combined.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 60);
        const end = Math.min(combined.length, idx + query.length + 60);
        const context = idx >= 0
          ? (start > 0 ? "..." : "") + combined.slice(start, end) + (end < combined.length ? "..." : "")
          : slug;
        results.push({ type: "change", title: slug, slug, context });
      }
    }

    return Promise.resolve(results);
  }

  browse(): Promise<BrowseData> {
    return Promise.resolve({ path: "/", entries: [] });
  }

  detect(): Promise<DetectData> {
    return Promise.resolve({ hasOpenSpec: true });
  }

  async resync(): Promise<void> {
    // no-op
  }

  getGraphData(): Promise<GraphData> {
    return Promise.resolve(this.data.graphData);
  }

  // The demo is a single source (no cross-worktree aggregation); return the embedded worktree list,
  // which is usually empty.
  getWorktrees(): Promise<WorktreeInfo[]> {
    return Promise.resolve(this.data.changes.worktrees ?? []);
  }

  getSchemas(): Promise<SchemasResponse> {
    return Promise.resolve(
      this.data.schemas ?? {
        defaultSchema: null,
        schemas: [],
        degradedReason: null,
        unresolved: [],
      },
    );
  }

  getSchema(name: string): Promise<SchemaReadResult> {
    const schema = this.data.schemaDetails?.[name];
    return Promise.resolve(schema ? { ok: true, schema } : { ok: false, reason: "not-found" });
  }

  getAggregationPrefs(): Promise<AggregationPrefs> {
    return Promise.resolve({ aggregate: getAggregatePref(), includeJj: getJjWorkspacePref() });
  }

  setAggregationPrefs(aggregate: boolean, includeJj: boolean): Promise<void> {
    setAggregatePref(aggregate);
    setJjWorkspacePref(includeJj);
    return Promise.resolve();
  }
}
