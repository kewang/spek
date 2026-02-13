import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useRepo } from "../contexts/RepoContext";
import { Sidebar } from "./Sidebar";

export function Layout() {
  const { repoPath } = useRepo();
  const navigate = useNavigate();

  useEffect(() => {
    if (!repoPath) {
      navigate("/", { replace: true });
    }
  }, [repoPath, navigate]);

  if (!repoPath) return null;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-bg-secondary border-b border-border flex items-center px-4 z-10">
        <span className="text-accent font-bold text-lg">spek</span>
        <div className="flex-1 flex justify-center">
          <button
            disabled
            className="px-4 py-1.5 rounded bg-bg-tertiary text-text-muted text-sm cursor-not-allowed"
          >
            Search...
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
    </div>
  );
}
