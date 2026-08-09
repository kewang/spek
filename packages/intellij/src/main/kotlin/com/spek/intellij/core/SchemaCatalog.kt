package com.spek.intellij.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.yaml.snakeyaml.LoaderOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.constructor.SafeConstructor
import java.io.File

/**
 * Which workflow schemas a project can use, and what each one declares.
 *
 * Mirrors `packages/core/src/schemas.ts`. The split is the same: the `openspec` CLI answers *which
 * schemas exist and where they live* — package schemas sit under the global npm prefix and cannot be
 * found from the project alone, and the CLI already resolves project-over-package shadowing — while
 * everything a schema *contains* is read straight from its `schema.yaml`, because no CLI command
 * exposes it.
 *
 * Nothing here runs on the scan hot path; it is reached only when schema information is requested.
 */
object SchemaCatalog {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * A schema name arrives from the client and is used both as a CLI argument and as a path segment
     * under `openspec/schemas/`. Validate it against an explicit allowlist before it reaches either.
     *
     * **Anchored `\A`/`\z`, not `^`/`$`** — deliberately, and not merely to match the TypeScript.
     * Java's `$` also matches *before* a trailing line terminator, and its terminator set is wider
     * than JavaScript's, so `^…$` here would accept `"spec-driven\n"` on this side only. The
     * TypeScript's `$` without the `m` flag already matches end-of-input, so the two agree only if
     * this side states the stricter anchors.
     */
    private val SAFE_SCHEMA_NAME = Regex("""\A[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\z""")

    fun isSafeSchemaName(name: String?): Boolean = name != null && SAFE_SCHEMA_NAME.matches(name)

    private fun projectSchemasDir(repoRoot: String) = File(File(repoRoot, "openspec"), "schemas")

    /** The repo's default schema — openspec/config.yaml's `schema:`, read from disk with no CLI call. */
    fun readDefaultSchema(repoRoot: String): String? = OpenSpecScanner.readRepoSchema(repoRoot)

    // --- schema.yaml parsing -------------------------------------------------

    /** Read a scalar as a string, or null when absent/not scalar. Never substitutes a default. */
    private fun str(value: Any?): String? = when (value) {
        is String -> value
        is Number, is Boolean -> value.toString()
        else -> null
    }

    /** Read a list of strings, dropping non-strings. Absent → empty list. */
    private fun strList(value: Any?): List<String> =
        (value as? List<*>)?.filterIsInstance<String>() ?: emptyList()

    private fun toArtifact(raw: Any?): SchemaArtifactDef? {
        val o = raw as? Map<*, *> ?: return null
        val id = str(o["id"]) ?: return null // an artifact with no id cannot be ordered or referenced
        return SchemaArtifactDef(
            id = id,
            generates = str(o["generates"]),
            description = str(o["description"]),
            requires = strList(o["requires"]),
            instruction = str(o["instruction"]),
        )
    }

    private fun toApply(raw: Any?): SchemaApplyDef? {
        val o = raw as? Map<*, *> ?: return null
        return SchemaApplyDef(
            requires = strList(o["requires"]),
            tracks = str(o["tracks"]),
            instruction = str(o["instruction"]),
        )
    }

    data class ParsedSchemaYaml(
        val name: String?,
        val version: Int?,
        val description: String?,
        val artifacts: List<SchemaArtifactDef>,
        val apply: SchemaApplyDef?,
    )

    /**
     * Parse a schema.yaml into its declared shape. Artifact order is the order declared in the file —
     * that is the schema's authoritative sequence. Absent fields stay null (or an empty list), never
     * a substituted default: the view must not present invented guidance as authored. Returns null
     * when the document is not a mapping.
     *
     * `SafeConstructor`, not the bare `Yaml()` default: the latter can instantiate arbitrary types
     * from YAML tags. These files are local, but a parser is the wrong place to extend trust.
     */
    fun parseSchemaYaml(text: String): ParsedSchemaYaml? {
        val doc = try {
            Yaml(SafeConstructor(LoaderOptions())).load<Any?>(text)
        } catch (_: Exception) {
            return null
        }
        val o = doc as? Map<*, *> ?: return null
        val rawArtifacts = o["artifacts"] as? List<*> ?: emptyList<Any?>()
        return ParsedSchemaYaml(
            name = str(o["name"]),
            version = (o["version"] as? Number)?.toInt(),
            description = str(o["description"]),
            artifacts = rawArtifacts.mapNotNull { toArtifact(it) },
            apply = toApply(o["apply"]),
        )
    }

