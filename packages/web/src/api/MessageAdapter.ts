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
import { CLI_TIMEOUT_MS } from "@spekjs/core/cli-budget";
import type { ApiAdapter, AggregationPrefs } from "./types.js";

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

interface ResponseMessage {
  type: "response";
  id: string;
  data?: unknown;
  error?: string;
}

let requestCounter = 0;

/** For work the host does in-process; anything this slow is broken rather than busy. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * For requests the host answers by spawning the CLI. Derived from the host's ceiling rather than
 * chosen to match it: a budget merely equal to `CLI_TIMEOUT_MS` expires just as the host gives up,
 * so the margin covers the host's own work either side of the CLI.
 */
const CLI_BACKED_TIMEOUT_MS = CLI_TIMEOUT_MS + 5_000;

export class MessageAdapter implements ApiAdapter {
  private vscode: VsCodeApi;
  private pending = new Map<string, { resolve: (data: unknown) => void; reject: (err: Error) => void }>();

  constructor() {
    // 從全域取得 main.webview.tsx 已建立的 vscode API instance
    this.vscode = (window as unknown as Record<string, unknown>).__vscodeApi as VsCodeApi;
    if (!this.vscode) {
      throw new Error("VS Code API not found. Ensure acquireVsCodeApi() is called before MessageAdapter.");
    }

    window.addEventListener("message", (event: MessageEvent) => {
      const msg = event.data as ResponseMessage;
      if (msg.type !== "response") return;
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        entry.reject(new Error(msg.error));
      } else {
        entry.resolve(msg.data);
      }
    });
  }

  private request<T>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    const id = `req-${++requestCounter}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (data: unknown) => void,
        reject,
      });

      this.vscode.postMessage({ type: "request", id, method, params });

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }

  getOverview(aggregate?: boolean, includeJj?: boolean): Promise<OverviewData> {
    return this.request("getOverview", { aggregate, includeJj });
  }

  getSpecs(): Promise<SpecInfo[]> {
    return this.request("getSpecs");
  }

  getSpec(topic: string): Promise<SpecDetail> {
    return this.request("getSpec", { topic });
  }

  getSpecAtChange(topic: string, slug: string): Promise<SpecVersionContent> {
    return this.request("getSpecAtChange", { topic, slug });
  }

  getChanges(aggregate?: boolean, includeJj?: boolean): Promise<ChangesData> {
    return this.request("getChanges", { aggregate, includeJj });
  }

  // CLI-backed less obviously: reading a change asks for its `schemaOrder`, via `openspec status`.
  getChange(slug: string, wt?: string): Promise<ChangeDetail> {
    return this.request("getChange", { slug, wt }, CLI_BACKED_TIMEOUT_MS);
  }

  search(query: string): Promise<SearchResult[]> {
    return this.request("search", { query });
  }

  browse(path: string): Promise<BrowseData> {
    return this.request("browse", { path });
  }

  detect(path: string): Promise<DetectData> {
    return this.request("detect", { path });
  }

  resync(): Promise<void> {
    return this.request("resync");
  }

  getGraphData(aggregate?: boolean, includeJj?: boolean): Promise<GraphData> {
    return this.request("getGraphData", { aggregate, includeJj });
  }

  getSchemas(aggregate?: boolean, includeJj?: boolean): Promise<SchemasResponse> {
    return this.request("getSchemas", { aggregate, includeJj }, CLI_BACKED_TIMEOUT_MS);
  }

  getSchema(name: string, aggregate?: boolean, includeJj?: boolean): Promise<SchemaReadResult> {
    return this.request("getSchema", { name, aggregate, includeJj }, CLI_BACKED_TIMEOUT_MS);
  }

  getWorktrees(includeJj?: boolean): Promise<WorktreeInfo[]> {
    return this.request("getWorktrees", { includeJj });
  }

  getAggregationPrefs(): Promise<AggregationPrefs> {
    return this.request("getAggregationPrefs");
  }

  setAggregationPrefs(aggregate: boolean, includeJj: boolean): Promise<void> {
    return this.request("setAggregationPrefs", { aggregate, includeJj });
  }
}
