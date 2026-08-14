import { Link } from "react-router-dom";
import { useOverview, useChanges } from "../hooks/useOpenSpec";
import { TaskProgress } from "../components/TaskProgress";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { daysBetween, todayIso } from "../utils/lifecycle";
import { WorktreeBadge } from "../components/WorktreeBadge";
import { SchemaBadge } from "../components/SchemaBadge";
import { StretchedLink } from "../components/StretchedLink";
import { changeKey, changeTo } from "../utils/changeLink";
import { StatCard } from "../components/StatCard";

const STALE_THRESHOLD_DAYS = 30;

export function Dashboard() {
  const overview = useOverview();
  const changes = useChanges();

  if (overview.loading) {
    return <p className="text-text-muted">Loading...</p>;
  }
  if (overview.error) {
    return <p className="text-status-error">Error: {overview.error}</p>;
  }

  const data = overview.data!;
  const taskPercent =
    data.taskStats.total > 0
      ? Math.round((data.taskStats.completed / data.taskStats.total) * 100)
      : 0;

  const activeChanges = changes.data?.active ?? [];
  const archivedChanges = (changes.data?.archived ?? []).slice(0, 10);
  const showSource = !!changes.data?.aggregated && (changes.data?.worktrees?.length ?? 0) > 1;

  const today = todayIso();
  const archivedSpans = (changes.data?.archived ?? [])
    .filter((c) => c.createdDate && c.archivedDate)
    .map((c) => daysBetween(c.createdDate!, c.archivedDate!));
  let avgLifecycle: string;
  if (archivedSpans.length === 0) {
    avgLifecycle = "—";
  } else {
    const avg = archivedSpans.reduce((sum, n) => sum + n, 0) / archivedSpans.length;
    avgLifecycle = avg < 1 ? "<1d" : `${Math.round(avg)}d`;
  }
  const staleActiveCount = activeChanges.filter(
    (c) => c.createdDate && daysBetween(c.createdDate, today) > STALE_THRESHOLD_DAYS,
  ).length;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Overview</h1>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Specs" value={data.specsCount} delay={0} />
        <StatCard label="Active Changes" value={data.changesCount.active} delay={80} />
        <StatCard label="Archived Changes" value={data.changesCount.archived} delay={160} />
        <StatCard label="Task Completion" value={`${taskPercent}%`} delay={240} />
        <StatCard label="Avg lifecycle (archived)" value={avgLifecycle} delay={320} />
        <StatCard label="Stale active (>30d)" value={staleActiveCount} delay={400} />
      </div>

      {/* Active changes */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Active Changes</h2>
        {activeChanges.length === 0 ? (
          <p className="text-text-muted text-sm">No active changes</p>
        ) : (
          <div className="space-y-2">
            {activeChanges.map((c) => (
              // Div + StretchedLink, not a wrapping Link: the schema badge inside is a link of its
              // own and anchors cannot nest. Same pattern as the Changes list.
              <div
                key={changeKey(c)}
                className="relative bg-bg-secondary border border-border rounded p-4 hover:border-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-4 mb-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <StretchedLink
                      to={changeTo(c)}
                      className="text-text-primary font-medium truncate"
                    >
                      {c.description}
                    </StretchedLink>
                    {showSource && c.source && <WorktreeBadge source={c.source} />}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <SchemaBadge schema={c.schema} defaultSchema={c.defaultSchema} />
                    {(c.timestamp || c.date) && (
                      <span className="relative z-10 text-text-muted text-xs whitespace-nowrap" title={c.timestamp || undefined}>
                        {c.timestamp ? formatRelativeTime(c.timestamp) : c.date}
                      </span>
                    )}
                  </span>
                </div>
                {c.taskStats && (
                  <TaskProgress completed={c.taskStats.completed} total={c.taskStats.total} />
                )}
              </div>
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
              <div
                key={changeKey(c)}
                className="relative flex items-center justify-between gap-4 px-3 py-2 rounded hover:bg-bg-secondary transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <StretchedLink to={changeTo(c)} className="text-text-primary text-sm truncate">
                    {c.description}
                  </StretchedLink>
                  {showSource && c.source && <WorktreeBadge source={c.source} />}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <SchemaBadge schema={c.schema} defaultSchema={c.defaultSchema} />
                  {(c.timestamp || c.date) && (
                    <span className="relative z-10 text-text-muted text-xs whitespace-nowrap" title={c.timestamp || undefined}>
                      {c.timestamp ? formatRelativeTime(c.timestamp) : c.date}
                    </span>
                  )}
                </span>
              </div>
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

