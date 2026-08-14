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

    // 快取策略（TTL、size cap、CHM 併發性、哪些失敗值得記住）都在 TtlCache 上，與 SchemaCatalog
    // 共用同一份實作——這段原本在兩個檔案各寫一次。
    // schema 為 null/空（本地解析不出）時的分桶哨兵：這類 change 由 CLI 解析出同一 repo 級預設順序，
    // 故全部共用此桶。NUL 字元前綴確保絕不與真實 schema 名撞。對齊 @spekjs/core。
    private const val DEFAULT_SCHEMA_BUCKET = "\u0000default"
    // 值型別可為 null——「已查過、但沒有權威順序」是一個答案，與其他答案一樣要快取；查不到才不留。
    private val cache = TtlCache<String, List<SchemaArtifactRef>?>()

    /**
     * CLI 執行器的注入點，讓測試不必真的 spawn。`internal` 而非 private：與 [SchemaCatalog] 的
     * `cliRunner` 同一個作法，也是唯一能測到下面那道 slug 白名單（安全邊界）的方式。
     */
    internal var cliRunner: (List<String>, String) -> OpenspecCli.Outcome =
        { args, cwd -> OpenspecCli.run(args, cwd) }

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
        // slug 來自資料夾名稱。Windows 上以 ProcessBuilder 啟動 openspec.cmd 時，argv 會再經
        // cmd.exe 解析（BatBadBut / CVE-2024-27980），ProcessBuilder 不會像 Node 的 cross-spawn
        // 那樣自動轉義 —— 故此處必須以白名單限定安全字元擋掉 argument injection。此為安全邊界，
        // 勿為「對齊 TS 版」而刪除：TS 改用 cross-spawn 已由結構排除注入，兩邊刻意不同。
        //
        // 這道判斷在快取**之外**：它拒絕的是這一個 slug，而 key 是 schema 級的。放進 getOrCompute
        // 裡的話，同桶其他 change 的併發讀會 join 到這個 entry、拿到不屬於它們的拒絕；而它根本不
        // spawn，也就沒有任何 run 值得共用。scanner.ts 的空 slug guard 擋在 provider 外面同理。
        if (!Regex("""^[\w.-]+$""").matches(slug)) {
            null
        } else {
            // 權威順序（planningArtifacts + artifactPaths）是 schema 的屬性、非個別 change 的屬性，
            // 故以 schema 分桶：同一 repo 內共用該 schema 的所有 change 至多 spawn 一次 CLI（issue #15）。
            // schema 為 null/空（本地解析不出名稱）→ 共用 repo 級預設桶：CLI 會解析出同一內建預設順序。
            val key = "$repoRoot::${if (schema.isNullOrEmpty()) DEFAULT_SCHEMA_BUCKET else schema}"
            // TTL ≥ CLI timeout：TTL 內的 hit 必已完成計算（CLI 至多 10s），復用安全、不重複 spawn。
            // 過期後（artifact 順序改變）自動重查，舊順序不會被永久快取。
            cache.getOrCompute(key) {
                // 逾時 / 非 0 結束 / 解析失敗一律回 null：此呼叫端只有一種退路（前端退回敘事順序），
                // 故 CLI 的失敗分類在**值**上沒有用處，全部收斂成同一個「沒有權威順序」。
                //
                // 但在**快取**上有：查不到就一律不記住，連 isTransient 視為確定的那兩種也一樣，
                // 理由與環境無關 —— key 講的是 schema、argv 講的是 change。非 0 結束通常正是 CLI
                // 拒絕了這一個 slug，那不是這個桶該保管的答案，記住它等於讓同 schema 的其他 change
                // 在整個視窗內都拿不到順序。
                when (val outcome = cliRunner(listOf("status", "--change", slug, "--json"), repoRoot)) {
                    is OpenspecCli.Outcome.Completed ->
                        if (outcome.exitCode == 0) {
                            // 成功但解析為 null 是「CLI 回報沒有順序」，那是答案：兩種 null 在下游
                            // 分不出來，所以在這裡分。
                            TtlCache.Outcome.answered(parseOrderFromStatus(outcome.stdout))
                        } else {
                            TtlCache.Outcome.failed(null)
                        }
                    else -> TtlCache.Outcome.failed(null)
                }
            }
        }
    }

    fun clearCache() = cache.clear()
}
