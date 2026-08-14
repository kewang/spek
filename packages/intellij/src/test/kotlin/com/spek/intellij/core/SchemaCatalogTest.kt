package com.spek.intellij.core

import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The Kotlin half of the shared schema.yaml fixture. `packages/core/src/schemas.test.ts` parses the
 * SAME file and asserts the same shape, so a divergence between the two readers fails a test instead
 * of shipping — the only thing that observes it, since nothing links the implementations.
 */
class SchemaCatalogTest {

    private fun fixture(): File {
        val configured = System.getProperty(FIXTURE_PROPERTY)
            ?: throw IllegalStateException(
                "system property $FIXTURE_PROPERTY is not set; the test task must pass the fixture directory",
            )
        return File(configured, "sample-schema.yaml")
    }

    // --- name validation ----------------------------------------------------
    //
    // The rule is stated in both languages rather than inherited from either runtime's regex
    // semantics. The trailing-newline row is the one that matters: Java's `$` also matches before a
    // trailing line terminator, so anchoring this side with `^`/`$` would accept "spec-driven\n"
    // while the TypeScript rejects it. That row is the control on the spelling, not on the tests —
    // it is the reason SAFE_SCHEMA_NAME uses `\A`/`\z`.
    private val nameCases: List<Triple<String, Boolean, String>> = listOf(
        Triple("spec-driven", true, "ordinary kebab-case name"),
        Triple("a", true, "single character"),
        Triple("schema.v2", true, "interior dot"),
        Triple("house_style", true, "underscore"),
        Triple("S1", true, "digits and uppercase"),
        Triple("", false, "empty"),
        Triple(".", false, "current directory"),
        Triple("..", false, "parent directory"),
        Triple("../etc", false, "traversal"),
        Triple("../../etc/passwd", false, "deep traversal"),
        Triple("a/b", false, "forward slash"),
        Triple("a\\b", false, "backslash"),
        Triple("-leading", false, "leading dash"),
        Triple(".leading", false, "leading dot"),
        Triple("trailing-", false, "trailing dash"),
        Triple("trailing.", false, "trailing dot"),
        Triple("spec driven", false, "space"),
        // Constructed, never a literal NUL in the source. A literal one made git classify this
        // whole file as binary: no textual diff in any review, no `* text=auto` normalisation, and
        // `grep`/`git grep` silently matching nothing anywhere in it. Built from `0.toChar()` rather
        // than a unicode escape, which is one careless round-trip away from becoming literal again.
        Triple("spec" + 0.toChar() + "driven", false, "null byte"),
        Triple("spec-driven\n", false, "trailing newline (Java `\$` would accept this)"),
        Triple("\nspec-driven", false, "leading newline"),
        Triple("spec-driven\r\n", false, "trailing CRLF"),
    )

    @Test
    fun `isSafeSchemaName allowlist table`() {
        for ((name, safe, why) in nameCases) {
            assertEquals(safe, SchemaCatalog.isSafeSchemaName(name), "\"$name\" — $why")
        }
    }

    @Test
    fun `isSafeSchemaName rejects null`() {
        assertEquals(false, SchemaCatalog.isSafeSchemaName(null))
    }

    // --- the shared fixture -------------------------------------------------

    @Test
    fun `shared fixture parses to the declared shape`() {
        val parsed = SchemaCatalog.parseSchemaYaml(fixture().readText())
        assertNotNull(parsed)

        assertEquals("fixture-workflow", parsed.name)
        assertEquals(1, parsed.version)
        assertEquals(
            "Fixture workflow used to pin schema.yaml parsing across two languages",
            parsed.description,
        )

        // Declared order is the authoritative sequence — not alphabetical, not dependency-sorted.
        assertEquals(listOf("brainstorm", "proposal", "specs", "tasks"), parsed.artifacts.map { it.id })

        val (brainstorm, proposal, specs, tasks) = parsed.artifacts

        assertEquals("brainstorm.md", brainstorm.generates)
        assertEquals("Open-ended exploration before anything is committed to", brainstorm.description)
        assertEquals(emptyList(), brainstorm.requires)
        // A literal block scalar keeps its newlines, blank lines, and interior indentation verbatim.
        assertEquals(
            "Explore the problem before proposing a solution.\n" +
                "\n" +
                "Cover:\n" +
                "- What the user actually asked for\n" +
                "- What they did **not** ask for\n" +
                "\n" +
                "```\n" +
                "indented code inside a block scalar\n" +
                "  stays indented\n" +
                "```\n",
            brainstorm.instruction,
        )

        // Absent fields are null, never an empty string or a substituted default.
        assertNull(proposal.description)
        assertEquals(listOf("brainstorm"), proposal.requires)

        assertEquals("specs/**/*.md", specs.generates)
        // A folded scalar joins onto one line and ends with a single newline.
        assertEquals(
            "Write one spec file per capability. This folded scalar joins onto a single line.\n",
            specs.instruction,
        )

        assertEquals("Implementation checklist: ordered by dependency", tasks.description)
        assertEquals(listOf("specs", "proposal"), tasks.requires)

        assertEquals(
            SchemaApplyDef(
                requires = listOf("tasks"),
                tracks = "tasks.md",
                instruction = "Work through pending tasks, marking each complete as it lands.\n",
            ),
            parsed.apply,
        )
    }

