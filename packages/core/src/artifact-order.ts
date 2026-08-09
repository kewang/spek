// Artifact ordering: the narrative order, and the sort that applies it.
//
// The constant is the fallback every surface reaches for — when a change declares no schema order, when
// the order cannot be obtained (archived changes, no CLI), and as the stable tiebreak when two artifacts
// share an mtime. `sortArtifacts` is the rule that consumes it, together with the three modes the
// change-detail view offers on every surface (see openspec/specs/custom-schema-artifacts).
//
// Both live here, in one file, on purpose. The constant was originally lifted out of the server-only
// artifacts.ts so a webview bundle could reach it "without duplicating the frontend's ordering logic" —
// but only the constant came, and the function stayed in packages/web where nothing outside that package
// could import it. Splitting the vocabulary from the rule is what let the duplication happen anyway.
//
// Pure logic with no runtime import — the type import erases — so it ships as the
// `@spekjs/core/artifact-order` subpath and can be value-imported from a browser bundle or a host's main
// process, the same arrangement as graph-node-id.ts. It is deliberately *not* re-exported from index.ts:
// that entry pulls in the server-side modules this subpath exists to avoid.

import type { ChangeArtifact } from "./types.js";

// change artifact 的預設敘事順序（spec-driven schema）：schemaOrder 不可用、或兩個 artifact
// mtime 完全相同時的穩定 tiebreak。
export const DEFAULT_ORDER = ["proposal", "design", "specs", "tasks"];

/** DEFAULT_ORDER 中的名次（不在其中回 +Infinity），供相同權重時的 tiebreak 使用 */
export function defaultRank(id: string): number {
  const i = DEFAULT_ORDER.indexOf(id);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

/**
 * Every ordering mode, at runtime.
 *
 * Consumers that persist the user's choice have to validate what they read back, which needs the modes
 * as values — and a hand-written second list satisfies `ArtifactSortMode[]` even when it is missing an
 * entry, so the omitted mode becomes silently unrestorable. Deriving the type from this array is what
 * makes the two unable to disagree.
 */
export const ARTIFACT_SORT_MODES = ["modified", "schema", "alpha"] as const;

export type ArtifactSortMode = (typeof ARTIFACT_SORT_MODES)[number];

function byDefaultOrder(a: ChangeArtifact, b: ChangeArtifact): number {
  const ra = defaultRank(a.id);
  const rb = defaultRank(b.id);
  if (ra !== rb) return ra - rb;
  return a.id.localeCompare(b.id);
}

/**
 * 依使用者選擇的模式排序 change artifacts（純函式）：
 * - modified：維持 core 交付的順序（已依 mtime 由新到舊，即 last-modified）
 * - alpha：依顯示標題 A–Z
 * - schema：依 schemaOrder（schema 權威順序）排序，未列入者接在後面依預設敘事序；
 *   schemaOrder 不可用（null/空）時整體退回預設敘事序
 * 只改變順序，不改變 artifact 集合。
 *
 * `modified` may hand back the very array it was given. Callers must not mutate a returned list: under
 * that mode it can alias the caller's own array, so sorting it in place reorders the data they passed in.
 * `alpha` compares titles with `localeCompare`, which is locale- and ICU-dependent — a caller needing a
 * host-independent order has to impose one itself.
 */
export function sortArtifacts(
  artifacts: ChangeArtifact[],
  mode: ArtifactSortMode,
  schemaOrder?: string[],
): ChangeArtifact[] {
  if (mode === "modified") return artifacts;

  if (mode === "alpha") {
    // id tiebreak keeps order deterministic when two artifacts humanize to the same title
    return [...artifacts].sort(
      (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
    );
  }

  // mode === "schema"
  if (schemaOrder && schemaOrder.length > 0) {
    const rank = new Map(schemaOrder.map((id, i) => [id, i] as const));
    return [...artifacts].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.POSITIVE_INFINITY;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      // schemaOrder 未列入者接在後面，依預設敘事序
      return byDefaultOrder(a, b);
    });
  }

  // schemaOrder 不可用 → 退回預設 spec-driven 敘事序
  return [...artifacts].sort(byDefaultOrder);
}
