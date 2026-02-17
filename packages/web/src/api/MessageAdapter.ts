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

  private request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = `req-${++requestCounter}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (data: unknown) => void,
        reject,
      });

      this.vscode.postMessage({ type: "request", id, method, params });

      // 10 second timeout
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 10_000);
    });
  }

  getOverview(): Promise<OverviewData> {
    return this.request("getOverview");
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

  getChanges(): Promise<ChangesData> {
    return this.request("getChanges");
  }

  getChange(slug: string): Promise<ChangeDetail> {
    return this.request("getChange", { slug });
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

  getGraphData(): Promise<GraphData> {
    return this.request("getGraphData");
  }
}