    @Test
    fun `unparsable or non-mapping documents degrade to null rather than throwing`() {
        assertNull(SchemaCatalog.parseSchemaYaml("- just\n- a list\n"))
        assertNull(SchemaCatalog.parseSchemaYaml("plain scalar"))
        assertNull(SchemaCatalog.parseSchemaYaml("a: [unterminated\n"))
    }

    @Test
    fun `an artifact without an id is skipped, not guessed at`() {
        val parsed = SchemaCatalog.parseSchemaYaml(
            """
            name: partial
            artifacts:
              - generates: nameless.md
              - id: real
                generates: real.md
            """.trimIndent(),
        )
        assertNotNull(parsed)
        assertEquals(listOf("real"), parsed.artifacts.map { it.id })
    }

    // --- artifact count ------------------------------------------------------

    @Test
    fun `artifact count is one per declared artifact`() {
        // Pinned on the shared fixture, as `packages/core/src/schemas.test.ts` pins the same 4 from
        // the same file — the only thing that catches the two rules drifting apart.
        val parsed = SchemaCatalog.parseSchemaYaml(fixture().readText())
        assertNotNull(parsed)
        assertEquals(4, SchemaCatalog.schemaArtifactCount(parsed.artifacts))
    }

    @Test
    fun `artifact count ignores the requires graph`() {
        // Steps sharing a dependency level are still separate stages: each is work that has to be
        // done. This is also what lets the count be read off the CLI's enumeration, which carries
        // step names without their `requires`.
        val chained = listOf(
            SchemaArtifactDef(id = "a"),
            SchemaArtifactDef(id = "b", requires = listOf("a")),
            SchemaArtifactDef(id = "c", requires = listOf("a")),
        )
        val flat = listOf(SchemaArtifactDef(id = "a"), SchemaArtifactDef(id = "b"), SchemaArtifactDef(id = "c"))
        assertEquals(3, SchemaCatalog.schemaArtifactCount(chained))
        assertEquals(SchemaCatalog.schemaArtifactCount(flat), SchemaCatalog.schemaArtifactCount(chained))
    }

    // --- the repo's own schemas directory is not a source ---------------------
    //
    // Mirrors the TypeScript rule: which schemas exist is the CLI's answer alone. openspec/schemas/
    // is the one schema directory this host could read, and reading it is what let a definition
    // OpenSpec refuses reach the page.

    @Test
    fun `a schema directory on disk is not a schema until the CLI says so`() {
        val repo = tempRepo()
        writeProjectSchema(repo, "house-style")
        withRunner({ _, _ -> SchemaCatalog.CliResult.Ok(Json.parseToJsonElement("[]")) }) {
            assertEquals(emptyList(), SchemaCatalog.listSchemasUncached(repo.absolutePath).schemas)
        }
    }

    @Test
    fun `a name the CLI cannot resolve is not resolved from disk`() {
        val repo = tempRepo()
        writeProjectSchema(repo, "house-style")
        withRunner({ _, _ -> SchemaCatalog.CliResult.Failed(SchemaDegradedReason.CLI_UNAVAILABLE, null) }) {
            val result = SchemaCatalog.readSchemaUncached(repo.absolutePath, "house-style").value
            assertTrue(result is SchemaReadResult.Failed)
            assertEquals(SchemaDegradedReason.CLI_UNAVAILABLE, result.reason)
        }
    }

    // --- what the cache keeps -------------------------------------------------
    //
    // An answer is remembered for the TTL; a failure the next read could find gone is not. Mirrors
    // the four judgements asserted in `schemas.test.ts`.

