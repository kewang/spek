package com.spek.intellij.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/**
 * Almost everything this parser does is pinned by the shared fixture corpus in
 * `test-fixtures/task-parser/`, which [TaskParserCorpusTest] and `packages/core/src/tasks.corpus.test.ts`
 * both read in full. One fixture, both languages, no step anyone has to remember — that is the
 * mechanism now, not two suites mirrored by hand. **New cases go there.**
 *
 * What stays here is what a fixture cannot express. A fixture pins one input to one result, so it
 * cannot state an equivalence between two inputs, and it cannot state a property that has to hold of
 * whatever the result turns out to be. Both remaining tests are mirrored in `tasks.test.ts` for the
 * same reason they always were, and both are as exposed to the runtime-divergence problem as any
 * hand-mirrored test — keep them few.
 */
class TaskParserTest {

    @Test
    fun `a single-line task's text contains no newline`() {
        // A property, not a value: whatever the folding rules produce, a task with no continuation
        // lines must not gain one. The values themselves are pinned by the
        // single-line-task-text-is-trimmed fixture.
        val tasks = TaskParser.parse("- [ ] Just this  \n- [x] And this").sections[0].tasks
        for (task in tasks) assertFalse(task.text.contains("\n"))
    }

    @Test
    fun `CRLF content parses the same as LF`() {
        // An equivalence between two inputs. Split into two fixtures with equal expectations the
        // invariant is gone: someone edits one and not the other, and nothing notices.
        assertEquals(
            TaskParser.parse("## S\n- [x] a\n- [ ] b\n"),
            TaskParser.parse("## S\r\n- [x] a\r\n- [ ] b\r\n"),
        )
    }
}
