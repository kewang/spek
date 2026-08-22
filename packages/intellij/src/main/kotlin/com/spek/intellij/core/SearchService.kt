package com.spek.intellij.core

import java.io.File

object SearchService {

    fun search(projectPath: String, query: String): List<SearchResult> {
        if (query.isBlank()) return emptyList()

        val results = mutableListOf<SearchResult>()
        val lowerQuery = query.lowercase()
        val base = File(projectPath, "openspec")

        // 搜尋 specs
        val specsDir = File(base, "specs")
        if (specsDir.isDirectory) {
            specsDir.listFiles()
                ?.filter { it.isDirectory && !it.name.startsWith(".") }
                ?.forEach { topicDir ->
                    val specFile = File(topicDir, "spec.md")
                    if (specFile.exists()) {
                        val content = specFile.readText()
                        if (topicDir.name.lowercase().contains(lowerQuery) ||
                            content.lowercase().contains(lowerQuery)
                        ) {
                            results.add(
                                SearchResult(
                                    type = "spec",
                                    title = topicDir.name,
                                    topic = topicDir.name,
                                    context = extractContext(content, lowerQuery),
                                    file = "spec.md",
                                )
                            )
                        }
                    }
                }
        }

        // 搜尋 changes（active + archived）
        searchChangesDir(File(base, "changes"), lowerQuery, results)
        searchChangesDir(File(base, "changes/archive"), lowerQuery, results)

        return results
    }

    private fun searchChangesDir(
        dir: File,
        lowerQuery: String,
        results: MutableList<SearchResult>,
    ) {
        if (!dir.isDirectory) return
        dir.listFiles()
            ?.filter { it.isDirectory && it.name != "archive" && !it.name.startsWith(".") }
            ?.forEach { changeDir ->
                val slug = changeDir.name
                // Index every root artifact file of the change (markdown, tasks, and data, including
                // custom-schema files like brainstorm/plan/verify), from the same ArtifactFiles list the
                // tabs and the count use. So any tab that comes from a root file is searchable. The specs
                // delta tree is not indexed here, as before.
                val files = ArtifactFiles.artifactFiles(changeDir)
                for (file in files) {
                    val content = file.readText()
                    if (slug.lowercase().contains(lowerQuery) ||
                        content.lowercase().contains(lowerQuery)
                    ) {
                        val (_, description) = parseSlug(slug)
                        results.add(
                            SearchResult(
                                type = "change",
                                title = description,
                                slug = slug,
                                context = extractContext(content, lowerQuery),
                                file = file.name,
                            )
                        )
                        break // 每個 change 只回傳一次
                    }
                }
            }
    }

    private fun extractContext(content: String, lowerQuery: String): String {
        val lowerContent = content.lowercase()
        val idx = lowerContent.indexOf(lowerQuery)
        if (idx < 0) return content.take(200)

        val start = maxOf(0, idx - 100)
        val end = minOf(content.length, idx + lowerQuery.length + 100)
        val snippet = content.substring(start, end)
        return (if (start > 0) "..." else "") + snippet + (if (end < content.length) "..." else "")
    }
}
