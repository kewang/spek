import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepo } from "../contexts/RepoContext";
import { useBrowse, useDetect } from "../hooks/useOpenSpec";

export function SelectRepo() {
  const { setRepoPath, recentPaths } = useRepo();
  const navigate = useNavigate();

  const [inputPath, setInputPath] = useState("");
  const [browsePath, setBrowsePath] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);

  const detect = useDetect(inputPath);
  const browse = useBrowse(browsePath);

  function openRepo(repoPath: string) {
    setRepoPath(repoPath);
    navigate("/dashboard");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (detect.data?.hasOpenSpec) {
      openRepo(inputPath);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="w-full max-w-lg p-8">
        <h1 className="text-3xl font-bold text-accent mb-2 text-center">spek</h1>
        <p className="text-text-secondary text-center mb-8">OpenSpec Viewer</p>

        {/* 路徑輸入 */}
        <form onSubmit={handleSubmit} className="mb-6">
          <label className="block text-text-secondary text-sm mb-2">Repo path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              placeholder="/path/to/repo"
              className="flex-1 bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => {
                setBrowsePath(inputPath || "");
                setShowBrowser(!showBrowser);
              }}
              className="px-3 py-2 bg-bg-tertiary border border-border rounded text-text-secondary text-sm hover:text-text-primary transition-colors"
            >
              Browse
            </button>
          </div>

          {/* 偵測結果 */}
          {inputPath && !detect.loading && detect.data && (
            <div className="mt-3">
              {detect.data.hasOpenSpec ? (
                <div className="flex items-center justify-between">
                  <span className="text-green-400 text-sm">OpenSpec detected ({detect.data.schema})</span>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-accent text-bg-primary rounded text-sm font-medium hover:bg-accent-hover transition-colors"
                  >
                    Open
                  </button>
                </div>
              ) : (
                <span className="text-yellow-400 text-sm">No openspec/ directory found</span>
              )}
            </div>
          )}
          {inputPath && detect.loading && (
            <p className="mt-3 text-text-muted text-sm">Detecting...</p>
          )}
          {detect.error && (
            <p className="mt-3 text-red-400 text-sm">{detect.error}</p>
          )}
        </form>

        {/* 目錄瀏覽 */}
        {showBrowser && (
          <div className="mb-6 bg-bg-secondary border border-border rounded p-4 max-h-64 overflow-y-auto">
            {browse.loading && <p className="text-text-muted text-sm">Loading...</p>}
            {browse.error && <p className="text-red-400 text-sm">{browse.error}</p>}
            {browse.data && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-text-muted text-xs font-mono truncate">{browse.data.path}</span>
                  <button
                    onClick={() => {
                      setInputPath(browse.data!.path);
                    }}
                    className="text-accent text-xs hover:underline whitespace-nowrap"
                  >
                    Select this
                  </button>
                </div>
                <div className="space-y-0.5">
                  {/* 上層目錄 */}
                  <button
                    onClick={() => {
                      const parent = browse.data!.path.replace(/\/[^/]+$/, "") || "/";
                      setBrowsePath(parent);
                    }}
                    className="block w-full text-left px-2 py-1 text-sm text-text-secondary hover:bg-bg-tertiary rounded"
                  >
                    ..
                  </button>
                  {browse.data.entries
                    .filter((e) => e.type === "directory")
                    .map((entry) => (
                      <button
                        key={entry.path}
                        onClick={() => setBrowsePath(entry.path)}
                        className="block w-full text-left px-2 py-1 text-sm text-text-primary hover:bg-bg-tertiary rounded"
                      >
                        {entry.name}/
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 最近使用路徑 */}
        {recentPaths.length > 0 && (
          <div>
            <h3 className="text-text-secondary text-sm mb-2">Recent</h3>
            <div className="space-y-1">
              {recentPaths.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setInputPath(p);
                    openRepo(p);
                  }}
                  className="block w-full text-left px-3 py-2 bg-bg-secondary border border-border rounded text-sm text-text-primary font-mono hover:border-accent transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
