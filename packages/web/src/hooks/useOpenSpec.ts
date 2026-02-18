import { useState, useEffect, useCallback, useRef } from "react";
import { useRepo } from "../contexts/RepoContext";
import { useApiAdapter } from "../api/ApiAdapterContext";
import { useRefreshKey } from "../contexts/RefreshContext";
import type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  SpecVersionContent,
  HistoryEntry as SpecHistoryEntry,
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
} from "@spek/core";

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
};
export type { HistoryEntry as SpecHistoryEntry } from "@spek/core";

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
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: !!fetcher,
    error: null,
  });
  const isRefresh = useRef(false);
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

      fetcher()
        .then((data) => {
          if (!cancelled) setState({ data, loading: false, error: null });
        })
        .catch((err) => {
          if (!cancelled)
            setState((prev) => ({
              data: refreshTriggered ? prev.data : null,
              loading: false,
              error: err.message,
            }));
        });
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

export function useOverview(): FetchState<OverviewData> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath ? () => adapter.getOverview() : null,
    [repoPath],
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

export function useChanges(): FetchState<ChangesData> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath ? () => adapter.getChanges() : null,
    [repoPath],
  );
}

export function useChange(slug: string): FetchState<ChangeDetail> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath && slug ? () => adapter.getChange(slug) : null,
    [repoPath, slug],
  );
}

// --- Resync hook ---

export function useResync(): { resync: () => Promise<void>; loading: boolean } {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const [loading, setLoading] = useState(false);

  const resync = useCallback(async () => {
    if (!repoPath || loading) return;
    setLoading(true);
    try {
      await adapter.resync();
    } finally {
      setLoading(false);
    }
  }, [repoPath, loading, adapter]);

  return { resync, loading };
}

// --- Graph data hook ---

export function useGraphData(): FetchState<GraphData> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath ? () => adapter.getGraphData() : null,
    [repoPath],
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
