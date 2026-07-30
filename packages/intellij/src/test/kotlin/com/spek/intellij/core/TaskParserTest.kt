package com.spek.intellij.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/**
 * These mirror `packages/core/src/tasks.test.ts` case for case. The two parsers are separate
 * implementations of one rule, so the only thing stopping them drifting is asserting the same cases.
 */
class TaskParserTest {

    private fun textOf(content: String): List<String> =
        TaskParser.parse(content).sections.flatMap { section -> section.tasks.map { it.text } }

    @Test
    fun `sub-bullets indented two spaces are dedented to column 0`() {
        assertEquals(listOf("Parent\n- a\n- b"), textOf("- [ ] Parent\n  - a\n  - b"))
    }

    @Test
    fun `removes exactly the content offset, not the whole indent`() {
        // 6 spaces - 2 leaves 4, which standard Markdown renders as lazy paragraph continuation with a
        // literal "-". Stripping all 6 would promote it to a bullet list no other viewer shows.
        assertEquals(listOf("Parent\n    - a"), textOf("- [ ] Parent\n      - a"))
    }

    @Test
    fun `relative nesting between continuation lines is preserved`() {
        assertEquals(listOf("Parent\n- a\n  - b"), textOf("- [ ] Parent\n  - a\n    - b"))
    }

    @Test
    fun `lazy continuation at column 0 belongs to the task`() {
        assertEquals(listOf("Task one\nprose line"), textOf("- [ ] Task one\nprose line"))
    }

    @Test
    fun `a tab counts as one whitespace character when dedenting`() {
        assertEquals(listOf("Parent\n- a"), textOf("- [ ] Parent\n\t- a"))
    }

    @Test
    fun `unindented prose after a blank line ends the task`() {
        assertEquals(listOf("Task one"), textOf("- [ ] Task one\n\nStandalone prose."))
    }

    @Test
    fun `indented prose after a blank line continues the task`() {
        assertEquals(
            listOf("Task one\n\nBelongs to item."),
            textOf("- [ ] Task one\n\n  Belongs to item."),
        )
    }

    @Test
    fun `an indented code block keeps its exact content`() {
        // The one case that distinguishes the dedent from doing nothing: 6 spaces - 2 leaves 4, so the
        // line is an indented code block whose content starts flush. Without the dedent it would carry
        // two spurious leading spaces inside the code.
        assertEquals(
            listOf("Task\n\n    six space content"),
            textOf("- [ ] Task\n\n      six space content"),
        )
    }

    @Test
    fun `trailing blank lines are dropped`() {
        assertEquals(listOf("Task one\n- a"), textOf("- [ ] Task one\n  - a\n\n\n"))
    }

    @Test
    fun `a two-space hard line break survives folding`() {
        assertEquals(
            listOf("First line  \nsecond line"),
            textOf("- [ ] First line  \n  second line"),
        )
    }

    @Test
    fun `a backslash hard line break survives folding`() {
        assertEquals(
            listOf("First line\\\nsecond line"),
            textOf("- [ ] First line\\\n  second line"),
        )
    }

    @Test
    fun `a soft break stays soft`() {
        assertEquals(listOf("First line\nsecond line"), textOf("- [ ] First line\n  second line"))
    }

    @Test
    fun `single-line tasks are unchanged and contain no newline`() {
        val tasks = TaskParser.parse("- [ ] Just this  \n- [x] And this").sections[0].tasks
        assertEquals(listOf("Just this", "And this"), tasks.map { it.text })
        tasks.forEach { assertFalse(it.text.contains("\n")) }
    }

    @Test
    fun `indented checkboxes are not counted as separate tasks`() {
        val parsed = TaskParser.parse("- [ ] Parent\n  - [ ] sub one\n  - [x] sub two")
        assertEquals(1, parsed.total)
        assertEquals(0, parsed.completed)
        assertEquals(
            listOf("Parent\n- [ ] sub one\n- [x] sub two"),
            parsed.sections[0].tasks.map { it.text },
        )
    }

    @Test
    fun `statistics and section grouping are unchanged`() {
        val parsed = TaskParser.parse(
            "## Phase 1\n- [x] one\n  - note\n- [ ] two\n## Phase 2\n- [x] three\n",
        )
        assertEquals(3, parsed.total)
        assertEquals(2, parsed.completed)
        assertEquals(listOf("Phase 1", "Phase 2"), parsed.sections.map { it.title })
        assertEquals(listOf("one\n- note", "two"), parsed.sections[0].tasks.map { it.text })
    }

    @Test
    fun `a section heading ends the preceding task`() {
        assertEquals(listOf("one\n- a", "two"), textOf("- [ ] one\n  - a\n## Next\n- [ ] two"))
    }

    @Test
    fun `empty input yields no tasks`() {
        val parsed = TaskParser.parse("")
        assertEquals(0, parsed.total)
        assertEquals(0, parsed.completed)
        assertEquals(emptyList(), parsed.sections)
    }

    @Test
    fun `CRLF input is handled`() {
        assertEquals(listOf("Parent\n- a"), textOf("- [ ] Parent\r\n  - a\r\n"))
    }
}