    // --- openspec CLI --------------------------------------------------------

    /**
     * A CLI run, interpreted. A failure may still carry `json`: the CLI exits non-zero for *domain*
     * answers as well as for breakage — `schema which <unknown>` prints a perfectly good
     * `{"error": "Schema 'x' not found"}` and exits 1 — so discarding stdout on a non-zero exit loses
     * the answer and reports a working CLI as broken.
     */
    private sealed interface CliResult {
        data class Ok(val json: JsonElement) : CliResult
        data class Failed(val reason: SchemaDegradedReason, val json: JsonElement?) : CliResult
    }

    /**
     * Run `openspec <args>` and classify the outcome.
     *
     * The subprocess mechanics live in [OpenspecCli]; this only names what each outcome means to a
     * reader of the schema views. Callers must have validated every interpolated argument with
     * [isSafeSchemaName] first — see the argv note on [OpenspecCli.run].
     */
    private fun runOpenspecJson(args: List<String>, cwd: String): CliResult {
        return when (val outcome = OpenspecCli.run(args, cwd)) {
            is OpenspecCli.Outcome.StartFailed -> CliResult.Failed(SchemaDegradedReason.CLI_UNAVAILABLE, null)
            is OpenspecCli.Outcome.TimedOut -> CliResult.Failed(SchemaDegradedReason.CLI_TIMEOUT, null)
            is OpenspecCli.Outcome.Completed -> {
                val parsed = try {
                    json.parseToJsonElement(outcome.stdout)
                } catch (_: Exception) {
                    null
                }
                when {
                    // stdout is still forwarded when it parsed — see the note on CliResult.
                    outcome.exitCode != 0 -> CliResult.Failed(SchemaDegradedReason.CLI_FAILED, parsed)
                    parsed != null -> CliResult.Ok(parsed)
                    else -> CliResult.Failed(SchemaDegradedReason.CLI_UNPARSABLE, null)
                }
            }
        }
    }

    /**
     * The CLI's own error message, when a failed run still produced a structured `{ error: ... }`
     * body. Non-null means the CLI **ran and answered** — the request failed, not the tool.
     */
    private fun cliErrorMessage(element: JsonElement?): String? {
        val obj = element as? JsonObject ?: return null
        val msg = obj["error"] as? JsonPrimitive ?: return null
        return if (msg.isString) msg.content else null
    }

    // --- enumeration ---------------------------------------------------------

    private fun jsonStr(value: JsonElement?): String? {
        val p = value as? JsonPrimitive ?: return null
        return if (p.isString) p.content else null
    }

    /**
     * Map `openspec schemas --json` output. An unexpected shape is a degradation, not a throw — the
     * schema commands are marked experimental by the CLI itself and may change.
     *
     * `stageCount` starts null: the enumeration carries no `requires`, so the level graph is not
     * knowable from it. It is filled in from each definition by [listSchemasUncached].
     */
    fun parseSchemasList(element: JsonElement): List<SchemaSummary>? {
        val arr = element as? JsonArray ?: return null
        val out = mutableListOf<SchemaSummary>()
        for (raw in arr) {
            val o = raw as? JsonObject ?: continue
            val name = jsonStr(o["name"]) ?: continue
            val source = SchemaSource.from(jsonStr(o["source"])) ?: continue
            out.add(
                SchemaSummary(
                    name = name,
                    description = jsonStr(o["description"]),
                    source = source,
                    stageCount = null,
                    isDefault = false,
                ),
            )
        }
        return out
    }

