package com.spek.intellij.core

import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SchemaOrderTest {

    // --- readOrderFromStatus ---

    @Test
    fun parseExtractsOrderedRefs() {
        val refs = SchemaOrder.readOrderFromStatus(
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
            SchemaOrder.OrderResponse.Readable(
                listOf(
                    SchemaArtifactRef("brainstorm", "brainstorm.md"),
                    SchemaArtifactRef("proposal", "proposal.md"),
                    SchemaArtifactRef("specs", "specs/**/*.md"),
                ),
            ),
            refs,
        )
    }

    @Test
    fun parseSkipsIdsWithoutOutputPath() {
        val refs = SchemaOrder.readOrderFromStatus(
            """
            {
              "actionContext": { "planningArtifacts": ["proposal", "ghost"] },
              "artifactPaths": { "proposal": { "outputPath": "proposal.md" } }
            }
            """.trimIndent(),
        )
        assertEquals(
            SchemaOrder.OrderResponse.Readable(listOf(SchemaArtifactRef("proposal", "proposal.md"))),
            refs,
        )
    }

    @Test
    fun readClassifiesUnparsableOutputAsUnreadable() {
        // The whole point of the split: output that will not parse is the installed CLI answering
        // unusably, not "this schema has no order". Read as an answer, it was held for the full
        // window for every change sharing the schema.
        assertEquals(SchemaOrder.OrderResponse.Unreadable, SchemaOrder.readOrderFromStatus("not json"))
    }

    @Test
    fun readClassifiesParsableOutputWithNoOrderAsAnAnswer() {
        // Readable means it parsed, not that it was shaped as expected. The boundary is
        // `parseToJsonElement` alone, matching TypeScript's `JSON.parse` — so a root that is not an
        // object is an answer on both sides, not a failure on one of them.
        for (body in listOf("{}", "null", "42", "\"str\"", "[1,2]")) {
            assertEquals(
                SchemaOrder.OrderResponse.Readable(null),
                SchemaOrder.readOrderFromStatus(body),
                "expected a readable response with no order for: $body",
            )
        }
        assertEquals(
            SchemaOrder.OrderResponse.Readable(null),
            SchemaOrder.readOrderFromStatus(
                """{ "actionContext": { "planningArtifacts": [] }, "artifactPaths": {} }""",
            ),
        )
    }

    @Test
    fun parseSkipsNonStringElementsInsteadOfAborting() {
        // A non-string planningArtifacts element (an object, a number) and a non-string outputPath
        // are each **skipped**, rather than voiding the whole read — the remaining valid refs survive,
        // matching the TS side's element-by-element skip.
        val refs = SchemaOrder.readOrderFromStatus(
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
        assertEquals(
            SchemaOrder.OrderResponse.Readable(listOf(SchemaArtifactRef("proposal", "proposal.md"))),
            refs,
        )
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
    fun resolveMapsDataOutputPathToDataIdNotSameStemMarkdownSibling() {
        // Discovery gives `asyncapi.md` the id "asyncapi" (bare stem) and `asyncapi.yaml` the id
        // "asyncapi-2". The schema declares the data artifact with outputPath `asyncapi.yaml`; it must map
        // to the DATA id, not the markdown sibling. The data-file map carries the exact filename.
        val order = SchemaOrder.resolveSchemaOrder(
            refs("proposal" to "proposal.md", "asyncapi" to "asyncapi.yaml"),
            listOf("proposal", "asyncapi", "asyncapi-2"),
            mapOf("asyncapi.yaml" to "asyncapi-2"),
        )
        assertEquals(listOf("proposal", "asyncapi-2"), order)
    }

    @Test
    fun resolveWithoutDataFileMapStillResolvesByStem() {
        val order = SchemaOrder.resolveSchemaOrder(refs("asyncapi" to "asyncapi.yaml"), listOf("asyncapi"))
        assertEquals(listOf("asyncapi"), order)
    }

    @Test
    fun resolveMapsDataArtifactOutputPathByStrippingAnyExtension() {
        // A schema declaring a data artifact (`asyncapi`, generates `asyncapi.yaml`) must sort it into its
        // position, not trail it. The stem strip mirrors ArtifactDiscovery.stripExt (any extension), not
        // only `.md`, so TS and Kotlin allocate the same id for one file.
        val order = SchemaOrder.resolveSchemaOrder(
            refs(
                "proposal" to "proposal.md",
                "asyncapi" to "asyncapi.yaml",
                "retry-policy" to "retry-policy.yml",
                "payload-example" to "payload-example.json",
            ),
            listOf("proposal", "asyncapi", "retry-policy", "payload-example"),
        )
        assertEquals(listOf("proposal", "asyncapi", "retry-policy", "payload-example"), order)
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

    // --- a settled change is remembered against itself ---

    @Test
    fun `a settled refusal is not consulted again on the next read`() {
        // An installation that cannot answer at all — one too old for `status --change --json` —
        // exits non-zero for every slug. Dropping that outcome entirely cost a full process start on
        // every change-detail read and on every watcher-driven refetch, forever.
        val calls = AtomicInteger()
        withRunner({ _, _ ->
            calls.incrementAndGet()
            OpenspecCli.Outcome.Completed(1, "")
        }) {
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertEquals(1, calls.get(), "a settled change consulted the CLI again")
        }
    }

    @Test
    fun `an unreadable body settles the change rather than answering for the schema`() {
        // Exit 0 with output that will not parse. Read as an answer — which is what this side did —
        // the null was held for the whole window for every change sharing the schema.
        val calls = AtomicInteger()
        withRunner({ _, _ ->
            calls.incrementAndGet()
            OpenspecCli.Outcome.Completed(0, "not json")
        }) {
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            // Not the schema's answer: a sibling still gets its own consultation.
            assertNull(SchemaOrder.cli.order("/repo", "add-bar", "spec-driven"))
            assertEquals(2, calls.get(), "an unreadable body was cached as the schema's answer")
        }
    }

    @Test
    fun `a settled change is still served its schema's cached answer`() {
        // The order is a property of the schema, so once a sibling has fetched it, it is this
        // change's too — the mark replaces a consultation, never an answer. Read the other way
        // round: this is the regression the mark must not introduce.
        val calls = mutableListOf<String>()
        withRunner({ args, _ ->
            val slug = args[args.indexOf("--change") + 1]
            calls.add(slug)
            if (slug == "odd-one") {
                OpenspecCli.Outcome.Completed(1, "")
            } else {
                OpenspecCli.Outcome.Completed(0, statusJson("proposal"))
            }
        }) {
            assertNull(SchemaOrder.cli.order("/repo", "odd-one", "spec-driven"))
            SchemaOrder.cli.order("/repo", "add-foo", "spec-driven")
            assertEquals(
                listOf("proposal"),
                SchemaOrder.cli.order("/repo", "odd-one", "spec-driven")?.map { it.id },
            )
            assertEquals(listOf("odd-one", "add-foo"), calls)
        }
    }

    @Test
    fun `a transient failure marks nothing`() {
        // `isTransient` is the one rule and it decides this too: an absent binary and a timeout are
        // what a running host repairs by itself, so neither is held anywhere.
        val calls = AtomicInteger()
        withRunner({ _, _ ->
            calls.incrementAndGet()
            OpenspecCli.Outcome.TimedOut
        }) {
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertEquals(2, calls.get())
        }
    }

    @Test
    fun `clearing the cache clears settled changes with it`() {
        // `SpekCaches` drives clearCache from the resync route and the file watcher alike. A mark
        // surviving it would make a manual Refresh invalidate less than the automatic one beside it,
        // for the one change it names.
        val calls = AtomicInteger()
        withRunner({ _, _ ->
            calls.incrementAndGet()
            OpenspecCli.Outcome.Completed(1, "")
        }) {
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertEquals(1, calls.get())

            SchemaOrder.clearCache()
            assertNull(SchemaOrder.cli.order("/repo", "add-foo", "spec-driven"))
            assertEquals(2, calls.get(), "a settled change survived clearCache")
        }
    }
}
