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
        <h2 className="text-lg font-semibold mb-3">Related Changes</h2>
        {data.relatedChanges.length === 0 ? (
          <p className="text-text-muted text-sm">No related changes</p>
        ) : (
          <div className="space-y-1">
            {data.relatedChanges.map((slug) => (
              <Link
                key={slug}
                to={`/changes/${slug}`}
                className="block px-3 py-2 rounded text-sm text-accent hover:bg-bg-secondary transition-colors"
              >
                {slug}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
