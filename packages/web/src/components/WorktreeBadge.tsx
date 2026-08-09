import type { ChangeInfo } from "@spekjs/core";

// A small label marking which worktree / jj workspace a change came from, in the aggregated view.
// Changes from the main working directory show nothing, so the view isn't drowned in repeated
// labels. A jj workspace source is prefixed `jj:` to distinguish it from a git branch.
//
// `relative z-10` keeps its tooltip above a stretched row's overlay (see `StretchedLink`); on the
// component rather than each call site, since it is harmless in the one list that isn't one.
export function WorktreeBadge({ source }: { source: NonNullable<ChangeInfo["source"]> }) {
  if (source.isMain) return null;
  const isJj = source.vcs === "jj";
  const label = isJj ? `jj:${source.branch ?? ""}` : (source.branch ?? "detached");
  return (
    <span
      className="relative z-10 shrink-0 text-[11px] text-text-muted border border-border rounded px-1.5 py-0.5"
      title={`${source.path}${isJj ? " (jj workspace)" : ""}`}
    >
      {label}
    </span>
  );
}
