package com.spek.intellij.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** schema 中單一 artifact 的權威參照（由 openspec CLI 提供） */
data class SchemaArtifactRef(
    val id: String,
    val outputPath: String,
)

/**
 * 提供某個 change 的權威 artifact 順序。回 null 代表無法取得（CLI 不存在、archived change、
 * 或任何錯誤），此時 schemaOrder 為 null。對齊 @spekjs/core 的 SchemaOrderProvider。
 *
 * `slug` 是實際餵給 CLI 的 change；`schema` 是 spek **本地**解析出的 schema 名稱，只用於快取分桶。
 * schema 為 null 代表本地解析不出名稱——**不代表無權威順序**：CLI 會自行解析出內建預設並回傳，故這類
 * change 仍要查，並共用一個 repo 級預設桶。見 issue #15。
 */
fun interface SchemaOrderProvider {
    fun order(repoRoot: String, slug: String, schema: String?): List<SchemaArtifactRef>?
}

object SchemaOrder {
    private val json = Json { ignoreUnknownKeys = true }

    // The cache policy — TTL, size cap, CHM concurrency, which failures are worth keeping — all lives
    // on TtlCache, shared with SchemaCatalog. It used to be written once in each file.
    // The bucket sentinel for a schema that is null/empty (unresolvable locally): the CLI resolves the
    // same repo-level default order for all of them, so they share this one bucket. The NUL prefix
    // makes it unforgeable by a real schema name. Aligned with @spekjs/core.
    private const val DEFAULT_SCHEMA_BUCKET = "\u0000default"
    // The value type is nullable: "consulted, and there is no authoritative order" is an answer like
    // any other and is cached; only what was never obtained is left out.
    private val cache = TtlCache<String, List<SchemaArtifactRef>?>()

    /**
     * Changes the installed CLI has already settled against.
     *
     * The bucket above holds **answers**, and no unsuccessful run may be held there whatever its
     * cause: its key names a schema while the query names a change, so an outcome that may be about
     * the change would deny the order to every other change sharing that schema. That is why it is
     * not kept there — not a finding that it is worthless. A refusal of one change is worth keeping
     * *against that change*, and dropping it entirely is what made an installation that cannot answer
     * at all cost a process start on every read of every change detail.
     *
     * Only what the installed CLI produced is marked ([OpenspecCli.isTransient] false): the absent
     * binary and the timeout are what a running host repairs by itself. Keyed under the same NUL
     * prefix the default bucket uses, because the two key spaces are built the same way and a slug
     * that happens to equal a schema name must not be able to name a bucket entry.
     */
    private const val SETTLED_PREFIX = "\u0000settled\u0000"

    private val settled = TtlMarks<String>()

    /**
     * The injection point for the CLI runner, so tests need not spawn anything. `internal` rather than
     * private: the same approach [SchemaCatalog]'s `cliRunner` takes, and the only way to reach the
     * slug allowlist below — a security boundary — from a test.
     */
    internal var cliRunner: (List<String>, String) -> OpenspecCli.Outcome =
        { args, cwd -> OpenspecCli.run(args, cwd) }

    /**
     * What `openspec status --change <slug> --json` said, classified.
     *
     * The two cases must be told apart **here**, because nothing downstream can: both deliver a null
     * schema order, so a caller reading the value alone cannot recover which it had, and the cheap
     * wrong answer is to treat an unreadable response as the schema's answer and hold it for the
     * whole window — which is what this side did.
     */
    sealed interface OrderResponse {
        /** The CLI's output parsed. [refs] is null when it names no artifact order — an answer. */
        data class Readable(val refs: List<SchemaArtifactRef>?) : OrderResponse

        /** The output could not be parsed at all: the installed CLI answering unusably. */
        data object Unreadable : OrderResponse
    }

    /**
     * Read the authoritative order out of the CLI's output.
     *
     * **The readability boundary is `parseToJsonElement` and nothing more.** TypeScript's is
     * `JSON.parse` alone, so a body of `null`, `42`, `"str"` or `[1,2]` parses there, finds no order,
     * and is an *answer*. Taking the `.jsonObject` cast as part of the boundary would make those four
     * failures on this side and answers on the other — the divergence this classification exists to
     * close, one layer down. Anything the extractor cannot find an order in is a readable response
     * reporting none.
     */
    fun readOrderFromStatus(jsonText: String): OrderResponse {
        val root = try {
            json.parseToJsonElement(jsonText)
        } catch (_: Exception) {
            return OrderResponse.Unreadable
        }
        return OrderResponse.Readable(extractOrder(root))
    }

