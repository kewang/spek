/**
 * The `default` pill: this is the schema the repo's openspec/config.yaml names.
 *
 * Shared for the same reason `SourceBadge` is — it sits beside it on both schema views, and the two
 * copies had already drifted (`shrink-0` on one only).
 */
export function DefaultSchemaBadge() {
  return (
    <span
      className="text-accent border-accent/40 shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-none"
      title="This repo's default schema, from openspec/config.yaml"
    >
      default
    </span>
  );
}
