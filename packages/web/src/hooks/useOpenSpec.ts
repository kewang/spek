import { useState, useEffect, useCallback, useRef } from "react";
import { useRepo } from "../contexts/RepoContext";
import { useApiAdapter } from "../api/ApiAdapterContext";
import {
  useRefreshKey,
  useRefresh,
  useRefreshing,
  useBeginFetch,
} from "../contexts/RefreshContext";
import { runManualRefresh } from "../contexts/refreshTracker";
import { useAggregationScope } from "../contexts/AggregationScopeContext";
import type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  SpecVersionContent,
  ChangeInfo,
  ChangesData,
  ChangeDetail,
  ParsedTasks,
  TaskSection,
  TaskItem,
  BrowseEntry,
  BrowseData,
  DetectData,
  GraphData,
  SchemasResponse,
  SchemaReadResult,
  SchemaDefinition,
  SchemaSummaryWithUsage,
} from "@spekjs/core";

// Re-export types for existing consumers
export type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  SpecVersionContent,
  ChangeInfo,
  ChangesData,
  ChangeDetail,
  ParsedTasks,
  TaskSection,
  TaskItem,
  BrowseEntry,
  BrowseData,
  DetectData,
  SchemasResponse,
  SchemaReadResult,
  SchemaDefinition,
  SchemaSummaryWithUsage,
};
export type { HistoryEntry as SpecHistoryEntry } from "@spekjs/core";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsyncData<T>(
  fetcher: (() => Promise<T>) | null,
  deps: unknown[],
): FetchState<T> {
  const refreshKey = useRefreshKey();
  const beginFetch = useBeginFetch();
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: !!fetcher,
    error: null,
  });
  const prevRefreshKey = useRef(refreshKey);

  useEffect(() => {
    // 判斷是否為 refreshKey 觸發的 re-fetch
    const refreshTriggered = prevRefreshKey.current !== refreshKey;
    prevRefreshKey.current = refreshKey;

    if (!fetcher) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;

    const doFetch = () => {
      // refreshKey 觸發時保留既有 data，不顯示 loading flash
      if (!refreshTriggered) {
        setState({ data: null, loading: true, error: null });
      }

      // 向 RefreshContext 回報在途狀態，手動刷新的忙碌狀態才能撐到資料真正抵達
      const endFetch = beginFetch();

      fetcher()
        .then((data) => {
          if (!cancelled) setState({ data, loading: false, error: null });
        })
        .catch((err) => {
          if (!cancelled)
            setState((prev) => ({
              data: refreshTriggered ? prev.data : null,
              loading: false,
              error: refreshTriggered && prev.data ? null : err.message,
            }));
        })
        .finally(endFetch);
    };

    // refreshKey 觸發時加 debounce 300ms
    if (refreshTriggered) {
      const timer = setTimeout(doFetch, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    doFetch();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey]);

  return state;
}

// --- OpenSpec API hooks ---

export function useOverview(
  aggregate?: boolean,
  includeJj?: boolean,
): FetchState<OverviewData> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const scope = useAggregationScope();
  const agg = aggregate ?? scope.aggregate;
  const jj = includeJj ?? scope.includeJj;
  return useAsyncData(
    repoPath ? () => adapter.getOverview(agg, jj) : null,
    [repoPath, agg, jj],
  );
}

export function useSpecs(): FetchState<SpecInfo[]> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath ? () => adapter.getSpecs() : null,
    [repoPath],
  );
}

export function useSpec(topic: string): FetchState<SpecDetail> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath && topic ? () => adapter.getSpec(topic) : null,
    [repoPath, topic],
  );
}

export function useSpecAtChange(topic: string, slug: string): FetchState<SpecVersionContent> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath && topic && slug ? () => adapter.getSpecAtChange(topic, slug) : null,
    [repoPath, topic, slug],
  );
}

