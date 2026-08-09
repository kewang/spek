import type { SchemaSource } from "@spekjs/core";
import { sourceTitle } from "../utils/schemaView";

/**
 * Where a schema was resolved from, as a pill: `project`, `user` or `package`.
 *
 * Shared because both schema views show it and the two copies had already drifted — one carried
 * `shrink-0` and the other did not, within a single change.
 */
export function SourceBadge({ source }: { source: SchemaSource }) {
  return (
    <span
      className="border-border bg-bg-tertiary text-text-secondary shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none"
      title={sourceTitle(source)}
    >
      {source}
    </span>
  );
}
