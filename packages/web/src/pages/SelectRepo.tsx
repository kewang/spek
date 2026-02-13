import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRepo } from "../contexts/RepoContext";
import { useBrowse, useDetect } from "../hooks/useOpenSpec";

type PathStatus = "checking" | "valid" | "invalid";

export function SelectRepo() {
  const { setRepoPath, recentPaths, removePath } = useRepo();
  const navigate = useNavigate();

  const [inputPath, setInputPath] = useState("");
  const [browsePath, setBrowsePath] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [pathStatuses, setPathStatuses] = useState<Record<string, PathStatus>>({});

  const detect = useDetect(inputPath);
  const browse = useBrowse(browsePath);

  // 非同步驗證最近路徑
  useEffect(() => {
    if (recentPaths.length === 0) return;
    const initial: Record<string, PathStatus> = {};
    for (const p of recentPaths) initial[p] = "checking";
    setPathStatuses(initial);

    for (const p of recentPaths) {
      fetch(`/api/fs/detect?path=${encodeURIComponent(p)}`)
        .then((res) => res.json())
        .then((data) => {
          setPathStatuses((prev) => ({ ...prev, [p]: data.hasOpenSpec ? "valid" : "invalid" }));
        })
        .catch(() => {
          setPathStatuses((prev) => ({ ...prev, [p]: "invalid" }));
        });
    }
  }, [recentPaths]);

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
              {recentPaths.map((p) => {
                const status = pathStatuses[p];
                return (
                  <div key={p} className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setInputPath(p);
                        if (status === "valid") openRepo(p);
                      }}
                      className="flex-1 text-left px-3 py-2 bg-bg-secondary border border-border rounded text-sm text-text-primary font-mono hover:border-accent transition-colors flex items-center gap-2"
                    >
                      {/* 狀態指標 */}
                      {status === "checking" && (
                        <span className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      )}
                      {status === "valid" && (
                        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {status === "invalid" && (
                        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className="truncate">{p}</span>
                    </button>
                    {status === "invalid" && (
                      <button
                        onClick={() => removePath(p)}
                        className="p-2 text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
                        title="Remove path"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
