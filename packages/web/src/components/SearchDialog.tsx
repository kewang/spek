import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApiAdapter } from "../api/ApiAdapterContext";
import type { SearchResult } from "@spek/core";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

type TypeFilter = "all" | "spec" | "change";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!text || !query.trim()) return <>{text ?? ""}</>;

  const escaped = escapeRegex(query.trim());
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i} className="bg-accent/20 text-accent rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function useSearch(query: string) {
  const adapter = useApiAdapter();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      adapter
        .search(query.trim())
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
  }, [query, adapter]);

  return { results, loading };
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { results, loading } = useSearch(query);

  // 按類型分組
  const specResults = results.filter((r) => r.type === "spec");
  const changeResults = results.filter((r) => r.type === "change");

  const filteredSpecResults = typeFilter === "change" ? [] : specResults;
  const filteredChangeResults = typeFilter === "spec" ? [] : changeResults;
  const flatResults = useMemo(
    () => [...filteredSpecResults, ...filteredChangeResults],
    [filteredSpecResults, filteredChangeResults]
  );

  // 開啟時 focus 輸入框並重設狀態
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTypeFilter("all");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // 選取索引隨結果變動重設
  useEffect(() => {
    setSelectedIndex(0);
  }, [results, typeFilter]);

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      const path =
        result.type === "spec"
          ? `/specs/${encodeURIComponent(result.topic ?? result.title)}`
          : `/changes/${encodeURIComponent(result.slug ?? result.title)}`;
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

  const filterButtons: { label: string; value: TypeFilter }[] = [
    { label: "All", value: "all" },
    { label: "Specs", value: "spec" },
    { label: "Changes", value: "change" },
  ];

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

        {/* 類型 filter */}
        {query.trim() && !loading && results.length > 0 && (
          <div className="flex gap-1 px-4 pt-2">
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setTypeFilter(btn.value)}
                className={`px-2.5 py-0.5 text-xs rounded-full transition-colors cursor-pointer ${
                  typeFilter === btn.value
                    ? "bg-accent/20 text-accent"
                    : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

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
            <div className="text-center p-4">
              <p className="text-text-muted text-sm">No results found</p>
              <p className="text-text-muted text-xs mt-1">Try different keywords or check the spelling</p>
            </div>
          )}

          {!loading && filteredSpecResults.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Specs
              </div>
              {filteredSpecResults.map((result) => {
                const idx = globalIndex++;
                return (
                  <ResultItem
                    key={`spec-${result.title}`}
                    result={result}
                    query={query}
                    selected={idx === selectedIndex}
                    onClick={() => navigateToResult(result)}
                  />
                );
              })}
            </div>
          )}

          {!loading && filteredChangeResults.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Changes
              </div>
              {filteredChangeResults.map((result) => {
                const idx = globalIndex++;
                return (
                  <ResultItem
                    key={`change-${result.title}`}
                    result={result}
                    query={query}
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
  query,
  selected,
  onClick,
}: {
  result: SearchResult;
  query: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 cursor-pointer transition-colors ${
        selected ? "bg-bg-tertiary" : "hover:bg-bg-tertiary/50"
      }`}
    >
      <div className="text-sm font-medium text-text-primary">
        <HighlightText text={result.title} query={query} />
      </div>
      {result.context && (
        <div className="text-xs text-text-muted mt-0.5 truncate">
          <HighlightText text={result.context} query={query} />
        </div>
      )}
    </button>
  );
}
