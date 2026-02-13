import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRepo } from "../contexts/RepoContext";

interface SearchMatch {
  text: string;
  context: string;
}

interface SearchResult {
  type: "spec" | "change";
  name: string;
  matches: SearchMatch[];
  score: number;
}

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

function useSearch(query: string) {
  const { repoPath } = useRepo();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || !repoPath) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/openspec/search?dir=${encodeURIComponent(repoPath)}&q=${encodeURIComponent(query.trim())}`
      )
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          setResults(data);
          setLoading(false);
        })
        .catch(() => {
          setResults([]);
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, repoPath]);

  return { results, loading };
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { results, loading } = useSearch(query);

  // 按類型分組
  const specResults = results.filter((r) => r.type === "spec");
  const changeResults = results.filter((r) => r.type === "change");
  const flatResults = [...specResults, ...changeResults];

  // 開啟時 focus 輸入框並重設狀態
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // 選取索引隨結果變動重設
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      const path =
        result.type === "spec"
          ? `/specs/${encodeURIComponent(result.name)}`
          : `/changes/${encodeURIComponent(result.name)}`;
      navigate(path);
      onClose();
    },
    [navigate, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatResults[selectedIndex]) {
          navigateToResult(flatResults[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [flatResults, selectedIndex, navigateToResult, onClose]
  );

  if (!open) return null;

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-xl bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden">
        {/* 搜尋輸入 */}
        <div className="flex items-center border-b border-border px-4">
          <svg className="w-5 h-5 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search specs and changes..."
            className="flex-1 bg-transparent text-text-primary px-3 py-3 text-sm outline-none placeholder:text-text-muted"
          />
          <kbd className="text-xs text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* 結果區域 */}
        <div className="max-h-80 overflow-y-auto">
          {!query.trim() && (
            <p className="text-text-muted text-sm p-4 text-center">
              Type to search across specs and changes...
            </p>
          )}

          {query.trim() && loading && (
            <p className="text-text-muted text-sm p-4 text-center">Searching...</p>
          )}

          {query.trim() && !loading && flatResults.length === 0 && (
            <p className="text-text-muted text-sm p-4 text-center">No results found</p>
          )}

          {!loading && specResults.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Specs
              </div>
              {specResults.map((result) => {
                const idx = globalIndex++;
                return (
                  <ResultItem
                    key={`spec-${result.name}`}
                    result={result}
                    selected={idx === selectedIndex}
                    onClick={() => navigateToResult(result)}
                  />
                );
              })}
            </div>
          )}

          {!loading && changeResults.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Changes
              </div>
              {changeResults.map((result) => {
                const idx = globalIndex++;
                return (
                  <ResultItem
                    key={`change-${result.name}`}
                    result={result}
                    selected={idx === selectedIndex}
                    onClick={() => navigateToResult(result)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultItem({
  result,
  selected,
  onClick,
}: {
  result: SearchResult;
  selected: boolean;
  onClick: () => void;
}) {
  const preview = result.matches[0]?.context ?? "";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 cursor-pointer transition-colors ${
        selected ? "bg-bg-tertiary" : "hover:bg-bg-tertiary/50"
      }`}
    >
      <div className="text-sm font-medium text-text-primary">{result.name}</div>
      {preview && (
        <div className="text-xs text-text-muted mt-0.5 truncate">{preview}</div>
      )}
    </button>
  );
}
