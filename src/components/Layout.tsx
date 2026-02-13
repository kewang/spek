import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useRepo } from "../contexts/RepoContext";
import { Sidebar } from "./Sidebar";
import { SearchDialog } from "./SearchDialog";

export function Layout() {
  const { repoPath } = useRepo();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!repoPath) {
      navigate("/", { replace: true });
    }
  }, [repoPath, navigate]);

  // Cmd+K / Ctrl+K 全域快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  if (!repoPath) return null;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-bg-secondary border-b border-border flex items-center px-4 z-10">
        <span className="text-accent font-bold text-lg">spek</span>
        <div className="flex-1 flex justify-center">
          <button
            onClick={() => setSearchOpen(true)}
            className="px-4 py-1.5 rounded bg-bg-tertiary text-text-muted text-sm hover:text-text-secondary hover:bg-bg-tertiary/80 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search...
            <kbd className="text-xs bg-bg-primary/50 px-1.5 py-0.5 rounded border border-border ml-2">
              ⌘K
            </kbd>
          </button>
        </div>
        <span className="text-text-muted text-sm font-mono truncate max-w-80" title={repoPath}>
          {repoPath}
        </span>
      </header>

      <Sidebar />

      {/* Main content */}
      <main className="ml-60 pt-14 p-6">
        <Outlet />
      </main>

      <SearchDialog open={searchOpen} onClose={closeSearch} />
    </div>
  );
}
