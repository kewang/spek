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
import type { ApiAdapter, AggregationPrefs } from "./types.js";
import { getAggregatePref, setAggregatePref } from "../utils/aggregatePref.js";
import { getJjWorkspacePref, setJjWorkspacePref } from "../utils/jjWorkspacePref.js";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as Record<string, string>)?.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface FetchAdapterOptions {
  baseUrl?: string;
  dirParam?: string;
}

/**
 * Query-string fragment for the aggregation params. The server defaults differ, so the
 * "omit when default" polarity differs per param:
 *  - `aggregate` defaults **on**  → only send `aggregate=false` when explicitly off.
 *  - `jj`        defaults **off** (experimental, opt-in) → only send `jj=true` when explicitly on.
 * (Sending `jj=false` when off is a no-op that hid the real bug: the toggle-on case sent nothing.)
 */
export function aggQuery(aggregate?: boolean, includeJj?: boolean): string {
  return (
    (aggregate === false ? "&aggregate=false" : "") +
    (includeJj === true ? "&jj=true" : "")
  );
}

export class FetchAdapter implements ApiAdapter {
  private baseUrl: string;
  private dirParam: string;

  constructor(private repoPath: string, options?: FetchAdapterOptions) {
    this.baseUrl = options?.baseUrl || "/api";
    this.dirParam = options?.dirParam || "dir";
  }

  private q(): string {
    return `${this.dirParam}=${encodeURIComponent(this.repoPath)}`;
  }

  private agg(aggregate?: boolean, includeJj?: boolean): string {
    return aggQuery(aggregate, includeJj);
  }

  getOverview(aggregate?: boolean, includeJj?: boolean): Promise<OverviewData> {
    return fetchJson(`${this.baseUrl}/openspec/overview?${this.q()}${this.agg(aggregate, includeJj)}`);
  }

  getSpecs(): Promise<SpecInfo[]> {
    return fetchJson(`${this.baseUrl}/openspec/specs?${this.q()}`);
  }

  getSpec(topic: string): Promise<SpecDetail> {
    return fetchJson(`${this.baseUrl}/openspec/specs/${encodeURIComponent(topic)}?${this.q()}`);
  }

  getSpecAtChange(topic: string, slug: string): Promise<SpecVersionContent> {
    return fetchJson(`${this.baseUrl}/openspec/specs/${encodeURIComponent(topic)}/at/${encodeURIComponent(slug)}?${this.q()}`);
  }

  getChanges(aggregate?: boolean, includeJj?: boolean): Promise<ChangesData> {
    return fetchJson(`${this.baseUrl}/openspec/changes?${this.q()}${this.agg(aggregate, includeJj)}`);
  }

  getChange(slug: string, wt?: string): Promise<ChangeDetail> {
    const wtParam = wt ? `&wt=${encodeURIComponent(wt)}` : "";
    return fetchJson(`${this.baseUrl}/openspec/changes/${encodeURIComponent(slug)}?${this.q()}${wtParam}`);
  }

  search(query: string): Promise<SearchResult[]> {
    return fetchJson(`${this.baseUrl}/openspec/search?${this.q()}&q=${encodeURIComponent(query)}`);
  }

  browse(path: string): Promise<BrowseData> {
    return fetchJson(`${this.baseUrl}/fs/browse?path=${encodeURIComponent(path)}`);
  }

  detect(path: string): Promise<DetectData> {
    return fetchJson(`${this.baseUrl}/fs/detect?path=${encodeURIComponent(path)}`);
  }

  async resync(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/openspec/resync?${this.q()}`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  getGraphData(aggregate?: boolean, includeJj?: boolean): Promise<GraphData> {
    return fetchJson(`${this.baseUrl}/openspec/graph?${this.q()}${this.agg(aggregate, includeJj)}`);
  }

  getWorktrees(includeJj?: boolean): Promise<WorktreeInfo[]> {
    const jj = includeJj === true ? "&jj=true" : "";
    return fetchJson(`${this.baseUrl}/openspec/worktrees?${this.q()}${jj}`);
  }

  getSchemas(aggregate?: boolean, includeJj?: boolean): Promise<SchemasResponse> {
    return fetchJson(`${this.baseUrl}/openspec/schemas?${this.q()}${this.agg(aggregate, includeJj)}`);
  }

  // A 404 here is an answer, not a failure: the body carries whether the schema does not exist or
  // could not be looked up. Anything else still throws.
  //
  // The body carries `usage` alongside the definition's own fields; it is split back out here so the
  // client type keeps the two apart — one comes from the schema.yaml, the other from the repo.
  async getSchema(name: string, aggregate?: boolean, includeJj?: boolean): Promise<SchemaReadResult> {
    const res = await fetch(
      `${this.baseUrl}/openspec/schemas/${encodeURIComponent(name)}?${this.q()}${this.agg(aggregate, includeJj)}`,
    );
    if (res.ok) {
      const { usage = null, ...schema } = await res.json();
      return { ok: true, schema, usage };
    }
    if (res.status === 404) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, reason: body.reason ?? "not-found" };
    }
    throw new Error(`HTTP ${res.status}`);
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
