package com.spek.intellij.core

import java.io.File
import java.nio.file.Files
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ArtifactDiscoveryTest {

    private val tempDirs = mutableListOf<File>()

    private fun mkRepo(): File {
        val dir = Files.createTempDirectory("spek-kt-test-").toFile()
        tempDirs.add(dir)
        return dir
    }

    private fun writeChange(repo: File, slug: String, files: Map<String, String>): File {
        val changeDir = File(repo, "openspec/changes/$slug")
        changeDir.mkdirs()
        for ((rel, content) in files) {
            val full = File(changeDir, rel)
            full.parentFile.mkdirs()
            full.writeText(content)
        }
        return changeDir
    }

    // 明確設定某檔案的 mtime（秒），讓排序測試不受寫入時序影響
    private fun setMtime(changeDir: File, rel: String, seconds: Long) {
        File(changeDir, rel).setLastModified(seconds * 1000L)
    }

    // 讓 change 內所有 *.md（含 specs 內）共用同一 mtime，以觸發「mtime 完全相同」的 tiebreak
    // （非模擬 clone —— 實際 clone/checkout 會寫出各異的 mtime；此處刻意壓平以測 tiebreak 分支）
    private fun levelMtimes(dir: File, seconds: Long) {
        dir.listFiles()?.forEach { f ->
            if (f.isDirectory) levelMtimes(f, seconds)
            else if (f.name.lowercase().endsWith(".md")) f.setLastModified(seconds * 1000L)
        }
    }

    @AfterTest
    fun cleanup() {
        tempDirs.forEach { it.deleteRecursively() }
    }

    @Test
    fun ordersByMtimeNewestFirst() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "add-foo",
            mapOf(
                "proposal.md" to "## Why\n",
                "design.md" to "## Context\n",
                "tasks.md" to "## 1. Group\n\n- [x] 1.1 done\n- [ ] 1.2 todo\n",
            ),
        )
        setMtime(changeDir, "proposal.md", 1000)
        setMtime(changeDir, "design.md", 2000)
        setMtime(changeDir, "tasks.md", 3000) // newest -> first
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("tasks", "design", "proposal"), arts.map { it.id })
    }

    @Test
    fun preservesKindsAndParsedDataWhileOrderingByMtime() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "add-foo",
            mapOf(
                "proposal.md" to "## Why\n",
                "tasks.md" to "## 1. Group\n\n- [x] 1.1 done\n- [ ] 1.2 todo\n",
                "specs/foo/spec.md" to "## ADDED Requirements\n",
            ),
        )
        setMtime(changeDir, "proposal.md", 3000) // newest markdown
        setMtime(changeDir, "tasks.md", 1000)
        setMtime(changeDir, "specs/foo/spec.md", 2000)
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("proposal", "specs", "tasks"), arts.map { it.id })
        val specs = arts.first { it.id == "specs" }
        assertEquals("specs", specs.kind)
        assertEquals(listOf("foo"), specs.specs?.map { it.topic })
        val tasks = arts.first { it.id == "tasks" }
        assertEquals("tasks", tasks.kind)
        assertEquals(2, tasks.tasks?.total)
        assertEquals(1, tasks.tasks?.completed)
    }

    @Test
    fun specsSortsByNewestDeltaFile() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "x\n",
                "specs/foo/spec.md" to "x\n",
                "specs/bar/spec.md" to "x\n",
            ),
        )
        setMtime(changeDir, "proposal.md", 3000)
        setMtime(changeDir, "specs/bar/spec.md", 2000)
        setMtime(changeDir, "specs/foo/spec.md", 5000) // newest delta -> specs leads
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("specs", "proposal"), arts.map { it.id })
    }

    @Test
    fun equalMtimesFallBackToDefaultOrder() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "zebra.md" to "x\n",
                "tasks.md" to "## 1. G\n\n- [ ] 1.1 a\n",
                "apple.md" to "x\n",
                "proposal.md" to "x\n",
                "specs/foo/spec.md" to "x\n",
            ),
        )
        levelMtimes(changeDir, 1000) // force identical mtimes to exercise the equal-mtime tiebreak
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("proposal", "specs", "tasks", "apple", "zebra"), arts.map { it.id })
    }

    @Test
    fun rootSpecsMdCoexistsWithSpecsTreeWithoutLosingContent() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "## Why\n",
                "specs.md" to "## Root specs doc\n",
                "specs/foo/spec.md" to "## ADDED\n",
            ),
        )
        // distinct mtimes so order is deterministic and independent of the equal-mtime tiebreak
        setMtime(changeDir, "proposal.md", 3000)
        setMtime(changeDir, "specs.md", 2000)
        setMtime(changeDir, "specs/foo/spec.md", 1000)
        val arts = ArtifactDiscovery.discover(changeDir)
        // the delta tree keeps the canonical id "specs"; root specs.md is disambiguated to "specs-2"
        val tree = arts.first { it.kind == "specs" }
        assertEquals("specs", tree.id)
        val rootDoc = arts.first { it.kind == "markdown" && it.content == "## Root specs doc\n" }
        assertEquals("specs-2", rootDoc.id) // content preserved, not overwritten by the tree
        assertEquals(3, arts.size)
        assertEquals(3, ArtifactFiles.count(changeDir))
        // mtime keyed by the ALLOCATED id: root specs.md (2000) must sort above the tree (1000)
        assertEquals(listOf("proposal", "specs-2", "specs"), arts.map { it.id })
    }

    @Test
    fun loneRootSpecsMdKeepsCanonicalId() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "## Why\n",
                "specs.md" to "## Root specs doc\n",
            ),
        )
        val arts = ArtifactDiscovery.discover(changeDir)
        val specsDoc = arts.first { it.content == "## Root specs doc\n" }
        assertEquals("specs", specsDoc.id) // no tree to collide with → no disambiguating suffix
        assertEquals(2, arts.size)
        assertEquals(2, ArtifactFiles.count(changeDir))
    }

    @Test
    fun idDisambiguationLoopsPastTakenSuffix() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "specs.md" to "root\n",
                "specs-2.md" to "sibling\n",
                "specs/foo/spec.md" to "## ADDED\n",
            ),
        )
        val arts = ArtifactDiscovery.discover(changeDir)
        // tree = "specs"; the two root files take "specs-2" and "specs-3" — no collision, no loss
        assertEquals(listOf("specs", "specs-2", "specs-3"), arts.map { it.id }.sorted())
        assertEquals(3, arts.size)
        assertEquals(3, ArtifactFiles.count(changeDir))
        val contents = arts.filter { it.kind == "markdown" }.mapNotNull { it.content }.sorted()
        assertEquals(listOf("root\n", "sibling\n"), contents)
    }

    @Test
    fun customSchemaFilesOrderedByMtime() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "bridge-change",
            mapOf(
                "brainstorm.md" to "raw\n",
                "proposal.md" to "## Why\n",
                "plan.md" to "plan\n",
                "verify.md" to "verify\n",
                "retrospective.md" to "retro\n",
            ),
        )
        setMtime(changeDir, "brainstorm.md", 1000)
        setMtime(changeDir, "proposal.md", 2000)
        setMtime(changeDir, "plan.md", 5000) // newest
        setMtime(changeDir, "verify.md", 3000)
        setMtime(changeDir, "retrospective.md", 4000)
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(
            listOf("plan", "retrospective", "verify", "proposal", "brainstorm"),
            arts.map { it.id },
        )
        val retro = arts.first { it.id == "retrospective" }
        assertEquals("Retrospective", retro.title)
        assertEquals("markdown", retro.kind)
    }

    @Test
    fun ignoresDotfilesAndNonMarkdown() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "## Why\n",
                ".openspec.yaml" to "schema: spec-driven\n",
                "notes.txt" to "ignore me\n",
            ),
        )
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("proposal"), arts.map { it.id })
    }

    @Test
    fun countsRootMarkdownPlusSpecs() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "x\n",
                "design.md" to "x\n",
                "tasks.md" to "x\n",
                "specs/foo/spec.md" to "x\n",
                ".openspec.yaml" to "schema: spec-driven\n",
                "notes.txt" to "x\n",
            ),
        )
        assertEquals(4, ArtifactFiles.count(changeDir))
    }

    // --- data artifacts (.yaml / .yml / .json) ---

    @Test
    fun rootYamlYmlJsonSurfaceAsDataArtifactsTitledWithExtension() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "event-change",
            mapOf(
                "proposal.md" to "## Why\n",
                "asyncapi.yaml" to "asyncapi: 3.0.0\n",
                "config.yml" to "a: 1\n",
                "schema.json" to "{\"x\":1}\n",
            ),
        )
        val arts = ArtifactDiscovery.discover(changeDir)
        val async = arts.first { it.title == "asyncapi.yaml" }
        assertEquals("data", async.kind)
        assertEquals("asyncapi", async.id) // id is the stem; title keeps the extension
        assertEquals("asyncapi: 3.0.0\n", async.content)
        assertEquals("data", arts.first { it.title == "config.yml" }.kind)
        assertEquals("data", arts.first { it.title == "schema.json" }.kind)
        assertEquals("markdown", arts.first { it.id == "proposal" }.kind)
        assertEquals(4, arts.size)
    }

    @Test
    fun openspecYamlDotfileIsNeverADataArtifact() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf("proposal.md" to "## Why\n", ".openspec.yaml" to "schema: spec-driven\n"),
        )
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("proposal"), arts.map { it.id })
        assertFalse(arts.any { it.kind == "data" })
    }

    @Test
    fun jsonInASubdirectoryIsNotDiscovered() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf("proposal.md" to "## Why\n", "nested/data.json" to "{\"deep\":true}\n"),
        )
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("proposal"), arts.map { it.id }) // subdir json ignored (root-only)
    }

    @Test
    fun specMdAndSpecJsonGetDifferentIdsMarkdownWinsTheStem() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf("spec.md" to "## markdown\n", "spec.json" to "{\"data\":1}\n"),
        )
        val arts = ArtifactDiscovery.discover(changeDir)
        val md = arts.first { it.kind == "markdown" }
        val data = arts.first { it.kind == "data" }
        assertEquals("spec", md.id) // markdown producer runs before data → keeps the bare stem
        assertEquals("spec-2", data.id) // data disambiguated, no content lost
        assertEquals("spec.json", data.title) // tab label keeps the extension
        assertEquals(2, arts.size)
    }

    @Test
    fun dataArtifactsAreCountedCountEqualsTabCount() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "## Why\n",
                "asyncapi.yaml" to "asyncapi: 3.0.0\n",
                "specs/foo/spec.md" to "## ADDED\n",
            ),
        )
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(3, arts.size) // proposal + asyncapi (data) + specs
        assertEquals(3, ArtifactFiles.count(changeDir))
    }

    @Test
    fun artifactFilesIncludesMarkdownTasksDataExcludesDotfilesAndSubdirs() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "## Why\n",
                "tasks.md" to "- [ ] a\n",
                "asyncapi.yaml" to "asyncapi: 3.0.0\n",
                "schema.json" to "{}\n",
                ".openspec.yaml" to "schema: spec-driven\n",
                "nested/data.json" to "{}\n",
                "specs/foo/spec.md" to "## ADDED\n",
            ),
        )
        assertEquals(
            listOf("asyncapi.yaml", "proposal.md", "schema.json", "tasks.md"),
            ArtifactFiles.artifactFiles(changeDir).map { it.name },
        )
    }

    @Test
    fun searchFindsContentInsideADataArtifact() {
        val repo = mkRepo()
        writeChange(
            repo, "add-events",
            mapOf(
                "proposal.md" to "## Why\n",
                "asyncapi.yaml" to "asyncapi: 3.0.0\nchannels:\n  userSignedUp:\n    address: user.signedup\n",
            ),
        )
        val results = SearchService.search(repo.absolutePath, "userSignedUp")
        assertTrue(
            results.any { it.type == "change" && it.slug == "add-events" },
            "the change whose asyncapi.yaml holds the match is returned",
        )
    }
}
