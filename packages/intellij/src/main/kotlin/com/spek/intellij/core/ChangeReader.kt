package com.spek.intellij.core

import java.io.File

object ChangeReader {

    // orderProvider 可注入以利測試（對齊 @spekjs/core 的 readChange）；預設走真實 CLI provider。
    fun read(
        projectPath: String,
        slug: String,
        orderProvider: SchemaOrderProvider = SchemaOrder.cli,
    ): ChangeDetail? {
        // 空 slug 不是 change：File(base, "") 會指向 changes/ 目錄本身（存在），若不擋下會被當成
        // active change，並以 repo 預設 schema 為 key 把 null 寫進該 schema 的快取桶而污染真實 change。
        if (slug.isEmpty()) return null

        val base = File(projectPath, "openspec/changes")

        // 在 active 和 archive 中尋找
        var changeDir = File(base, slug)
        var status = "active"
        if (!changeDir.exists()) {
            changeDir = File(base, "archive/$slug")
            status = "archived"
        }
        if (!changeDir.exists()) return null

        // 讀取 .openspec.yaml metadata
        val metadata = readMetadata(File(changeDir, ".openspec.yaml"))

        // repo 預設 schema 只讀一次，供 schema fallback 與 defaultSchema 共用（避免重複讀 config.yaml）
        val defaultSchema = readRepoSchema(projectPath)
        // change schema：優先 change .openspec.yaml，否則 fallback 回已算好的 repo 預設（僅供顯示 badge）
        val schema = readChangeSchema(changeDir, defaultSchema)
        // artifact 依 mtime 由新到舊排序（見 ArtifactDiscovery）
        val artifacts = ArtifactDiscovery.discover(changeDir)
        // schema 權威順序（供前端 schema-order 排序用）：只對 active change 查詢 CLI，
        // archived change 無 planningArtifacts，直接為 null（前端顯示 archived 退回訊息）
        // 只對 active change 查 CLI（archived 無 planningArtifacts）。schema 為 null 不代表無權威順序——
        // CLI 會自行解析出內建預設並回傳（provider 內以 repo 級預設桶快取），故 null schema 仍要查。
        val refs = if (status == "active") orderProvider.order(projectPath, slug, schema) else null
        // A data artifact's title is its exact filename, so this maps a declared data outputPath to the
        // right id even when a markdown sibling shares its stem (asyncapi.md + asyncapi.yaml).
        val dataFileToId = artifacts.filter { it.kind == "data" }.associate { it.title to it.id }
        val schemaOrder = SchemaOrder.resolveSchemaOrder(refs, artifacts.map { it.id }, dataFileToId)
        // Timeline 生命週期：重用 scanner 的 createdDate 解析；archivedDate 依 status 判定
        val createdDate = OpenSpecScanner.readCreatedDate(changeDir)
        val archivedDate = if (status == "archived") parseSlug(slug).first else null

        return ChangeDetail(
            slug = slug,
            status = status,
            schema = schema,
            defaultSchema = defaultSchema,
            artifacts = artifacts,
            schemaOrder = schemaOrder,
            createdDate = createdDate,
            archivedDate = archivedDate,
            metadata = metadata,
        )
    }

    private fun readMetadata(file: File): Map<String, String>? {
        if (!file.exists()) return null
        val result = mutableMapOf<String, String>()
        for (line in file.readLines()) {
            val match = Regex("""^(\w+):\s*(.+)$""").find(line)
            if (match != null) {
                result[match.groupValues[1]] = match.groupValues[2].trim()
            }
        }
        return result
    }

    /** change schema：change .openspec.yaml 的 schema → 已算好的 repo 預設（defaultSchema）→ null */
    private fun readChangeSchema(changeDir: File, defaultSchema: String?): String? {
        val changeYaml = File(changeDir, ".openspec.yaml")
        if (changeYaml.exists()) {
            val meta = readMetadata(changeYaml)
            meta?.get("schema")?.let { return cleanScalar(it) }
        }
        return defaultSchema
    }

    private fun readRepoSchema(projectPath: String): String? {
        val config = File(projectPath, "openspec/config.yaml")
        if (!config.exists()) return null
        val m = Regex("""^schema:\s*(.+)$""", RegexOption.MULTILINE).find(config.readText())
        return m?.groupValues?.get(1)?.let { cleanScalar(it) }
    }
}
