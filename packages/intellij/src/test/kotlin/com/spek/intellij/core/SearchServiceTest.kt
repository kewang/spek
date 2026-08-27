package com.spek.intellij.core

import java.io.File
import java.nio.file.Files
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class SearchServiceTest {

    private val tempDirs = mutableListOf<File>()

    private fun mkRepo(files: Map<String, String>): File {
        val repo = Files.createTempDirectory("spek-search-kt-").toFile()
        tempDirs.add(repo)
        for ((rel, content) in files) {
            val full = File(repo, "openspec/$rel")
            full.parentFile.mkdirs()
            full.writeText(content)
        }
        return repo
    }

    @AfterTest
    fun cleanup() {
        tempDirs.forEach { it.deleteRecursively() }
    }

    // The regression this pins: for a slug match the reported snippet must come from a markdown file, not
    // the alphabetically-first data file. `asyncapi.yaml` sorts before `design.md` by name. But the search
    // iterates markdown-first (rootArtifacts order), so a slug search previews the design prose, not YAML.
    @Test
    fun slugMatchPreviewsMarkdownNotTheAlphabeticallyFirstDataFile() {
        val repo = mkRepo(
            mapOf(
                "changes/add-events/design.md" to "# Design\nEvent-driven design prose.\n",
                "changes/add-events/asyncapi.yaml" to "asyncapi: 3.0.0\ndeadLetterId: dlq-1\n",
            ),
        )
        val hits = SearchService.search(repo.path, "add-events").filter { it.type == "change" }
        assertEquals(1, hits.size)
        assertEquals("design.md", hits[0].file, "a slug match must preview markdown, not asyncapi.yaml")
    }

    // The other half of the fix: a data file must still be reachable for a content-only match (a query
    // that is not in the slug and not in any markdown file).
    @Test
    fun contentOnlyMatchInADataFileIsStillFound() {
        val repo = mkRepo(
            mapOf(
                "changes/add-events/design.md" to "# Design\nEvent-driven design prose.\n",
                "changes/add-events/asyncapi.yaml" to "asyncapi: 3.0.0\ndeadLetterId: dlq-1\n",
            ),
        )
        val hits = SearchService.search(repo.path, "deadLetterId").filter { it.type == "change" }
        assertEquals(1, hits.size)
        assertNotNull(hits[0].file)
        assertEquals("asyncapi.yaml", hits[0].file, "content unique to the data file is still searchable")
    }
}
