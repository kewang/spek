import { Link } from "react-router-dom";
import { useOverview, useChanges } from "../hooks/useOpenSpec";
import { TaskProgress } from "../components/TaskProgress";

export function Dashboard() {
  const overview = useOverview();
  const changes = useChanges();

  if (overview.loading) {
    return <p className="text-text-muted">Loading...</p>;
  }
  if (overview.error) {
    return <p className="text-red-400">Error: {overview.error}</p>;
  }

  const data = overview.data!;
  const taskPercent =
    data.taskStats.total > 0
      ? Math.round((data.taskStats.completed / data.taskStats.total) * 100)
      : 0;

  const activeChanges = changes.data?.active ?? [];
  const archivedChanges = (changes.data?.archived ?? []).slice(0, 10);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Overview</h1>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Specs" value={data.specsCount} delay={0} />
        <StatCard label="Active Changes" value={data.changesCount.active} delay={80} />
        <StatCard label="Archived Changes" value={data.changesCount.archived} delay={160} />
        <StatCard label="Task Completion" value={`${taskPercent}%`} delay={240} />
      </div>

      {/* Active changes */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Active Changes</h2>
        {activeChanges.length === 0 ? (
          <p className="text-text-muted text-sm">No active changes</p>
        ) : (
          <div className="space-y-2">
            {activeChanges.map((c) => (
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
        )}
      </section>

      {/* 最近封存 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recently Archived</h2>
        {archivedChanges.length === 0 ? (
          <p className="text-text-muted text-sm">No archived changes</p>
        ) : (
          <div className="space-y-1">
            {archivedChanges.map((c) => (
              <Link
                key={c.slug}
                to={`/changes/${c.slug}`}
                className="flex items-center justify-between px-3 py-2 rounded hover:bg-bg-secondary transition-colors"
              >
                <span className="text-text-primary text-sm">{c.description}</span>
                {c.date && <span className="text-text-muted text-xs">{c.date}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 導覽卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/specs"
          className="bg-bg-secondary border border-border rounded p-6 hover:border-accent transition-colors"
        >
          <h3 className="font-semibold mb-1">Specs</h3>
          <p className="text-text-secondary text-sm">Browse all spec topics</p>
        </Link>
        <Link
          to="/changes"
          className="bg-bg-secondary border border-border rounded p-6 hover:border-accent transition-colors"
        >
          <h3 className="font-semibold mb-1">Changes</h3>
          <p className="text-text-secondary text-sm">View change timeline</p>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, delay = 0 }: { label: string; value: string | number; delay?: number }) {
  return (
    <div
      className="bg-bg-secondary border border-border rounded p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-4xl font-bold text-accent">{value}</div>
      <div className="text-text-secondary text-sm">{label}</div>
    </div>
  );
}
