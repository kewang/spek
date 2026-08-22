package com.spek.intellij.core

import java.io.File

/**
 * Aligned with @spekjs/core's artifact-files.ts. The filesystem view of one change directory: which files
 * are artifacts, their kinds, their names, and their mtimes. Everything here reads directory entries and
 * stats only. It does not read file content. ArtifactDiscovery.discover builds the ChangeArtifact objects
 * on top of this list.
 */
object ArtifactFiles {

    private val DATA_EXTENSIONS = listOf(".yaml", ".yml", ".json")

    /** The kind of a root-level artifact file. specs is not here: it is a tree, not a root file. */
    enum class RootKind { TASKS, MARKDOWN, DATA }

    private fun isTasksName(n: String) = n == "tasks.md"
    private fun isMarkdownName(n: String) = n.endsWith(".md")
    private fun isDataName(n: String) = DATA_EXTENSIONS.any { n.endsWith(it) }

    /**
     * The one classifier for root files. It returns the artifact kind of a root filename, or null if the
     * file is not an artifact. count, search, and discover all go through it, so a new root kind cannot
     * slip past one of them.
     */
    private fun rootKind(nameLower: String): RootKind? = when {
        isTasksName(nameLower) -> RootKind.TASKS
        isMarkdownName(nameLower) -> RootKind.MARKDOWN
        isDataName(nameLower) -> RootKind.DATA
        else -> null
    }

    /**
     * The root artifact files with their kinds, in id-dedup precedence: markdown and tasks first, then
     * data. This order lets spec.md keep the id "spec" and pushes spec.json to spec-2. discover builds
     * from this list. The display order is a separate mtime sort in discover. It does one directory read
     * and partitions the entries by kind.
     */
    fun rootArtifacts(changeDir: File): List<Pair<File, RootKind>> {
        val md = mutableListOf<File>()
        val data = mutableListOf<File>()
        changeDir.listFiles()?.forEach { f ->
            if (!f.isFile || f.name.startsWith(".")) return@forEach
            when (rootKind(f.name.lowercase())) {
                RootKind.DATA -> data.add(f)
                RootKind.TASKS, RootKind.MARKDOWN -> md.add(f)
                null -> {}
            }
        }
        md.sortBy { it.name }
        data.sortBy { it.name }
        return (md + data).map { it to rootKind(it.name.lowercase())!! }
    }

    /**
     * The specs/ delta tree as a (topic, file) list, sorted by topic. It reads directory entries and tests
     * for each spec.md. It does not read content. hasSpecsTree, specsMtime, and the spec content read in
     * ArtifactDiscovery.discover all derive from it, so the tree walk is written one time.
     */
    fun listSpecFiles(changeDir: File): List<Pair<String, File>> {
        val specsDir = File(changeDir, "specs")
        if (!specsDir.isDirectory) return emptyList()
        return specsDir.listFiles()
            ?.filter { it.isDirectory && !it.name.startsWith(".") }
            ?.mapNotNull { topicDir ->
                val specFile = File(topicDir, "spec.md")
                if (specFile.exists()) topicDir.name to specFile else null
            }
            ?.sortedBy { it.first }
            ?: emptyList()
    }

    /** True if specs/ holds at least one spec.md. It reads no content. */
    private fun hasSpecsTree(changeDir: File): Boolean = listSpecFiles(changeDir).isNotEmpty()

    /** The sort time of the specs artifact: the newest mtime of every spec.md file (0 if none). */
    fun specsMtime(changeDir: File): Long =
        listSpecFiles(changeDir).maxOfOrNull { (_, file) -> file.lastModified() } ?: 0L

    /**
     * The root files that count as a searchable artifact (markdown, tasks, and data), sorted by name. The
     * SearchService index shares this list, so any tab that comes from a root file is indexed. The specs
     * delta tree is not here: its content does not go into search.
     */
    fun artifactFiles(changeDir: File): List<File> =
        rootArtifacts(changeDir).map { it.first }.sortedBy { it.name }

    /** The artifact count (the root artifact files, plus 1 for a non-empty specs tree). It reads no
     *  content, and returns 0 for a missing changeDir. */
    fun count(changeDir: File): Int =
        rootArtifacts(changeDir).size + if (hasSpecsTree(changeDir)) 1 else 0
}
