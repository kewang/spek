import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useRepo } from "../contexts/RepoContext";
import { useTheme } from "../contexts/ThemeContext";
import { useFileWatcher } from "../hooks/useFileWatcher";
import { Sidebar } from "./Sidebar";
import { SearchDialog } from "./SearchDialog";

export function Layout() {
  const { repoPath } = useRepo();
  const { theme, toggleTheme } = useTheme();
  useFileWatcher();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("spek-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("spek-sidebar-collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) setSidebarOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

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
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Open navigation menu"
            className="p-2 mr-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <span className="text-accent font-bold text-lg flex items-center gap-1.5">
          <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
            <path
              d="M 20 8.5 C 20 8.5, 23 8.5, 23 11.5 C 23 14.5, 20 16, 16 16 C 12 16, 9 17.5, 9 20.5 C 9 23.5, 12 23.5, 12 23.5"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path d="M 12.8 8.5 L 14.3 7 L 15.8 8.5 L 14.3 10 Z" fill="currentColor" opacity="0.9" />
            <path d="M 16.2 23.5 L 17.7 22 L 19.2 23.5 L 17.7 25 Z" fill="currentColor" opacity="0.7" />
          </svg>
          spek
        </span>
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
        <button
          onClick={toggleTheme}
          className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        {!isMobile && (
          <span className="text-text-muted text-sm font-mono truncate max-w-80" title={repoPath}>
            {repoPath}
          </span>
        )}
      </header>

      <Sidebar open={sidebarOpen} isMobile={isMobile} collapsed={collapsed} onClose={() => setSidebarOpen(false)} onToggle={toggleCollapsed} />

      {/* Main content */}
      <main className={`pt-18 p-6 transition-all duration-200 ${isMobile ? "" : collapsed ? "ml-14" : "ml-60"}`}>
        <Outlet />
      </main>

      <SearchDialog open={searchOpen} onClose={closeSearch} />
    </div>
  );
}
