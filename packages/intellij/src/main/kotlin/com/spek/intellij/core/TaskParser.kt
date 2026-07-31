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

    // A column-0 line that opens a new block, which ends the preceding item rather than continuing
    // it. CommonMark's lazy continuation only runs on for *paragraph* text: any line that starts a
    // block interrupts the paragraph, so a standard renderer puts it outside the list. See the
    // TypeScript original for what is deliberately left out (HTML blocks, fence tracking, setext).
    //
    // `\z` where the TypeScript side writes `$`: on an already-split line JS's `$` means the absolute
    // end of the string, which is Kotlin's `\z` — Kotlin's own `$` would also match before a trailing
    // `\r`. Likewise `[ \t]` rather than `\s`, whose membership differs between the two engines.
    // The two patterns must stay literally translatable.
    private val BLOCK_OPENER_RE = Regex(
        "^(?:" +
            listOf(
                """#{1,6}(?:[ \t]|\z)""", // ATX heading ("## " is handled earlier by SECTION_RE)
                """>""", // blockquote
                """[-+*](?:[ \t]|\z)""", // bullet list item ("- [x] " handled earlier by CHECKBOX_RE)
                // Any ordered marker, not just "1.": inside a bullet list a "2." opens a list of
                // a different type, which ends the item. Checked against the reference renderer.
                """\d{1,9}[.)](?:[ \t]|\z)""",
                """`{3,}|~{3,}""", // fenced code block
                """(?:[-*_][ \t]*){3,}\z""", // thematic break
            ).joinToString("|") { "(?:$it)" } +
            ")",
    )

    private fun opensBlock(line: String): Boolean = BLOCK_OPENER_RE.containsMatchIn(line)

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

            // Lazy continuation applies to paragraph text only: a column-0 line that opens a new
            // block ends the item instead of joining it.
            if (leadingWhitespace(line) == 0 && opensBlock(line)) {
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