    /**
     * `actionContext.planningArtifacts` gives the order, `artifactPaths[id].outputPath` the output
     * path. Pure, and never throws: a root that is not an object, or one without those fields, simply
     * yields no order.
     */
    private fun extractOrder(root: JsonElement): List<SchemaArtifactRef>? {
        val obj = root as? JsonObject ?: return null
        val order = (obj["actionContext"] as? JsonObject)?.get("planningArtifacts") as? JsonArray ?: return null
        val paths = obj["artifactPaths"] as? JsonObject ?: return null
        val refs = mutableListOf<SchemaArtifactRef>()
        // Bad elements are skipped one by one via safe casts (a non-string id, an outputPath that is
        // not a string), matching the TS side: one bad element is skipped rather than voiding the
        // whole read.
        for (el in order) {
            val id = (el as? JsonPrimitive)?.takeIf { it.isString }?.content ?: continue
            val outputPath = (paths[id] as? JsonObject)?.get("outputPath")
                ?.let { it as? JsonPrimitive }?.takeIf { it.isString }?.content ?: continue
            refs.add(SchemaArtifactRef(id, outputPath))
        }
        return if (refs.isNotEmpty()) refs else null
    }

    /**
     * Map an openspec artifact's outputPath to a known artifact id, or null if none matches (a glob only
     * resolves the specs tree). `dataFileToId` maps a data artifact's exact filename to its id.
     */
    private fun idForOutputPath(
        outputPath: String,
        knownIds: Set<String>,
        dataFileToId: Map<String, String>,
    ): String? {
        val g = outputPath.trim()
        if (g.contains("*")) {
            if (Regex("""(^|/)specs(/|$)""").containsMatchIn(g) && knownIds.contains("specs")) return "specs"
            return null
        }
        val base = g.split(Regex("""[\\/]""")).last()
        // An exact filename match wins first. Discovery gives a markdown file the bare stem, and a
        // same-stem data file the `-2` suffix (`asyncapi.md` -> `asyncapi`, `asyncapi.yaml` ->
        // `asyncapi-2`). A data artifact's title IS its filename. So a data outputPath resolves to the
        // data id, not the markdown sibling. The stem path below already resolves the markdown side.
        dataFileToId[base]?.let { return it }
        // Otherwise strip the last extension, exactly as ArtifactDiscovery.stripExt does when it assigns
        // the id, so a declared artifact inverts to the same id, not only `.md`. Anchored with `\z` per
        // the repo's filename convention (#33).
        val stem = base.replace(Regex("""\.[^.]+\z"""), "")
        if (knownIds.contains(stem)) return stem
        if (Regex("""^spec\.md$""", RegexOption.IGNORE_CASE).matches(base) &&
            Regex("specs", RegexOption.IGNORE_CASE).containsMatchIn(g) && knownIds.contains("specs")
        ) return "specs"
        return null
    }

    /**
     * 由 refs（schema 權威順序）與已探索的 artifact id 集合，產生排序後的 artifact-id 清單。
     * 每個 ref 依 outputPath 對應到一個已知 id、去重；對不到略過。refs 為 null 或無有效對應時回 null。
     * `dataFileToId` 把 data artifact 的檔名對應到 id，用於區分同 stem 的 markdown / data 手足。
     */
    fun resolveSchemaOrder(
        refs: List<SchemaArtifactRef>?,
        knownIds: List<String>,
        dataFileToId: Map<String, String> = emptyMap(),
    ): List<String>? {
        if (refs == null) return null
        val known = knownIds.toSet()
        val ordered = mutableListOf<String>()
        val used = HashSet<String>()
        for (ref in refs) {
            val id = idForOutputPath(ref.outputPath, known, dataFileToId)
            if (id != null && !used.contains(id)) {
                ordered.add(id)
                used.add(id)
            }
        }
        return if (ordered.isNotEmpty()) ordered else null
    }

