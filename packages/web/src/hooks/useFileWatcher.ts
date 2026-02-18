import { useEffect } from "react";
import { useRepo } from "../contexts/RepoContext";
import { useRefresh } from "../contexts/RefreshContext";

/**
 * 監聽 openspec 檔案變更，自動觸發 refresh。
 * 依據執行環境自動選擇實作：
 * - Web：SSE EventSource 連接 /api/openspec/watch
 * - VS Code：監聽 postMessage fileChanged 事件
 * - Demo：no-op
 */
export function useFileWatcher() {
  const { repoPath } = useRepo();
  const refresh = useRefresh();

  useEffect(() => {
    // Demo 環境：沒有 watcher
    if ((window as unknown as Record<string, unknown>).__DEMO_DATA__) {
      return;
    }

    // VS Code 環境：監聽 fileChanged message
    if ((window as unknown as Record<string, unknown>).__vscodeApi) {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "fileChanged") {
          refresh();
        }
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }

    // Web 環境：SSE EventSource
    if (!repoPath) return;

    const url = `/api/openspec/watch?dir=${encodeURIComponent(repoPath)}`;
    const source = new EventSource(url);

    source.onmessage = () => {
      refresh();
    };

    return () => {
      source.close();
    };
  }, [repoPath, refresh]);
}
