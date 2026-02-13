import { useState, useEffect, useCallback } from "react";
import { useRepo } from "../contexts/RepoContext";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useFetch<T>(url: string | null): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: !!url,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

// --- OpenSpec API hooks ---

interface OverviewData {
  specsCount: number;
  changesCount: { active: number; archived: number };
  taskStats: { total: number; completed: number };
}

export function useOverview(): FetchState<OverviewData> {
  const { repoPath } = useRepo();
  const url = repoPath ? `/api/openspec/overview?dir=${encodeURIComponent(repoPath)}` : null;
  return useFetch<OverviewData>(url);
}

interface SpecInfo {
  topic: string;
  path: string;
}

export function useSpecs(): FetchState<SpecInfo[]> {
  const { repoPath } = useRepo();
  const url = repoPath ? `/api/openspec/specs?dir=${encodeURIComponent(repoPath)}` : null;
  return useFetch<SpecInfo[]>(url);
}

interface SpecHistoryEntry {
  slug: string;
  date: string | null;
  timestamp: string | null;
  description: string;
  status: "active" | "archived";
}

interface SpecDetail {
  topic: string;
  content: string;
  relatedChanges: string[];
  history: SpecHistoryEntry[];
}

export function useSpec(topic: string): FetchState<SpecDetail> {
  const { repoPath } = useRepo();
  const url =
    repoPath && topic
      ? `/api/openspec/specs/${encodeURIComponent(topic)}?dir=${encodeURIComponent(repoPath)}`
      : null;
  return useFetch<SpecDetail>(url);
}

interface TaskItem {
  text: string;
  completed: boolean;
}

interface TaskSection {
  title: string;
  tasks: TaskItem[];
}

interface ParsedTasks {
  total: number;
  completed: number;
  sections: TaskSection[];
}

interface ChangeInfo {
  slug: string;
  date: string | null;
  description: string;
  status: "active" | "archived";
  hasProposal: boolean;
  hasDesign: boolean;
  hasTasks: boolean;
  hasSpecs: boolean;
  taskStats: { total: number; completed: number } | null;
}

interface ChangesData {
  active: ChangeInfo[];
  archived: ChangeInfo[];
}

export function useChanges(): FetchState<ChangesData> {
  const { repoPath } = useRepo();
  const url = repoPath ? `/api/openspec/changes?dir=${encodeURIComponent(repoPath)}` : null;
  return useFetch<ChangesData>(url);
}

interface ChangeDetail {
  slug: string;
  proposal: string | null;
  design: string | null;
  tasks: ParsedTasks | null;
  specs: { topic: string; content: string }[];
  metadata: Record<string, unknown> | null;
}

export function useChange(slug: string): FetchState<ChangeDetail> {
  const { repoPath } = useRepo();
  const url =
    repoPath && slug
      ? `/api/openspec/changes/${encodeURIComponent(slug)}?dir=${encodeURIComponent(repoPath)}`
      : null;
  return useFetch<ChangeDetail>(url);
}

// --- Resync hook ---

export function useResync(): { resync: () => Promise<void>; loading: boolean } {
  const { repoPath } = useRepo();
  const [loading, setLoading] = useState(false);

  const resync = useCallback(async () => {
    if (!repoPath || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/openspec/resync?dir=${encodeURIComponent(repoPath)}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } finally {
      setLoading(false);
    }
  }, [repoPath, loading]);

  return { resync, loading };
}

// --- Filesystem API hooks ---

interface BrowseEntry {
  name: string;
  type: "directory" | "file";
  path: string;
}

interface BrowseData {
  path: string;
  entries: BrowseEntry[];
}

export function useBrowse(dirPath: string): FetchState<BrowseData> {
  const url = dirPath ? `/api/fs/browse?path=${encodeURIComponent(dirPath)}` : null;
  return useFetch<BrowseData>(url);
}

interface DetectData {
  hasOpenSpec: boolean;
  schema?: string;
}

export function useDetect(dirPath: string): FetchState<DetectData> {
  const url = dirPath ? `/api/fs/detect?path=${encodeURIComponent(dirPath)}` : null;
  return useFetch<DetectData>(url);
}

export type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  SpecHistoryEntry,
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
