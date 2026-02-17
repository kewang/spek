import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSpec, useSpecAtChange } from "../hooks/useOpenSpec";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { SpecDiffViewer } from "../components/SpecDiffViewer";
import type { HistoryEntry } from "@spek/core";

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
  const { data, loading, error } = useSpec(topic ?? "");
  const [compareEntry, setCompareEntry] = useState<HistoryEntry | null>(null);

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;
  if (!data) return <p className="text-text-muted">Spec not found</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/specs" className="text-text-muted text-base font-medium hover:text-accent transition-colors">
          &larr; Back to Specs
        </Link>
        <h1 className="text-2xl font-bold mt-2">{data.topic}</h1>
      </div>

      {compareEntry ? (
        <DiffView
          topic={data.topic}
          entry={compareEntry}
          currentContent={data.content}
          onClose={() => setCompareEntry(null)}
        />
      ) : (
        <MarkdownRenderer content={data.content} />
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
                          ? new Date(entry.timestamp).toLocaleString()
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
  );
}
