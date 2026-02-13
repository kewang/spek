import { Link } from "react-router-dom";
import { useChanges } from "../hooks/useOpenSpec";
import { TaskProgress } from "../components/TaskProgress";

export function ChangeList() {
  const { data, loading, error } = useChanges();

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  const active = data?.active ?? [];
  const archived = data?.archived ?? [];

  if (active.length === 0 && archived.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Changes</h1>
        <p className="text-text-muted">No changes found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Changes</h1>

      {/* Active */}
      {active.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Active</h2>
          <div className="space-y-2">
            {active.map((c) => (
              <Link
                key={c.slug}
                to={`/changes/${c.slug}`}
                className="block bg-bg-secondary border border-border rounded p-4 hover:border-accent transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-primary font-medium">{c.description}</span>
                  {c.date && <span className="text-text-muted text-xs">{c.date}</span>}
                </div>
                {c.taskStats && (
                  <TaskProgress completed={c.taskStats.completed} total={c.taskStats.total} />
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Archived</h2>
          <div className="space-y-2">
            {archived.map((c) => (
              <Link
                key={c.slug}
                to={`/changes/${c.slug}`}
                className="block bg-bg-secondary border border-border rounded p-4 hover:border-accent transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-text-primary">{c.description}</span>
                  {c.date && <span className="text-text-muted text-xs">{c.date}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
