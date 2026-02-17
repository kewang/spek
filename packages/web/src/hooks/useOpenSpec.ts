import { useState, useEffect, useCallback } from "react";
import { useRepo } from "../contexts/RepoContext";
import { useApiAdapter } from "../api/ApiAdapterContext";
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
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: !!fetcher,
    error: null,
  });

  useEffect(() => {
    if (!fetcher) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ data: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

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