    /**
     * Project-local schemas read straight from disk. This is what keeps the view useful when the CLI
     * is unavailable, and it is the only source that needs no subprocess at all.
     *
     * The directory name — not schema.yaml's `name` — is authoritative, because the directory name
     * is what the name resolves back to on the filesystem.
     */
    fun listProjectSchemas(repoRoot: String): List<SchemaSummary> {
        val entries = projectSchemasDir(repoRoot).listFiles() ?: return emptyList()
        val out = mutableListOf<SchemaSummary>()
        for (entry in entries) {
            if (!entry.isDirectory || !isSafeSchemaName(entry.name)) continue
            val file = File(entry, "schema.yaml")
            val parsed = try {
                parseSchemaYaml(file.readText())
            } catch (_: Exception) {
                null // no readable schema.yaml → not a schema directory
            } ?: continue
            out.add(
                SchemaSummary(
                    name = entry.name,
                    description = parsed.description,
                    source = SchemaSource.PROJECT,
                    stageCount = SchemaFlow.schemaStageCount(parsed.artifacts, parsed.apply),
                    isDefault = false,
                ),
            )
        }
        return out
    }

    /**
     * Order: the repo's default schema first, then the rest by name. Codepoint comparison rather
     * than a locale-sensitive one, so the order does not shift with the IDE's locale.
     */
    private fun byDefaultThenName(a: SchemaSummary, b: SchemaSummary): Int {
        if (a.isDefault != b.isDefault) return if (a.isDefault) -1 else 1
        return a.name.compareTo(b.name)
    }

    /**
     * Enumerate the schemas available to a repo.
     *
     * The CLI already deduplicates project-over-package shadowing, so its list is taken as given and
     * the disk scan only fills in schemas it did not report — which, when the CLI is unavailable, is
     * all of them.
     */
    fun listSchemasUncached(repoRoot: String): SchemaCatalogResult {
        val defaultSchema = readDefaultSchema(repoRoot)
        val cli = runOpenspecJson(listOf("schemas", "--json"), repoRoot)

        var schemas = mutableListOf<SchemaSummary>()
        var degradedReason: SchemaDegradedReason? = null

        when (cli) {
            is CliResult.Ok -> {
                val parsed = parseSchemasList(cli.json)
                if (parsed != null) schemas = parsed.toMutableList() else degradedReason = SchemaDegradedReason.CLI_UNPARSABLE
            }
            is CliResult.Failed -> degradedReason = cli.reason
        }

        // Project-local schemas the CLI did not report. On a complete enumeration this adds nothing;
        // on a degraded one it is the whole list.
        val seen = schemas.map { it.name }.toMutableSet()
        for (local in listProjectSchemas(repoRoot)) {
            if (seen.add(local.name)) schemas.add(local)
        }

        // Stage counts need each schema's `requires` graph, which `openspec schemas --json` does not
        // carry. Filled in here so every surface reports the same number from the same rule. Project
        // schemas were already counted from disk, so this only pays for the ones the CLI reported,
        // and those reads are cached — they are the same reads the detail view is about to want.
        // Concurrently, as the TypeScript does with Promise.all: each miss is a subprocess round
        // trip, so serialising them makes a cold catalog cost the *sum* of N CLI calls instead of the
        // slowest one — and an unresponsive CLI cost N x the timeout rather than one.
        val marked = schemas.map { it.copy(isDefault = it.name == defaultSchema) }
        val withStages = OpenspecCli.inParallel(
            marked.map { s ->
                {
                    if (s.stageCount != null) {
                        s
                    } else {
                        when (val read = readSchema(repoRoot, s.name)) {
                            is SchemaReadResult.Ok ->
                                s.copy(stageCount = SchemaFlow.schemaStageCount(read.schema.artifacts, read.schema.apply))
                            is SchemaReadResult.Failed -> s
                        }
                    }
                }
            },
        ).sortedWith(::byDefaultThenName)

        return SchemaCatalogResult(defaultSchema, withStages, degradedReason)
    }

