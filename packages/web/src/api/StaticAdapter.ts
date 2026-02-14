import type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  ChangesData,
  ChangeDetail,
  SearchResult,
  BrowseData,
  DetectData,
} from "@spek/core";
import type { ApiAdapter } from "./types.js";

export interface DemoData {
  overview: OverviewData;
  specs: SpecInfo[];
  specDetails: Record<string, SpecDetail>;
  changes: ChangesData;
  changeDetails: Record<string, ChangeDetail>;
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

    // 搜尋 changes
    for (const [slug, detail] of Object.entries(this.data.changeDetails)) {
      const texts = [detail.proposal, detail.design].filter(Boolean) as string[];
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
}
