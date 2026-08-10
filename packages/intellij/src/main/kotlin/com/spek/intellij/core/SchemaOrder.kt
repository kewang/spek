package com.spek.intellij.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

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

    // 快取策略（TTL、size cap、CHM 併發性、可快取 null 值）都在 TtlCache 上，與 SchemaCatalog 共用
    // 同一份實作——這段原本在兩個檔案各寫一次。
    // schema 為 null/空（本地解析不出）時的分桶哨兵：這類 change 由 CLI 解析出同一 repo 級預設順序，
    // 故全部共用此桶。NUL 字元前綴確保絕不與真實 schema 名撞。對齊 @spekjs/core。
    private const val DEFAULT_SCHEMA_BUCKET = "\u0000default"
    // 值型別可為 null——「已查過、但沒有權威順序」也必須是可快取的結果。
    private val cache = TtlCache<String, List<SchemaArtifactRef>?>()

    /**
     * 由 `openspec status --change <slug> --json` 輸出萃取權威順序：
     * actionContext.planningArtifacts 提供順序，artifactPaths[id].outputPath 提供產出路徑。
     * 純函式，方便單元測試；解析不出任何 artifact 時回 null。
     */
    fun parseOrderFromStatus(jsonText: String): List<SchemaArtifactRef>? {
        return try {
            val root = json.parseToJsonElement(jsonText).jsonObject
            val order = root["actionContext"]?.jsonObject?.get("planningArtifacts")?.jsonArray ?: return null
            val paths = root["artifactPaths"]?.jsonObject ?: return null
            val refs = mutableListOf<SchemaArtifactRef>()
            // 逐一以安全轉型跳過壞元素（非字串 id、outputPath 非物件/非字串），與 TS 版一致：
            // 單一壞元素只被略過而非讓整份解析回 null（`?.` / `as?` 不 throw，故不觸發外層 catch）
            for (el in order) {
                val id = (el as? JsonPrimitive)?.takeIf { it.isString }?.content ?: continue
                val outputPath = (paths[id] as? JsonObject)?.get("outputPath")
                    ?.let { it as? JsonPrimitive }?.takeIf { it.isString }?.content ?: continue
                refs.add(SchemaArtifactRef(id, outputPath))
            }
            if (refs.isNotEmpty()) refs else null
        } catch (_: Exception) {
            null
        }
    }

    /** 將 openspec artifact 的 outputPath 對應到已知 artifact id；對不到回 null（glob 僅支援 specs tree） */
    private fun idForOutputPath(outputPath: String, knownIds: Set<String>): String? {
        val g = outputPath.trim()
        if (g.contains("*")) {
            if (Regex("""(^|/)specs(/|$)""").containsMatchIn(g) && knownIds.contains("specs")) return "specs"
            return null
        }
        val base = g.split(Regex("""[\\/]""")).last()
        val stem = base.replace(Regex("""\.md$""", RegexOption.IGNORE_CASE), "")
        if (knownIds.contains(stem)) return stem
        if (Regex("""^spec\.md$""", RegexOption.IGNORE_CASE).matches(base) &&
            Regex("specs", RegexOption.IGNORE_CASE).containsMatchIn(g) && knownIds.contains("specs")
        ) return "specs"
        return null
    }

    /**
     * 由 refs（schema 權威順序）與已探索的 artifact id 集合，產生排序後的 artifact-id 清單。
     * 每個 ref 依 outputPath 對應到一個已知 id、去重；對不到略過。refs 為 null 或無有效對應時回 null。
     */
    fun resolveSchemaOrder(refs: List<SchemaArtifactRef>?, knownIds: List<String>): List<String>? {
        if (refs == null) return null
        val known = knownIds.toSet()
        val ordered = mutableListOf<String>()
        val used = HashSet<String>()
        for (ref in refs) {
            val id = idForOutputPath(ref.outputPath, known)
            if (id != null && !used.contains(id)) {
                ordered.add(id)
                used.add(id)
            }
        }
        return if (ordered.isNotEmpty()) ordered else null
    }

    /**
     * 預設 SchemaOrderProvider：呼叫 openspec CLI 取得權威順序。
     * openspec 未安裝 / 非 0 結束 / archived change / 解析失敗時一律回 null。
     */
    val cli = SchemaOrderProvider { repoRoot, slug, schema ->
        // 權威順序（planningArtifacts + artifactPaths）是 schema 的屬性、非個別 change 的屬性，
        // 故以 schema 分桶：同一 repo 內共用該 schema 的所有 change 至多 spawn 一次 CLI（issue #15）。
        // schema 為 null/空（本地解析不出名稱）→ 共用 repo 級預設桶：CLI 會解析出同一內建預設順序。
        val key = "$repoRoot::${if (schema.isNullOrEmpty()) DEFAULT_SCHEMA_BUCKET else schema}"
        // TTL ≥ CLI timeout：TTL 內的 hit 必已完成計算（CLI 至多 10s），復用安全、不重複 spawn。
        // 過期後（openspec 之後才安裝、artifact 順序改變）自動重查，避免 null / 舊順序被永久快取。
        cache.getOrCompute(key) {
            // slug 來自資料夾名稱。Windows 上以 ProcessBuilder 啟動 openspec.cmd 時，argv 會再經
            // cmd.exe 解析（BatBadBut / CVE-2024-27980），ProcessBuilder 不會像 Node 的 cross-spawn
            // 那樣自動轉義 —— 故此處必須以白名單限定安全字元擋掉 argument injection。此為安全邊界，
            // 勿為「對齊 TS 版」而刪除：TS 改用 cross-spawn 已由結構排除注入，兩邊刻意不同。
            if (!Regex("""^[\w.-]+$""").matches(slug)) {
                null
            } else {
                // 逾時 / 非 0 結束 / 解析失敗一律回 null：此呼叫端只有一種退路（前端退回敘事順序），
                // 故 CLI 的失敗分類在這裡沒有用處，全部收斂成同一個「沒有權威順序」。
                when (val outcome = OpenspecCli.run(listOf("status", "--change", slug, "--json"), repoRoot)) {
                    is OpenspecCli.Outcome.Completed ->
                        if (outcome.exitCode == 0) parseOrderFromStatus(outcome.stdout) else null
                    else -> null
                }
            }
        }
    }

    fun clearCache() = cache.clear()
}