    /**
     * The default SchemaOrderProvider: consults the `openspec` CLI for the authoritative order.
     * Returns null when openspec is absent, exits non-zero, answers unreadably, or times out.
     */
    val cli = SchemaOrderProvider { repoRoot, slug, schema ->
        // The slug comes from a directory name. On Windows, ProcessBuilder's argv is re-parsed by
        // cmd.exe when launching openspec.cmd (BatBadBut / CVE-2024-27980) and, unlike Node's
        // cross-spawn on the TypeScript side, it does not escape for us — so an allowlist of safe
        // characters here is what blocks argument injection. A security boundary, not tidiness: do
        // not delete it to "align with the TS side", which excludes injection structurally instead.
        //
        // It sits **outside** the cache: it refuses this one slug while the key is schema-level.
        // Inside `getOrCompute`, a concurrent read of another change in the same bucket would join
        // this entry and take a refusal that is not its own — and it spawns nothing, so there is no
        // run worth sharing. scanner.ts's empty-slug guard sits outside the provider for the same
        // reason, and so does the settlement replay below.
        if (!Regex("""^[\w.-]+$""").matches(slug)) {
            null
        } else {
            // The authoritative order (planningArtifacts + artifactPaths) is a property of the
            // schema, not of the individual change, so the bucket is keyed by schema: every change
            // in a repo sharing that schema spawns the CLI at most once (issue #15). A schema that
            // is null/empty locally shares a repo-level default bucket — the CLI resolves the same
            // built-in default for all of them.
            val key = "$repoRoot::${if (schema.isNullOrEmpty()) DEFAULT_SCHEMA_BUCKET else schema}"
            val settledKey = "$SETTLED_PREFIX$repoRoot::$slug"
            // TTL >= CLI timeout, so a hit inside the window is a completed computation (the CLI has
            // at most 10s) and reuse never re-spawns. After it expires the order is re-read, so a
            // changed artifact order is never cached forever.
            //
            // The bucket is consulted first, and that order is the whole rule: a settled change is
            // still owed its schema's order. Once the bucket holds one — typically fetched by a
            // sibling change after this one was refused — it is this change's too, and
            // resolveSchemaOrder maps it onto this change's own artifacts. The mark replaces a
            // **consultation**, never an answer.
            val held = cache.peek(key)
            if (held != null) {
                held.value
            } else if (settled.isMarked(settledKey)) {
                null
            } else {
                cache.getOrCompute(key) {
                    // A timeout, a non-zero exit and an unreadable body all collapse to null in the
                    // **value**: this caller has one fallback (the frontend's narrative order)
                    // whatever went wrong, so the CLI's failure taxonomy buys nothing there.
                    //
                    // It buys something in the **cache**, so the reason is reconstructed here —
                    // nothing on this side produces one, and without it `isTransient` has no caller.
                    val outcome = cliRunner(listOf("status", "--change", slug, "--json"), repoRoot)
                    val response = when (outcome) {
                        is OpenspecCli.Outcome.Completed ->
                            if (outcome.exitCode == 0) readOrderFromStatus(outcome.stdout) else null
                        else -> null
                    }
                    // A readable body is an answer even when it names no order: the two nulls are
                    // indistinguishable downstream, so they are told apart here.
                    if (response is OrderResponse.Readable) {
                        TtlCache.Outcome.answered(response.refs)
                    } else {
                        val reason = when {
                            outcome is OpenspecCli.Outcome.StartFailed -> SchemaDegradedReason.CLI_UNAVAILABLE
                            outcome is OpenspecCli.Outcome.TimedOut -> SchemaDegradedReason.CLI_TIMEOUT
                            outcome is OpenspecCli.Outcome.Completed && outcome.exitCode != 0 ->
                                SchemaDegradedReason.CLI_FAILED
                            else -> SchemaDegradedReason.CLI_UNPARSABLE
                        }
                        // Marked *inside* the compute — the mirror of reading it outside, and the
                        // opposite answer. This is the only place holding both the reason and the
                        // slug the argv actually named; marked by whoever awaits the provider, a
                        // reader that legitimately joined an in-flight run about another change
                        // would take that run's null and mark itself.
                        if (!OpenspecCli.isTransient(reason)) settled.mark(settledKey)
                        // Never held in the bucket, whatever the reason — see `settled` above.
                        TtlCache.Outcome.failed(null)
                    }
                }
            }
        }
    }

    /**
     * Drop every cached order and every settled change.
     *
     * Both, or a manual Refresh invalidates less than the automatic one beside it: `SpekCaches`
     * drives this from the resync route *and* the file watcher, and a mark surviving it would deny
     * the one change it names a consultation the cache would already have re-run.
     */
    fun clearCache() {
        cache.clear()
        settled.clear()
    }
}
