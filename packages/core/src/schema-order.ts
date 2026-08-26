import {
  answered,
  CACHE_MAX,
  CACHE_TTL_MS,
  failed,
  isTransient,
  peekCached,
  runOpenspec,
  ttlCached,
  type CacheEntry,
} from "./openspec-cli.js";

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

/**
 * Map an openspec artifact's outputPath to a known artifact id, or null if none matches (a glob only
 * resolves the specs tree). `dataFileToId` maps a data artifact's exact filename to its id.
 */
function idForOutputPath(
  outputPath: string,
  knownIds: Set<string>,
  dataFileToId: Map<string, string>,
): string | null {
  const g = outputPath.trim();
  if (g.includes("*")) {
    if (/(^|\/)specs(\/|$)/.test(g) && knownIds.has("specs")) return "specs";
    return null;
  }
  const base = g.split(/[\\/]/).pop() || g;
  // An exact filename match wins first. Discovery gives a markdown file the bare stem, and a same-stem
  // data file the `-2` suffix (`asyncapi.md` -> `asyncapi`, `asyncapi.yaml` -> `asyncapi-2`). A data
  // artifact's title IS its filename. So a data outputPath resolves to the data id, not the markdown
  // sibling that claimed the bare stem. The stem path below already resolves the markdown side correctly.
  const byFile = dataFileToId.get(base);
  if (byFile) return byFile;
  // Otherwise strip the last extension, exactly as discoverArtifacts' stripExt (`\.[^.]+$`) does when it
  // assigns the id, so a declared artifact inverts to the same id discovery produced (`asyncapi.yaml` ->
  // `asyncapi`), not only `.md`. knownIds gates the result, so a non-artifact path cannot match.
  const stem = base.replace(/\.[^.]+$/, "");
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
  dataFileToId?: Map<string, string>,
): string[] | null {
  if (!refs) return null;
  const known = new Set(knownIds);
  const byFile = dataFileToId ?? new Map<string, string>();
  const ordered: string[] = [];
  const used = new Set<string>();
  for (const ref of refs) {
    const id = idForOutputPath(ref.outputPath, known, byFile);
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
// The TTL / size-cap policy itself — and which failures are worth remembering — now lives on
// `ttlCached` in openspec-cli.ts, shared with schemas.ts. It was stated in both files before, and
// the "remember failures forever" fix had to be made twice.
const cache = new Map<string, CacheEntry<SchemaArtifactRef[] | null>>();

/**
 * Changes the installed CLI has already settled against, and when.
 *
 * The bucket above holds **answers**, and no unsuccessful run may be held there whatever its cause:
 * its key names a schema while the query names a change, so an outcome that may be about the change
 * would deny the order to every other change sharing that schema. That is why it is not kept there —
 * not a finding that it is worthless. A refusal of one change is worth keeping *against that change*,
 * and dropping it entirely is what made an installation that cannot answer at all — one too old for
 * `status --change --json` — cost a process start on every change-detail read and on every refetch a
 * watcher triggers.
 *
 * Only what the installed CLI produced is marked (`isTransient` is false): the absent binary and the
 * timeout are what a running host repairs by itself, and remembering those is the bug this cache's
 * TTL already exists for.
 *
 * Keyed under a NUL-prefixed tag for the same reason `DEFAULT_SCHEMA_BUCKET` carries one: the two
 * key spaces are built the same way, and a slug that happens to equal a schema name must not be able
 * to name a bucket entry if these stores are ever merged.
 */
const settled = new Map<string, number>();

const settledKey = (repoRoot: string, slug: string): string => `\0settled\0${repoRoot}::${slug}`;

function isSettled(repoRoot: string, slug: string): boolean {
  const at = settled.get(settledKey(repoRoot, slug));
  if (at === undefined) return false;
  if (Date.now() - at > CACHE_TTL_MS) {
    settled.delete(settledKey(repoRoot, slug));
    return false;
  }
  return true;
}

function markSettled(repoRoot: string, slug: string): void {
  if (settled.size >= CACHE_MAX) {
    const oldest = settled.keys().next().value; // Map keeps insertion order
    if (oldest !== undefined) settled.delete(oldest);
  }
  settled.set(settledKey(repoRoot, slug), Date.now());
}

/**
 * Forget every settled change.
 *
 * Used by tests, and it is the seam a host would clear these on. No TypeScript host clears the bucket
 * either — it is bounded by its TTL alone, and Web / VS Code resync clears the git-timestamp cache and
 * nothing else — so a mark here ages exactly as an answer does. The Kotlin side *does* have such a seam
 * (`SchemaOrder.clearCache`, driven by `SpekCaches` from both the resync route and the file watcher),
 * and clears its own marks there, because `intellij-embedded-server` requires it to.
 */
export function clearSchemaOrderSettlements(): void {
  settled.clear();
}

/**
 * 預設 SchemaOrderProvider：非阻塞地呼叫 openspec CLI 取得權威順序（回 Promise）。
 * openspec 未安裝 / 非 0 結束 / archived change / 逾時 / 解析失敗時一律 resolve 為 null。
 *
 * The CLI's failure taxonomy is deliberately discarded in the *value*: this caller has one fallback
 * (the frontend's narrative order) whatever went wrong, so every `!ok` collapses to null. It is not
 * discarded in the *cache*, where a settled run is remembered against the change — see below.
 */
export const cliSchemaOrderProvider: SchemaOrderProvider = (repoRoot, slug, schema) => {
  // schema 已知 → 以 schema 分桶；schema 為 null/空（spek 本地解析不出名稱）→ 共用 repo 級預設桶：
  // CLI 會自行解析出同一個內建預設順序，故這類 change 正確地共享一次 spawn。schema 僅用於組 key，不進 argv。
  const cacheKey = `${repoRoot}::${schema || DEFAULT_SCHEMA_BUCKET}`;

  // The bucket first, and this order is the whole rule: a settled change is still owed its schema's
  // order. The authoritative sequence is a property of the schema, so once the bucket holds one —
  // typically fetched by a sibling change after this one was refused — it is this change's too, and
  // `resolveSchemaOrder` maps it onto this change's own artifacts. The mark below replaces a
  // **consultation**, never an answer.
  const held = peekCached(cache, cacheKey);
  if (held) return held;

  // Read outside `ttlCached`, because replaying a mark consults nothing: there is no run for another
  // reader to share, and reached from inside `compute` a concurrent read of a *different* change
  // would join it and be handed a settlement that was never about it. Same reason the Kotlin
  // unsafe-slug allowlist sits outside its cache, and the reason scanner.ts's empty-slug guard sits
  // outside this provider.
  if (isSettled(repoRoot, slug)) return Promise.resolve(null);

  return ttlCached(cache, cacheKey, async () => {
    // slug 自成一個 argv 引數，結構上即無 shell injection 之虞，毋須對 slug 另做過濾。
    const cli = await runOpenspec(["status", "--change", slug, "--json"], repoRoot);
    if (!cli.ok) {
      // Written *inside* `compute` — the mirror of reading it outside, and the opposite answer. This
      // is the only place holding both the reason and the slug the argv actually named. Marked by
      // whoever awaits the provider instead, a reader for change Y that legitimately joined an
      // in-flight run about change X would take X's null and mark **Y** as settled.
      if (!isTransient(cli.reason)) markSettled(repoRoot, slug);
      // Never held in the bucket, whatever the reason — see the note on `settled` above.
      return failed(null);
    }
    // A successful run that parses to null is the CLI reporting no order, which is an answer: the
    // two nulls are indistinguishable downstream, so they are told apart here.
    return answered(parseOrderFromStatus(cli.json));
  });
};