    @Test
    fun `an unreachable CLI is not remembered, so the next request retries`() {
        val repo = tempRepo()
        val calls = AtomicInteger()
        SchemaCatalog.clearCache()
        withRunner({ _, _ ->
            if (calls.incrementAndGet() == 1) {
                SchemaCatalog.CliResult.Failed(SchemaDegradedReason.CLI_UNAVAILABLE, null)
            } else {
                SchemaCatalog.CliResult.Ok(Json.parseToJsonElement("[]"))
            }
        }) {
            assertEquals(SchemaDegradedReason.CLI_UNAVAILABLE, SchemaCatalog.listSchemas(repo.absolutePath).degradedReason)
            assertEquals(null, SchemaCatalog.listSchemas(repo.absolutePath).degradedReason)
            assertEquals(2, calls.get())
        }
        SchemaCatalog.clearCache()
    }

    @Test
    fun `a CLI that ran and answered unusably is remembered`() {
        val repo = tempRepo()
        val calls = AtomicInteger()
        SchemaCatalog.clearCache()
        withRunner({ _, _ ->
            calls.incrementAndGet()
            SchemaCatalog.CliResult.Failed(SchemaDegradedReason.CLI_FAILED, null)
        }) {
            repeat(2) {
                assertEquals(SchemaDegradedReason.CLI_FAILED, SchemaCatalog.listSchemas(repo.absolutePath).degradedReason)
            }
            // Nothing the next read can do changes this, and the Schemas view re-reads on every
            // watcher event — re-asking would spawn a process per refetch to be told the same thing.
            assertEquals(1, calls.get())
        }
        SchemaCatalog.clearCache()
    }

    @Test
    fun `a definition whose schema yaml cannot be read is re-read`() {
        // Reported as not-found like the three other paths that produce it, and indistinguishable
        // from them by the time the cache sees it — so the read itself says it is not worth keeping.
        val repo = tempRepo()
        val dir = File(repo, "openspec/schemas/house-style")
        dir.mkdirs()
        SchemaCatalog.clearCache()
        withRunner({ _, _ ->
            SchemaCatalog.CliResult.Ok(
                Json.parseToJsonElement("""{"path": ${Json.encodeToString(String.serializer(), dir.absolutePath)}, "source": "project"}"""),
            )
        }) {
            assertTrue(SchemaCatalog.readSchema(repo.absolutePath, "house-style") is SchemaReadResult.Failed)
            File(dir, "schema.yaml").writeText("name: house-style\nartifacts:\n  - id: only\n")
            assertTrue(
                SchemaCatalog.readSchema(repo.absolutePath, "house-style") is SchemaReadResult.Ok,
                "the failed read was remembered instead of being retried",
            )
        }
        SchemaCatalog.clearCache()
    }

    private fun <T> withRunner(
        runner: (List<String>, String) -> SchemaCatalog.CliResult,
        body: () -> T,
    ): T {
        val prev = SchemaCatalog.cliRunner
        SchemaCatalog.cliRunner = runner
        try {
            return body()
        } finally {
            SchemaCatalog.cliRunner = prev
        }
    }

    // --- path display -------------------------------------------------------

    @Test
    fun `a project path is shown relative to the repo`() {
        val repo = File("/home/dev/spek")
        assertEquals(
            listOf("openspec", "schemas", "house-style").joinToString(File.separator),
            SchemaCatalog.shortenSchemaPath("/home/dev/spek/openspec/schemas/house-style", repo.path, "/home/dev"),
        )
    }

    @Test
    fun `a package path is stripped of everything up to the last node_modules`() {
        val p = listOf("", "usr", "lib", "node_modules", "@fission-ai", "openspec", "schemas", "spec-driven")
            .joinToString(File.separator)
        assertEquals(
            listOf("@fission-ai", "openspec", "schemas", "spec-driven").joinToString(File.separator),
            SchemaCatalog.shortenSchemaPath(p, "/home/dev/spek", "/home/dev"),
        )
    }

    @Test
    fun `a user path is written with a tilde`() {
        val result = SchemaCatalog.shortenSchemaPath(
            "/home/dev/.local/share/openspec/schemas/personal",
            "/home/dev/spek",
            "/home/dev",
        )
        assertTrue(result.startsWith("~${File.separator}"), "expected a ~-prefixed path, got $result")
        assertTrue(result.endsWith("personal"), result)
    }

    @Test
    fun `a path under neither the repo nor home stays absolute`() {
        val p = listOf("", "opt", "elsewhere", "schemas", "x").joinToString(File.separator)
        assertEquals(p, SchemaCatalog.shortenSchemaPath(p, "/home/dev/spek", "/home/dev"))
    }

    // --- change usage -------------------------------------------------------

