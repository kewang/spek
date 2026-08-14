package com.spek.intellij.core

import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SchemaOrderTest {

    // --- parseOrderFromStatus ---

    @Test
    fun parseExtractsOrderedRefs() {
        val refs = SchemaOrder.parseOrderFromStatus(
            """
            {
              "actionContext": { "planningArtifacts": ["brainstorm", "proposal", "specs"] },
              "artifactPaths": {
                "brainstorm": { "outputPath": "brainstorm.md" },
                "proposal": { "outputPath": "proposal.md" },
                "specs": { "outputPath": "specs/**/*.md" }
              }
            }
            """.trimIndent(),
        )
        assertEquals(
            listOf(
                SchemaArtifactRef("brainstorm", "brainstorm.md"),
                SchemaArtifactRef("proposal", "proposal.md"),
                SchemaArtifactRef("specs", "specs/**/*.md"),
            ),
            refs,
        )
    }

    @Test
    fun parseSkipsIdsWithoutOutputPath() {
        val refs = SchemaOrder.parseOrderFromStatus(
            """
            {
              "actionContext": { "planningArtifacts": ["proposal", "ghost"] },
              "artifactPaths": { "proposal": { "outputPath": "proposal.md" } }
            }
            """.trimIndent(),
        )
        assertEquals(listOf(SchemaArtifactRef("proposal", "proposal.md")), refs)
    }

    @Test
    fun parseReturnsNullForMalformed() {
        assertNull(SchemaOrder.parseOrderFromStatus("not json"))
        assertNull(SchemaOrder.parseOrderFromStatus("{}"))
        assertNull(
            SchemaOrder.parseOrderFromStatus(
                """{ "actionContext": { "planningArtifacts": [] }, "artifactPaths": {} }""",
            ),
        )
    }

    @Test
    fun parseSkipsNonStringElementsInsteadOfAborting() {
        // 一個非字串（物件 / 數字）的 planningArtifacts 元素、以及一個非字串 outputPath，都應被「略過」，
        // 而非讓整份解析回 null —— 保留其餘有效 refs（對齊 TS 版逐一 skip、單一壞元素不致命的行為）。
        val refs = SchemaOrder.parseOrderFromStatus(
            """
            {
              "actionContext": { "planningArtifacts": ["proposal", { "nested": true }, 42, "specs"] },
              "artifactPaths": {
                "proposal": { "outputPath": "proposal.md" },
                "specs": { "outputPath": { "not": "a string" } }
              }
            }
            """.trimIndent(),
        )
        assertEquals(listOf(SchemaArtifactRef("proposal", "proposal.md")), refs)
    }

    // --- resolveSchemaOrder ---

    private fun refs(vararg pairs: Pair<String, String>) =
        pairs.map { SchemaArtifactRef(it.first, it.second) }

    @Test
    fun resolveMapsLiteralFilenamesPreservingOrder() {
        val order = SchemaOrder.resolveSchemaOrder(
            refs("brainstorm" to "brainstorm.md", "proposal" to "proposal.md", "plan" to "plan.md"),
            listOf("proposal", "plan", "brainstorm"),
        )
        assertEquals(listOf("brainstorm", "proposal", "plan"), order)
    }

    @Test
    fun resolveSpecsGlobMapsToSpecs() {
        val order = SchemaOrder.resolveSchemaOrder(
            refs("specs" to "specs/**/*.md", "proposal" to "proposal.md"),
            listOf("proposal", "specs"),
        )
        assertEquals(listOf("specs", "proposal"), order)
    }

    @Test
    fun resolveLiteralSpecPathMapsToSpecs() {
        val order = SchemaOrder.resolveSchemaOrder(refs("specs" to "specs/foo/spec.md"), listOf("specs"))
        assertEquals(listOf("specs"), order)
    }

    @Test
    fun resolveNonSpecsGlobDoesNotMap() {
        assertNull(SchemaOrder.resolveSchemaOrder(refs("anything" to "*.md"), listOf("proposal", "specs")))
    }

    @Test
    fun resolveSpecMdOutsideSpecsPathDoesNotMap() {
        assertNull(SchemaOrder.resolveSchemaOrder(refs("weird" to "docs/spec.md"), listOf("specs")))
    }

    @Test
    fun resolveTrimsOutputPath() {
        val order = SchemaOrder.resolveSchemaOrder(refs("design" to "  design.md  "), listOf("design"))
        assertEquals(listOf("design"), order)
    }

    @Test
    fun resolveSkipsUnknownIds() {
        val order = SchemaOrder.resolveSchemaOrder(
            refs("ghost" to "ghost.md", "proposal" to "proposal.md"),
            listOf("proposal"),
        )
        assertEquals(listOf("proposal"), order)
    }

    @Test
    fun resolveDeduplicates() {
        val order = SchemaOrder.resolveSchemaOrder(
            refs("specs" to "specs/**/*.md", "specs-again" to "specs/foo/spec.md"),
            listOf("specs"),
        )
        assertEquals(listOf("specs"), order)
    }

    @Test
    fun resolveNullRefsYieldsNull() {
        assertNull(SchemaOrder.resolveSchemaOrder(null, listOf("proposal")))
    }

    @Test
    fun resolveNoMatchesYieldsNull() {
        assertNull(SchemaOrder.resolveSchemaOrder(refs("ghost" to "ghost.md"), listOf("proposal")))
    }

    // --- the CLI-backed provider ---
    //
    // Mirrors `schema-order.test.ts`. Every case is a *pair* of reads with the stub changing its
    // answer between them: that is the reported failure's shape (a `PATH` fixed between two reads,
    // issue #46), and nothing else can observe what the cache kept.

    private fun <T> withRunner(
        runner: (List<String>, String) -> OpenspecCli.Outcome,
        body: () -> T,
    ): T {
        val prev = SchemaOrder.cliRunner
        SchemaOrder.cliRunner = runner
        SchemaOrder.clearCache()
        try {
            return body()
        } finally {
            SchemaOrder.cliRunner = prev
            SchemaOrder.clearCache()
        }
    }

    private fun statusJson(vararg ids: String): String {
        val artifacts = ids.joinToString(", ") { "\"$it\"" }
        val paths = ids.joinToString(", ") { "\"$it\": {\"outputPath\": \"$it.md\"}" }
        return """{"actionContext": {"planningArtifacts": [$artifacts]}, "artifactPaths": {$paths}}"""
    }

    @Test
    fun `a failed consultation is retried on the next read`() {
        val calls = AtomicInteger()
        withRunner({ _, _ ->
            if (calls.incrementAndGet() == 1) {
                OpenspecCli.Outcome.StartFailed
            } else {
                OpenspecCli.Outcome.Completed(0, statusJson("proposal", "tasks"))
            }
        }) {
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertEquals(
                listOf("proposal", "tasks"),
                SchemaOrder.cli.order("/repo", "add-foo", "spec-driven")?.map { it.id },
            )
            assertEquals(2, calls.get())
        }
    }

    @Test
    fun `a successful run reporting no order is cached`() {
        // Success with nothing to report is an answer — it shares the null with every failure, so
        // the two can only be told apart where the CLI was consulted.
        val calls = AtomicInteger()
        withRunner({ _, _ ->
            calls.incrementAndGet()
            OpenspecCli.Outcome.Completed(0, "{}")
        }) {
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertNull(SchemaOrder.cli.order("/repo", "add-bar", "spec-driven"))
            assertEquals(1, calls.get())
        }
    }

    @Test
    fun `two changes sharing a schema spawn once when the CLI answers`() {
        val calls = AtomicInteger()
        withRunner({ _, _ ->
            calls.incrementAndGet()
            OpenspecCli.Outcome.Completed(0, statusJson("proposal"))
        }) {
            assertEquals(listOf("proposal"), SchemaOrder.cli.order("/repo", "add-foo", "spec-driven")?.map { it.id })
            assertEquals(listOf("proposal"), SchemaOrder.cli.order("/repo", "add-bar", "spec-driven")?.map { it.id })
            assertEquals(1, calls.get(), "the second change spawned its own CLI run")
        }
    }

    @Test
    fun `an unsafe slug is refused without reaching the CLI or the cache`() {
        // The Windows argument-injection boundary (BatBadBut / CVE-2024-27980). It refuses THIS
        // slug, while the cache key names a schema — so it has to be settled before the cache is
        // reached, or a legitimate change sharing the schema is handed the refusal.
        val calls = AtomicInteger()
        withRunner({ _, _ ->
            calls.incrementAndGet()
            OpenspecCli.Outcome.Completed(0, statusJson("proposal"))
        }) {
            assertNull(SchemaOrder.cli.order("/repo", "add foo; rm -rf /", "spec-driven"))
            assertEquals(0, calls.get(), "an unsafe slug reached the CLI")

            // The refusal left nothing behind: a legitimate change in the same bucket still asks.
            assertTrue(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven") != null)
            assertEquals(1, calls.get())
        }
    }
}
