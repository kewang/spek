package com.spek.intellij.core

import java.io.File

/**
 * Aligned with @spekjs/core's artifact-discovery.ts. It builds ChangeArtifact objects for one change directory.
 * ArtifactFiles lists which files are artifacts. This object reads their content and builds the objects.
 * discover is the only entry point, and the only place that reads artifact content. It does not call the
 * openspec CLI.
 */
object ArtifactDiscovery {

    private val DEFAULT_ORDER = listOf("proposal", "design", "specs", "tasks")

    /** Build a display title from a filename stem: dash/underscore to space, then title case. */
    private fun humanize(stem: String): String {
        return stem.replace(Regex("""[-_]+"""), " ").trim()
            .split(" ")
            .joinToString(" ") { w -> if (w.isEmpty()) w else w.replaceFirstChar { it.uppercase() } }
    }

    /** Remove the last extension (`asyncapi.yaml` to `asyncapi`, `proposal.md` to `proposal`). Anchored
     *  with `\z` to follow the repo's filename convention (#33), where Java's `$` can match before a
     *  trailing line terminator. For this pattern the greedy `[^.]+` already consumes any trailing
     *  newline, so `\z` and `$` coincide here. `\z` is used for consistency, not to fix an active bug. */
    private fun stripExt(file: String): String = file.replace(Regex("""\.[^.]+\z"""), "")

    /** Assign an id that is not yet used. If base is taken, try base-2, base-3, and so on, then record it.
     *  This resolves the clash between a root specs.md and the specs delta tree over the "specs" id. */
    private fun uniqueId(base: String, used: MutableSet<String>): String {
        var id = base
        var n = 2
        while (used.contains(id)) id = "$base-${n++}"
        used.add(id)
        return id
    }

    /** Build one root-file artifact from its kind and content. The when is exhaustive over RootKind, so a
     *  new root kind is a compile error until it gets a branch. */
    private fun buildArtifact(id: String, file: File, kind: ArtifactFiles.RootKind, content: String): ChangeArtifact =
        when (kind) {
            ArtifactFiles.RootKind.TASKS ->
                ChangeArtifact(id = id, title = humanize(stripExt(file.name)), kind = "tasks", tasks = TaskParser.parse(content))
            ArtifactFiles.RootKind.MARKDOWN ->
                ChangeArtifact(id = id, title = humanize(stripExt(file.name)), kind = "markdown", content = content)
            // A data artifact keeps its extension in the title (`asyncapi.yaml`). The frontend derives the
            // fence language from the extension.
            ArtifactFiles.RootKind.DATA ->
                ChangeArtifact(id = id, title = file.name, kind = "data", content = content)
        }

    /**
     * Discover a change directory's artifacts from disk. It builds one artifact per root file and one for a
     * non-empty specs tree, then sorts by mtime, newest first.
     *
     * The id-dedup precedence is: specs first, then root files in rootArtifacts order (markdown/tasks before
     * data). So a root specs.md becomes specs-2, spec.md keeps "spec", and spec.json becomes spec-2. This
     * order decides the ids only. The display order is the mtime sort at the end.
     *
     * A root file takes its own mtime. specs takes the newest mtime of its delta files. Two artifacts tie
     * only when their mtime is exactly equal. The tiebreak is then DEFAULT_ORDER first, then alphabetical.
     * Note that git clone and git checkout usually write a different mtime per file. So this default mode
     * does not guarantee the proposal, design, ... narrative order for a fresh checkout. For authored order,
     * use the frontend Schema order or A-Z.
     */
    fun discover(changeDir: File): List<ChangeArtifact> {
        val used = HashSet<String>()

        class Item(val artifact: ChangeArtifact, val mtime: Long)
        val items = mutableListOf<Item>()

        // specs reserves the "specs" id first (see the precedence note above).
        val specs = ArtifactFiles.listSpecFiles(changeDir)
        if (specs.isNotEmpty()) {
            used.add("specs")
            items.add(
                Item(
                    ChangeArtifact(
                        id = "specs",
                        title = "Specs",
                        kind = "specs",
                        specs = specs.map { (topic, file) -> ChangeSpec(topic, file.readText()) },
                    ),
                    ArtifactFiles.specsMtime(changeDir),
                )
            )
        }

        for ((file, kind) in ArtifactFiles.rootArtifacts(changeDir)) {
            val id = uniqueId(stripExt(file.name), used)
            items.add(Item(buildArtifact(id, file, kind, file.readText()), file.lastModified()))
        }

        return items.sortedWith(
            Comparator { a, b ->
                if (a.mtime != b.mtime) return@Comparator b.mtime.compareTo(a.mtime)
                val ia = DEFAULT_ORDER.indexOf(a.artifact.id).let { if (it == -1) Int.MAX_VALUE else it }
                val ib = DEFAULT_ORDER.indexOf(b.artifact.id).let { if (it == -1) Int.MAX_VALUE else it }
                if (ia != ib) ia - ib else a.artifact.id.compareTo(b.artifact.id)
            }
        ).map { it.artifact }
    }
}
