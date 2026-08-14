import { Link } from "react-router-dom";
import type { ChangeInfo } from "@spekjs/core";
import { useChanges } from "../hooks/useOpenSpec";
import { TaskProgress } from "../components/TaskProgress";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { formatLifecycleListRow, todayIso } from "../utils/lifecycle";
import { WorktreeBadge } from "../components/WorktreeBadge";
import { SchemaBadge } from "../components/SchemaBadge";
import { StretchedLink } from "../components/StretchedLink";
import { changeKey, changeTo } from "../utils/changeLink";

function changeMetaDisplay(c: ChangeInfo, today: string): { text: string; tooltip: string } | null {
  const lifecycle = formatLifecycleListRow(c, today);
  const tooltipParts: string[] = [];
  if (c.createdDate) tooltipParts.push(`Created: ${c.createdDate}`);
  if (c.archivedDate) tooltipParts.push(`Archived: ${c.archivedDate}`);
  if (c.timestamp) tooltipParts.push(`First commit: ${c.timestamp}`);
  if (lifecycle) {
    return { text: lifecycle, tooltip: tooltipParts.join("\n") };
  }
  if (c.timestamp) {
    return { text: formatRelativeTime(c.timestamp), tooltip: tooltipParts.join("\n") || c.timestamp };
  }
  if (c.date) {
    return { text: c.date, tooltip: c.date };
  }
  return null;
}

function ChangeRow({ c, today, accent, showSource }: {
  c: ChangeInfo;
  today: string;
  accent: boolean;
  showSource: boolean;
}) {
  const meta = changeMetaDisplay(c, today);
  return (
    // A div, not a Link — the schema badge inside is itself a link and anchors cannot nest. The
    // card stays clickable through StretchedLink on the title; `relative` is what that overlay
    // attaches to.
    <div
      className={`relative bg-bg-secondary border border-border rounded p-4 hover:border-accent transition-colors${
        accent ? " border-l-4 border-l-accent" : ""
      }`}
    >
      <div className={`flex items-center justify-between gap-4${accent ? " mb-2" : ""}`}>
        <span className="flex items-center gap-2 min-w-0">
          <StretchedLink
            to={changeTo(c)}
            className={`truncate ${accent ? "text-text-primary font-medium" : "text-text-primary"}`}
          >
            {c.description}
          </StretchedLink>
          {showSource && c.source && <WorktreeBadge source={c.source} />}
          {c.isCurrent && (
            <span
              className="relative z-10 shrink-0 text-[11px] text-accent border border-accent/40 rounded px-1.5 py-0.5"
              title="The jj working copy (@) is currently editing this change"
            >
              editing
            </span>
          )}
          {c.conflictsWith && (
            <span
              className="relative z-10 shrink-0 text-[11px] text-status-warning border border-status-warning/40 rounded px-1.5 py-0.5"
              title={`This jj workspace's copy diverges in content from ${c.conflictsWith}`}
            >
              conflicts with {c.conflictsWith}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <SchemaBadge schema={c.schema} defaultSchema={c.defaultSchema} />
          {meta && (
            <span
              className="relative z-10 text-text-muted text-xs whitespace-nowrap tracking-wide [word-spacing:0.15em]"
              title={meta.tooltip}
            >
              {meta.text}
            </span>
          )}
        </span>
      </div>
      {accent && c.taskStats && (
        <TaskProgress completed={c.taskStats.completed} total={c.taskStats.total} />
      )}
    </div>
  );
}

export function ChangeList() {
  // Aggregation scope comes from the global header control via AggregationScopeContext (consumed by
  // useChanges); this page renders no aggregation control of its own.
  const { data, loading, error } = useChanges();

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-status-error">Error: {error}</p>;

  const active = data?.active ?? [];
  const archived = data?.archived ?? [];
  const worktrees = data?.worktrees ?? [];
  const showSource = !!data?.aggregated && worktrees.length > 1;
  const defaultSchema = data?.defaultSchema;
  const today = todayIso();

  const header = (
    <div>
      <h1 className="text-2xl font-bold">Changes</h1>
      {defaultSchema && (
        <p className="mt-1 text-text-muted text-sm" title="Repo default OpenSpec schema">
          Default schema:{" "}
          {/* Links like the badges do. It is the one schema name on this page that never gets a
              pill (a pill means "not the default"), but that is a rule about emphasis, not about
              whether the name is worth following. */}
          <Link
            to={`/schemas/${encodeURIComponent(defaultSchema)}`}
            className="text-text-secondary hover:text-accent underline decoration-dotted underline-offset-2 transition-colors"
          >
            {defaultSchema}
          </Link>
        </p>
      )}
    </div>
  );

  if (active.length === 0 && archived.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-text-muted">No changes found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      {active.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Active</h2>
          <div className="space-y-2">
            {active.map((c) => (
              <ChangeRow key={changeKey(c)} c={c} today={today} accent showSource={showSource} />
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Archived</h2>
          <div className="space-y-2">
            {archived.map((c) => (
              <ChangeRow key={changeKey(c)} c={c} today={today} accent={false} showSource={showSource} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
