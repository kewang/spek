import { Link } from "react-router-dom";

// change 的 schema 徽章：以 pill 呈現 schema 名稱。為降低雜訊，schema 未知或與 repo 預設 schema
// 相同時不顯示，只有 change 使用了與預設不同的 schema 時才凸顯。此規則在所有呈現 change 的畫面
// （change detail、changes 列表、dashboard）統一套用。repo 預設 schema 本身在 Changes 頁改以
// 純文字標示（非 pill），讓「pill = 非預設 schema」的語意在各處一致。
//
// Links even when the name resolves to nothing installed: the detail page answers with "no schema
// named X was found for this repo", which is what a reader seeing an unfamiliar badge wants. Gating
// on resolution cost every page carrying a badge an extra enumeration request.
//
// `relative z-10` keeps it clickable inside a row whose link is stretched over the whole card
// (ChangeList / Dashboard) — the overlay would otherwise swallow the click.
export function SchemaBadge({
  schema,
  defaultSchema,
}: {
  schema: string | null | undefined;
  defaultSchema: string | null | undefined;
}) {
  if (!schema || schema === defaultSchema) return null;

  return (
    <Link
      to={`/schemas/${encodeURIComponent(schema)}`}
      className="relative z-10 shrink-0 inline-flex items-center rounded border border-border bg-bg-tertiary px-1.5 py-0.5 text-[11px] font-medium text-text-secondary hover:border-accent hover:text-accent transition-colors"
      title={`Schema: ${schema} — open its workflow`}
    >
      {schema}
    </Link>
  );
}