    // --- one schema ----------------------------------------------------------

    /**
     * The schema's location, expressed in the frame its source actually means: relative to the repo
     * for a project schema, `~`-prefixed for a user one, stripped of the npm install prefix for a
     * package one. The absolute path is still carried on the definition, for a tooltip.
     */
    fun shortenSchemaPath(absolutePath: String, repoRoot: String, homedir: String = System.getProperty("user.home").orEmpty()): String {
        val sep = File.separator

        // Package: everything up to the last node_modules/ is where npm happened to put the CLI.
        val marker = "${sep}node_modules$sep"
        val lastModules = absolutePath.lastIndexOf(marker)
        if (lastModules != -1) return absolutePath.substring(lastModules + marker.length)

        relativeUnder(repoRoot, absolutePath)?.let { return it }
        relativeUnder(homedir, absolutePath)?.let { return "~$sep$it" }
        return absolutePath
    }

    /** [child] expressed relative to [base], or null when it is not underneath it. */
    private fun relativeUnder(base: String, child: String): String? {
        if (base.isEmpty()) return null
        val basePath = File(base).toPath().normalize()
        val childPath = File(child).toPath().normalize()
        return try {
            val rel = basePath.relativize(childPath).toString()
            if (rel.isEmpty() || rel.startsWith("..") || File(rel).isAbsolute) null else rel
        } catch (_: IllegalArgumentException) {
            null // different roots (Windows drives)
        }
    }

    private fun parseShadows(element: JsonElement?): List<SchemaShadow> {
        val arr = element as? JsonArray ?: return emptyList()
        return arr.mapNotNull { raw ->
            val o = raw as? JsonObject ?: return@mapNotNull null
            val source = SchemaSource.from(jsonStr(o["source"])) ?: return@mapNotNull null
            val path = jsonStr(o["path"]) ?: return@mapNotNull null
            SchemaShadow(source, path)
        }
    }

    private data class ResolvedPath(val dir: String, val source: SchemaSource, val shadows: List<SchemaShadow>)

    /**
     * Either a located schema or the reason it could not be located — never both, never neither.
     * A `Pair<ResolvedPath?, Failed?>` said the same thing but left the caller defending against a
     * combination the function cannot produce, with nothing to catch a future branch that returns it.
     */
    private sealed interface PathResolution {
        data class Ok(val path: ResolvedPath) : PathResolution
        data class Failed(val reason: SchemaDegradedReason?) : PathResolution
    }

    /**
     * Locate a schema.
     *
     * `openspec schema which` is consulted first because it is the only source of the `shadows` list
     * — a project-local schema taking precedence over a same-named package one is worth showing, and
     * nothing on disk records it. When the CLI is unavailable the project-local directory still
     * resolves (with shadowing unknown); only a package schema is genuinely unreachable then, and
     * that reports the CLI reason rather than "not found", because those are different problems.
     */
    private fun resolveSchemaPath(repoRoot: String, name: String): PathResolution {
        if (!isSafeSchemaName(name)) return PathResolution.Failed(null)

        val cli = runOpenspecJson(listOf("schema", "which", name, "--json"), repoRoot)
        if (cli is CliResult.Ok) {
            val o = cli.json as? JsonObject
            val dir = jsonStr(o?.get("path"))
            val source = SchemaSource.from(jsonStr(o?.get("source")))
            if (dir != null && source != null) {
                return PathResolution.Ok(ResolvedPath(dir, source, parseShadows(o?.get("shadows"))))
            }
        }

        // CLI unusable (or it named a schema it could not describe): a project-local schema is still
        // reachable from disk on its own.
        val localDir = File(projectSchemasDir(repoRoot), name)
        if (File(localDir, "schema.yaml").exists()) {
            return PathResolution.Ok(ResolvedPath(localDir.absolutePath, SchemaSource.PROJECT, emptyList()))
        }

        if (cli is CliResult.Failed) {
            // A failed run that still answered in JSON means the CLI worked and the *name* did not
            // resolve: `schema which <unknown>` prints `{"error": "Schema 'x' not found"}` and exits
            // 1, so trusting the exit code alone reports an ordinary unknown name as broken tooling.
            if (cliErrorMessage(cli.json) != null) return PathResolution.Failed(null)
            return PathResolution.Failed(cli.reason)
        }
        return PathResolution.Failed(null)
    }