export function useChanges(
  aggregate?: boolean,
  includeJj?: boolean,
): FetchState<ChangesData> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const scope = useAggregationScope();
  const agg = aggregate ?? scope.aggregate;
  const jj = includeJj ?? scope.includeJj;
  return useAsyncData(
    repoPath ? () => adapter.getChanges(agg, jj) : null,
    [repoPath, agg, jj],
  );
}

export function useChange(slug: string, wt?: string): FetchState<ChangeDetail> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath && slug ? () => adapter.getChange(slug, wt) : null,
    [repoPath, slug, wt],
  );
}

// --- Manual refresh hook ---

/**
 * 手動 Refresh：讓伺服端該失效的失效，然後重新取數。
 *
 * 核心不變式：**快取失效失敗不得阻擋重新取數**。resync 是 best-effort —— 宿主可能根本沒有這個
 * 端點、或沒有任何快取需要失效。因此它的錯誤在此吞掉（不得逸出成 unhandled rejection），
 * `refresh(true)` 一律在 finally 執行。這個保證放在 hook 裡而非呼叫端，否則下一個呼叫者就會漏掉。
 *
 * `loading` 涵蓋整段操作：resync 的往返，加上 refreshKey 觸發的重取直到資料抵達（refreshing）。
 * 只涵蓋 resync 那個 POST 的話，spinner 會在資料落地前就停 —— 一顆對「我做完了」說謊的按鈕。
 */
export function useRefreshData(): { refreshData: () => Promise<void>; loading: boolean } {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const refresh = useRefresh();
  const refreshing = useRefreshing();
  const [resyncing, setResyncing] = useState(false);
  const loading = resyncing || refreshing;

  const refreshData = useCallback(async () => {
    if (!repoPath || resyncing) return;
    setResyncing(true);
    try {
      // 不變式（resync 失敗不得阻擋重新取數）住在 runManualRefresh 裡，見 refreshTracker.ts
      await runManualRefresh(() => adapter.resync(), refresh);
    } finally {
      setResyncing(false);
    }
  }, [repoPath, resyncing, adapter, refresh]);

  return { refreshData, loading };
}

// --- Graph data hook ---

export function useGraphData(
  aggregate?: boolean,
  includeJj?: boolean,
): FetchState<GraphData> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const scope = useAggregationScope();
  const agg = aggregate ?? scope.aggregate;
  const jj = includeJj ?? scope.includeJj;
  return useAsyncData(
    repoPath ? () => adapter.getGraphData(agg, jj) : null,
    [repoPath, agg, jj],
  );
}

// --- Schema hooks ---

export function useSchemas(
  aggregate?: boolean,
  includeJj?: boolean,
): FetchState<SchemasResponse> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const scope = useAggregationScope();
  const agg = aggregate ?? scope.aggregate;
  const jj = includeJj ?? scope.includeJj;
  return useAsyncData(
    repoPath ? () => adapter.getSchemas(agg, jj) : null,
    [repoPath, agg, jj],
  );
}

// An unreadable schema is data, not an error: the result carries whether it does not exist or
// could not be looked up, and the view says which.
// The aggregation scope rides along because the result carries a usage count, which is counted over
// active changes — so it has to be counted over the same set of changes the list page counted, or
// clicking a row shows a different number than the row did.
export function useSchema(name: string): FetchState<SchemaReadResult> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const scope = useAggregationScope();
  const { aggregate, includeJj } = scope;
  return useAsyncData(
    repoPath && name ? () => adapter.getSchema(name, aggregate, includeJj) : null,
    [repoPath, name, aggregate, includeJj],
  );
}

// --- Filesystem API hooks ---

export function useBrowse(dirPath: string): FetchState<BrowseData> {
  const adapter = useApiAdapter();
  return useAsyncData(
    dirPath ? () => adapter.browse(dirPath) : null,
    [dirPath],
  );
}

export function useDetect(dirPath: string): FetchState<DetectData> {
  const adapter = useApiAdapter();
  return useAsyncData(
    dirPath ? () => adapter.detect(dirPath) : null,
    [dirPath],
  );
}