    @Test
    fun `usage joins changes onto their schema and reconciles the rest`() {
        val catalog = SchemaCatalogResult(
            defaultSchema = "spec-driven",
            schemas = listOf(
                SchemaSummary(name = "spec-driven", source = SchemaSource.PACKAGE, isDefault = true),
                SchemaSummary(name = "house-style", source = SchemaSource.PROJECT),
            ),
            degradedReason = null,
        )
        val response = SchemaCatalog.groupSchemaUsage(
            catalog,
            listOf(
                change("add-a", "spec-driven"),
                change("add-b", "spec-driven"),
                change("add-c", "house-style"),
                change("add-d", "gone-missing"),
                change("add-e", null),
            ),
        )

        assertEquals(2, response.schemas.first { it.name == "spec-driven" }.usage.count)
        assertEquals(listOf("add-a", "add-b"), response.schemas.first { it.name == "spec-driven" }.usage.slugs)
        assertEquals(1, response.schemas.first { it.name == "house-style" }.usage.count)

        // Changes whose schema resolves to nothing are reported rather than silently dropped, so the
        // counts reconcile against the Changes page. A change declaring no schema at all groups
        // under null.
        assertEquals(
            listOf("gone-missing" to 1, null to 1),
            response.unresolved.map { it.schema to it.count },
        )
    }

    /**
     * The wire form, not just the field names. The same React app deserialises whichever backend
     * served it, so `source` and `degradedReason` must be the TypeScript's lowercase strings — a
     * Kotlin enum serialises as `PROJECT` / `CLI_UNAVAILABLE` unless `@SerialName` says otherwise,
     * and the frontend compares against `"project"` / `"cli-unavailable"`.
     */
    @Test
    fun `enums serialise as the lowercase strings the shared frontend expects`() {
        val response = SchemaCatalog.groupSchemaUsage(
            SchemaCatalogResult(
                defaultSchema = "house-style",
                schemas = listOf(
                    SchemaSummary(name = "house-style", source = SchemaSource.PROJECT, artifactCount = 3, isDefault = true),
                    SchemaSummary(name = "spec-driven", source = SchemaSource.PACKAGE),
                    SchemaSummary(name = "personal", source = SchemaSource.USER),
                ),
                degradedReason = SchemaDegradedReason.CLI_UNAVAILABLE,
            ),
            emptyList(),
        )
        val encoded = Json { encodeDefaults = true }.encodeToString(SchemasResponse.serializer(), response)

        assertTrue(encoded.contains(""""source":"project""""), encoded)
        assertTrue(encoded.contains(""""source":"package""""), encoded)
        assertTrue(encoded.contains(""""source":"user""""), encoded)
        assertTrue(encoded.contains(""""degradedReason":"cli-unavailable""""), encoded)
        // The shared frontend reads this response from both hosts, so the field name is a contract
        // between the two languages, not a detail of either.
        assertTrue(encoded.contains(""""artifactCount":3"""), encoded)
    }

    @Test
    fun `usage carries the catalog's degraded reason through untouched`() {
        val catalog = SchemaCatalogResult(null, emptyList(), SchemaDegradedReason.CLI_UNAVAILABLE)
        val response = SchemaCatalog.groupSchemaUsage(catalog, emptyList())
        assertEquals(SchemaDegradedReason.CLI_UNAVAILABLE, response.degradedReason)
    }

    // --- helpers ------------------------------------------------------------

    private fun tempRepo(): File {
        val dir = createTempDir()
        File(dir, "openspec").mkdirs()
        return dir
    }

    private fun createTempDir(): File =
        File.createTempFile("spek-schemas", "").let {
            it.delete()
            it.mkdirs()
            it.deleteOnExit()
            it
        }

    /** One artifact, one apply step → one stage each side of the arrow. */
    private fun writeProjectSchema(repo: File, name: String) {
        val dir = File(repo, "openspec/schemas/$name")
        dir.mkdirs()
        File(dir, "schema.yaml").writeText(
            """
            name: $name
            description: A project-local schema
            artifacts:
              - id: only
                generates: only.md
            """.trimIndent(),
        )
    }

    private fun change(slug: String, schema: String?) = ChangeInfo(
        slug = slug,
        date = null,
        timestamp = null,
        createdDate = null,
        archivedDate = null,
        description = slug,
        status = "active",
        hasProposal = false,
        hasDesign = false,
        hasTasks = false,
        hasSpecs = false,
        artifactCount = 0,
        schema = schema,
        defaultSchema = null,
        taskStats = null,
    )

    private companion object {
        const val FIXTURE_PROPERTY = "spek.schemaFixtures"
    }
}
