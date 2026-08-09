import { runOpenspec, ttlCached, type CacheEntry } from "./openspec-cli.js";

/** schema 中單一 artifact 的權威參照（由 openspec CLI 提供） */
export interface SchemaArtifactRef {
  /** openspec artifact id（如 brainstorm / proposal / specs） */
  id: string;
  /** 該 artifact 的產出路徑：字面檔名（proposal.md）或 glob（specs/**\/*.md） */
  outputPath: string;
}

/**
 * 提供某個 change 的權威 artifact 順序。回 null 代表無法取得（CLI 不存在、change 為
 * archived、或任何錯誤），此時 schemaOrder 為 null（前端退回預設 spec-driven 順序）。
 * 可為同步（測試常注入同步 fake）或非同步（預設 CLI provider 以子行程非阻塞取得）。
 *
 * `slug` 是實際餵給 CLI 的 change（`--change <slug>`）；`schema` 是 spek **本地**解析出的 schema 名稱，
 * 只用於快取分桶（同一 schema 的所有 change 得到相同權威順序，issue #15）。schema 為 null 代表 spek
 * 在本地解析不出名稱（change 與 repo 皆未宣告）——**不代表沒有權威順序**：CLI 仍會自行解析出內建預設
 * （通常 spec-driven）並回傳順序，故這類 change 仍須查 CLI，並共用一個 repo 級的「預設」分桶。
 */
export type SchemaOrderProvider = (
  repoRoot: string,
  slug: string,
  schema: string | null,
) => SchemaArtifactRef[] | null | Promise<SchemaArtifactRef[] | null>;

/**
 * schema 為 null / 空字串時的分桶哨兵：這類 change 在本地無法命名 schema，但 CLI 會解析出同一個
 * repo 級預設順序，故全部共用此桶（每 repo 一次 spawn）。以 NUL 字元前綴確保絕不與真實 schema 名撞。
 */
const DEFAULT_SCHEMA_BUCKET = "\0default";

/**
 * 由 `openspec status --change <slug> --json` 的輸出萃取權威 artifact 順序：
 * actionContext.planningArtifacts 提供順序，artifactPaths[id].outputPath 提供產出路徑。
 * 純函式，方便單元測試；解析不出任何 artifact 時回 null。
 */
export function parseOrderFromStatus(json: unknown): SchemaArtifactRef[] | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const actionContext = obj.actionContext as Record<string, unknown> | undefined;
  const order = actionContext?.planningArtifacts;
  const paths = obj.artifactPaths as Record<string, { outputPath?: unknown }> | undefined;
  if (!Array.isArray(order) || !paths) return null;

  const refs: SchemaArtifactRef[] = [];
  for (const id of order) {
    if (typeof id !== "string") continue;
    const outputPath = paths[id]?.outputPath;
    if (typeof outputPath === "string") refs.push({ id, outputPath });
  }
  return refs.length > 0 ? refs : null;
}

/** 將 openspec artifact 的 outputPath 對應到已知 artifact id；對不到回 null（glob 僅支援 specs tree） */
function idForOutputPath(outputPath: string, knownIds: Set<string>): string | null {
  const g = outputPath.trim();
  if (g.includes("*")) {
    if (/(^|\/)specs(\/|$)/.test(g) && knownIds.has("specs")) return "specs";
    return null;
  }
  const base = g.split(/[\\/]/).pop() || g;
  const stem = base.replace(/\.md$/i, "");
  if (knownIds.has(stem)) return stem;
  // 指向 specs/<topic>/spec.md 之類的字面路徑也對應到 specs artifact
  if (/^spec\.md$/i.test(base) && /specs/i.test(g) && knownIds.has("specs")) return "specs";
  return null;
}

/**
 * 由 refs（schema 權威順序）與已探索的 artifact id 集合，產生排序後的 artifact-id 清單。
 * 每個 ref 依 outputPath 對應到一個已知 id、去重；對不到的 ref 略過。
 * refs 為 null 或無任何有效對應時回 null（代表 schemaOrder 不可用）。純函式，方便測試。
 */
export function resolveSchemaOrder(
  refs: SchemaArtifactRef[] | null,
  knownIds: string[],
): string[] | null {
  if (!refs) return null;
  const known = new Set(knownIds);
  const ordered: string[] = [];
  const used = new Set<string>();
  for (const ref of refs) {
    const id = idForOutputPath(ref.outputPath, known);
    if (id && !used.has(id)) {
      ordered.push(id);
      used.add(id);
    }
  }
  return ordered.length > 0 ? ordered : null;
}

// 以 (repoRoot, schema) 記憶結果（存 Promise，順帶去重同時併發的呼叫）。
// 權威順序（planningArtifacts + artifactPaths）是 schema 的屬性、非個別 change 的屬性，故以
// schema 為 key，同一 repo 內共用該 schema 的所有 change 至多 spawn 一次 CLI（issue #15）。
// 呼叫端只在 change 有 schema 時才進來（無 schema → 無權威順序，提前回 null），故 key 不需 slug fallback。
//
// The TTL / size-cap policy itself — and why caching a failure forever was a bug — now lives on
// `ttlCached` in openspec-cli.ts, shared with schemas.ts. It was stated in both files before, and
// the "remember failures forever" fix had to be made twice.
const cache = new Map<string, CacheEntry<SchemaArtifactRef[] | null>>();

/**
 * 預設 SchemaOrderProvider：非阻塞地呼叫 openspec CLI 取得權威順序（回 Promise）。
 * openspec 未安裝 / 非 0 結束 / archived change / 逾時 / 解析失敗時一律 resolve 為 null。
 *
 * The CLI's failure taxonomy is deliberately discarded here: this caller has one fallback (the
 * frontend's narrative order) whatever went wrong, so every `!ok` collapses to null.
 */
export const cliSchemaOrderProvider: SchemaOrderProvider = (repoRoot, slug, schema) => {
  // schema 已知 → 以 schema 分桶；schema 為 null/空（spek 本地解析不出名稱）→ 共用 repo 級預設桶：
  // CLI 會自行解析出同一個內建預設順序，故這類 change 正確地共享一次 spawn。schema 僅用於組 key，不進 argv。
  const cacheKey = `${repoRoot}::${schema || DEFAULT_SCHEMA_BUCKET}`;
  return ttlCached(cache, cacheKey, async () => {
    // slug 自成一個 argv 引數，結構上即無 shell injection 之虞，毋須對 slug 另做過濾。
    const cli = await runOpenspec(["status", "--change", slug, "--json"], repoRoot);
    if (!cli.ok) return null;
    try {
      return parseOrderFromStatus(cli.json);
    } catch {
      return null;
    }
  });
};
