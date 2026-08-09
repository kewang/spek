import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { HistoryEntry } from "@spekjs/core";
import { extractHeadings } from "@spekjs/core/headings";
import { useSpec, useSpecAtChange } from "../hooks/useOpenSpec";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { SpecDiffViewer } from "../components/SpecDiffViewer";
import { SpecToc } from "../components/SpecToc";
import { FoldControls } from "../components/FoldControls";
import { foldOptionsFor, useSpecFold } from "../hooks/useSpecFold";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { scrollToAnchorId } from "../utils/scrollOffset";

const TOC_MIN_HEADINGS = 3;

function DiffView({ topic, entry, currentContent, onClose }: {
  topic: string;
  entry: HistoryEntry;
  currentContent: string;
  onClose: () => void;
}) {
  const { data, loading, error } = useSpecAtChange(topic, entry.slug);

  if (loading) return <p className="text-text-muted">Loading diff...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Diff: {entry.description}</h2>
        <button
          onClick={onClose}
          className="text-sm text-text-muted hover:text-accent transition-colors px-3 py-1 rounded border border-border hover:border-accent"
        >
          Close diff
        </button>
      </div>
      <SpecDiffViewer
        oldContent={data.content}
        newContent={currentContent}
        oldLabel={entry.slug}
        newLabel="current"
      />
    </div>
  );
}

export function SpecDetail() {
  const { topic } = useParams<{ topic: string }>();
  const location = useLocation();
  const { data, loading, error } = useSpec(topic ?? "");
  const [compareEntry, setCompareEntry] = useState<HistoryEntry | null>(null);
  const fold = useSpecFold();

  const headings = useMemo(
    () => (data ? extractHeadings(data.content) : []),
    [data],
  );

  // Hash 錨點：在內容就緒 + hash 變更時，捲動到對應 heading
  useEffect(() => {
    if (!data || compareEntry) return;
    const hash = location.hash.replace(/^#/, "");
    if (!hash) return;

    let attempts = 0;
    let rafId: number | null = null;

    const tryScroll = () => {
      if (scrollToAnchorId(hash)) return;
      // Markdown 尚未 commit 時 retry 幾次（最多 ~300ms）
      if (attempts++ < 10) {
        rafId = requestAnimationFrame(tryScroll);
      }
    };

    rafId = requestAnimationFrame(tryScroll);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [data, location.hash, compareEntry]);

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;
  if (!data) return <p className="text-text-muted">Spec not found</p>;

  const showToc = !compareEntry && headings.length >= TOC_MIN_HEADINGS;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/specs" className="text-text-muted text-base font-medium hover:text-accent transition-colors">
          &larr; Back to Specs
        </Link>
        <div className="flex items-end justify-between gap-4 mt-2">
          <h1 className="text-2xl font-bold">{data.topic}</h1>
          {!compareEntry && <FoldControls mode={fold.mode} onChange={fold.setMode} />}
        </div>
      </div>

      <div className={showToc ? "xl:grid xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-8" : ""}>
        <div className="min-w-0 space-y-6">
          {compareEntry ? (
            <DiffView
              topic={data.topic}
              entry={compareEntry}
              currentContent={data.content}
              onClose={() => setCompareEntry(null)}
            />
          ) : (
            // key: 非受控的 <details> 只吃初始 open，bulk 動作要靠重掛才會套用新狀態
            <MarkdownRenderer
              key={fold.generation}
              content={data.content}
              fold={foldOptionsFor(fold.mode)}
            />
          )}

          <section>
            <h2 className="text-lg font-semibold mb-3">History</h2>
            {data.history.length === 0 ? (
              <p className="text-text-muted text-sm">No changes have affected this spec</p>
            ) : (
              <div className="relative pl-6">
                {/* 垂直時間線 */}
                <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
                <div className="space-y-4">
                  {data.history.map((entry) => (
                    <div
                      key={entry.slug}
                      className="relative hover:bg-bg-secondary rounded p-2 transition-colors"
                    >
                      {/* 時間線圓點 */}
                      <div className="absolute -left-4 top-3.5 w-2.5 h-2.5 rounded-full border-2 border-accent bg-bg-primary" />
                      <div className="flex items-center gap-2 mb-0.5">
                        {(entry.timestamp || entry.date) && (
                          <span className="text-text-muted text-xs font-mono" title={entry.timestamp || undefined}>
                            {entry.timestamp
                              ? formatRelativeTime(entry.timestamp)
                              : entry.date}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          entry.status === "active"
                            ? "bg-green-400/10 text-green-400"
                            : "bg-text-muted/10 text-text-muted"
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/changes/${entry.slug}`}
                          className="text-sm text-accent hover:underline"
                        >
                          {entry.description}
                        </Link>
                        <button
                          onClick={() => setCompareEntry(compareEntry?.slug === entry.slug ? null : entry)}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                            compareEntry?.slug === entry.slug
                              ? "border-accent text-accent bg-accent/10"
                              : "border-border text-text-muted hover:text-accent hover:border-accent"
                          }`}
                        >
                          {compareEntry?.slug === entry.slug ? "Comparing" : "Compare"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {showToc && (
          <aside className="hidden xl:block">
            <SpecToc headings={headings} />
          </aside>
        )}
      </div>
    </div>
  );
}
