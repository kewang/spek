package com.spek.intellij.core

/**
 * Kotlin mirror of `parseTasks` in @spekjs/core. The folding rules must stay identical to the
 * TypeScript version — see `packages/core/src/tasks.ts` and the matching tests on both sides.
 */
object TaskParser {
    // Anchored at column 0 on purpose: an indented checkbox is part of its parent task's text, not a
    // task of its own. Relaxing this would silently change every total / completed and CI badge.
    private val CHECKBOX_RE = Regex("""^- \[([ xX])] (.+)$""")
    private val SECTION_RE = Regex("""^## (.+)$""")

    // Width of the "- " list marker, i.e. CommonMark's content offset for these items. Continuation
    // lines are dedented by this much so the folded text renders the way a standard renderer shows
    // the original source — no more.
    private const val CONTENT_OFFSET = 2

    private fun dedentContinuation(line: String): String {
        var n = 0
        while (n < CONTENT_OFFSET && n < line.length && (line[n] == ' ' || line[n] == '\t')) n++
        return line.substring(n)
    }

    private fun leadingWhitespace(line: String): Int {
        var n = 0
        while (n < line.length && (line[n] == ' ' || line[n] == '\t')) n++
        return n
    }

    private class Pending(val first: String, val completed: Boolean) {
        val rest = mutableListOf<String>()
    }

    fun parse(content: String): ParsedTasks {
        val lines = content.replace("\r\n", "\n").split("\n")
        val sections = mutableListOf<TaskSection>()
        var currentTitle = ""
        var currentTasks = mutableListOf<TaskItem>()
        var total = 0
        var completed = 0

        // The task still accepting continuation lines, and whether a blank line has intervened since
        // its last content line. Only whether one occurred matters, not how many.
        var pending: Pending? = null
        var sawBlank = false

        fun flush() {
            val task = pending ?: return
            val rest = task.rest
            while (rest.isNotEmpty() && rest[rest.size - 1].isBlank()) rest.removeAt(rest.size - 1)
            // With continuation lines the first line is kept verbatim: two trailing spaces are a hard
            // line break, and trimming them would quietly downgrade it to a soft one.
            val text = if (rest.isNotEmpty()) {
                (listOf(task.first) + rest.map { if (it.isBlank()) "" else dedentContinuation(it) })
                    .joinToString("\n")
            } else {
                task.first.trim()
            }
            currentTasks.add(TaskItem(text, task.completed))
            total++
            if (task.completed) completed++
            pending = null
        }

        for (line in lines) {
            val sectionMatch = SECTION_RE.find(line)
            if (sectionMatch != null) {
                flush()
                if (currentTasks.isNotEmpty()) {
                    sections.add(TaskSection(currentTitle, currentTasks.toList()))
                }
                currentTitle = sectionMatch.groupValues[1].trim()
                currentTasks = mutableListOf()
                sawBlank = false
                continue
            }

            val taskMatch = CHECKBOX_RE.find(line)
            if (taskMatch != null) {
                flush()
                pending = Pending(
                    taskMatch.groupValues[2],
                    taskMatch.groupValues[1].lowercase() == "x",
                )
                sawBlank = false
                continue
            }

            val task = pending ?: continue

            if (line.isBlank()) {
                sawBlank = true
                task.rest.add(line)
                continue
            }

            // Lazy continuation runs on at any indentation, but once a blank line intervenes the line
            // must reach the content offset to stay inside the item — otherwise a standard renderer
            // puts it in its own paragraph outside the list, so it is not part of this task.
            if (sawBlank && leadingWhitespace(line) < CONTENT_OFFSET) {
                flush()
                sawBlank = false
                continue
            }

            sawBlank = false
            task.rest.add(line)
        }

        flush()

        if (currentTasks.isNotEmpty()) {
            sections.add(TaskSection(currentTitle, currentTasks.toList()))
        }

        return ParsedTasks(total, completed, sections)
    }
}
