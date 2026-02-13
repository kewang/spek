import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const STORAGE_KEY = "spek:recent-paths";
const MAX_RECENT = 5;

interface RepoContextValue {
  repoPath: string;
  setRepoPath: (path: string) => void;
  recentPaths: string[];
  clearRepoPath: () => void;
  removePath: (path: string) => void;
}

const RepoContext = createContext<RepoContextValue | null>(null);

function loadRecentPaths(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentPath(newPath: string) {
  const paths = loadRecentPaths().filter((p) => p !== newPath);
  paths.unshift(newPath);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths.slice(0, MAX_RECENT)));
}

export function RepoProvider({ children }: { children: ReactNode }) {
  const [repoPath, setRepoPathState] = useState("");
  const [recentPaths, setRecentPaths] = useState(loadRecentPaths);

  const setRepoPath = useCallback((path: string) => {
    setRepoPathState(path);
    if (path) {
      saveRecentPath(path);
      setRecentPaths(loadRecentPaths());
    }
  }, []);

  const clearRepoPath = useCallback(() => {
    setRepoPathState("");
  }, []);

  const removePath = useCallback((pathToRemove: string) => {
    const updated = loadRecentPaths().filter((p) => p !== pathToRemove);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setRecentPaths(updated);
  }, []);

  return (
    <RepoContext.Provider value={{ repoPath, setRepoPath, recentPaths, clearRepoPath, removePath }}>
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo(): RepoContextValue {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error("useRepo must be used within RepoProvider");
  return ctx;
}