    /** Read one schema's full definition. */
    fun readSchemaUncached(repoRoot: String, name: String): SchemaReadResult {
        val resolved = when (val resolution = resolveSchemaPath(repoRoot, name)) {
            is PathResolution.Failed -> return SchemaReadResult.Failed(resolution.reason)
            is PathResolution.Ok -> resolution.path
        }

        val text = try {
            File(resolved.dir, "schema.yaml").readText()
        } catch (_: Exception) {
            return SchemaReadResult.Failed(null)
        }
        val parsed = parseSchemaYaml(text) ?: return SchemaReadResult.Failed(null)

        return SchemaReadResult.Ok(
            SchemaDefinition(
                // The requested name is authoritative over schema.yaml's own `name`: it is what
                // resolved, and what every link back to this schema uses.
                name = name,
                version = parsed.version,
                description = parsed.description,
                source = resolved.source,
                path = resolved.dir,
                displayPath = shortenSchemaPath(resolved.dir, repoRoot),
                isDefault = readDefaultSchema(repoRoot) == name,
                shadows = resolved.shadows,
                artifacts = parsed.artifacts,
                apply = parsed.apply,
            ),
        )
    }

    // --- caching -------------------------------------------------------------

    // Policy (TTL, size cap, why a failure must not be remembered forever) lives on TtlCache, shared
    // with SchemaOrder. Only the two stores are local.
    private val catalogCache = TtlCache<String, SchemaCatalogResult>()
    private val definitionCache = TtlCache<String, SchemaReadResult>()

    /** The schemas available to a repo. Cached per repo. */
    fun listSchemas(repoRoot: String): SchemaCatalogResult =
        catalogCache.getOrCompute(repoRoot) { listSchemasUncached(repoRoot) }

    /** One schema's full definition. Cached per (repo, name). */
    fun readSchema(repoRoot: String, name: String): SchemaReadResult =
        definitionCache.getOrCompute("$repoRoot::$name") { readSchemaUncached(repoRoot, name) }

    /** Drop every cached schema read. Used by the resync path and by tests. */
    fun clearCache() {
        catalogCache.clear()
        definitionCache.clear()
    }

    // --- change usage --------------------------------------------------------

    /**
     * Join the catalog with the active changes declaring each schema. Counted from the change's own
     * declared schema — no artifact reads.
     */
    fun groupSchemaUsage(catalog: SchemaCatalogResult, changes: List<ChangeInfo>): SchemasResponse {
        val known = LinkedHashMap<String, MutableList<String>>()
        for (s in catalog.schemas) known[s.name] = mutableListOf()

        val unknown = LinkedHashMap<String?, MutableList<String>>()
        for (change in changes) {
            val bucket = change.schema?.let { known[it] }
            if (bucket != null) {
                bucket.add(change.slug)
            } else {
                unknown.getOrPut(change.schema) { mutableListOf() }.add(change.slug)
            }
        }

        return SchemasResponse(
            defaultSchema = catalog.defaultSchema,
            degradedReason = catalog.degradedReason,
            schemas = catalog.schemas.map { s ->
                val slugs = known[s.name] ?: emptyList<String>()
                SchemaSummaryWithUsage(
                    name = s.name,
                    description = s.description,
                    source = s.source,
                    stageCount = s.stageCount,
                    isDefault = s.isDefault,
                    usage = SchemaUsage(slugs.size, slugs),
                )
            },
            unresolved = unknown.map { (schema, slugs) -> UnresolvedSchemaUsage(schema, slugs.size, slugs) },
        )
    }
}
