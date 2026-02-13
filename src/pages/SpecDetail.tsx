import { Link, useParams } from "react-router-dom";
import { useSpec } from "../hooks/useOpenSpec";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

export function SpecDetail() {
  const { topic } = useParams<{ topic: string }>();
  const { data, loading, error } = useSpec(topic ?? "");

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;
  if (!data) return <p className="text-text-muted">Spec not found</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/specs" className="text-text-muted text-sm hover:text-accent transition-colors">
          &larr; Back to Specs
        </Link>
        <h1 className="text-2xl font-bold mt-2">{data.topic}</h1>
      </div>

      <MarkdownRenderer content={data.content} />

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
                <Link
                  key={entry.slug}
                  to={`/changes/${entry.slug}`}
                  className="block relative hover:bg-bg-secondary rounded p-2 transition-colors"
                >
                  {/* 時間線圓點 */}
                  <div className="absolute -left-4 top-3.5 w-2.5 h-2.5 rounded-full border-2 border-accent bg-bg-primary" />
                  <div className="flex items-center gap-2 mb-0.5">
                    {entry.date && (
                      <span className="text-text-muted text-xs font-mono">{entry.date}</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      entry.status === "active"
                        ? "bg-green-400/10 text-green-400"
                        : "bg-text-muted/10 text-text-muted"
                    }`}>
                      {entry.status}
                    </span>
                  </div>
                  <span className="text-sm text-accent">{entry.description}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
