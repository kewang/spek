package com.spek.intellij.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TaskItem(
    val text: String,
    val completed: Boolean,
)

@Serializable
data class TaskSection(
    val title: String,
    val tasks: List<TaskItem>,
)

@Serializable
data class TaskStats(
    val total: Int,
    val completed: Int,
)

@Serializable
data class ParsedTasks(
    val total: Int,
    val completed: Int,
    val sections: List<TaskSection>,
)

@Serializable
data class SpecInfo(
    val topic: String,
    val path: String,
    val historyCount: Int,
)

@Serializable
data class HistoryEntry(
    val slug: String,
    val date: String?,
    val timestamp: String?,
    val description: String,
    val status: String, // "active" | "archived"
)

@Serializable
data class SpecDetail(
    val topic: String,
    val content: String,
    val relatedChanges: List<String>,
    val history: List<HistoryEntry>,
)

@Serializable
data class ChangeInfo(
    val slug: String,
    val date: String?,
    val timestamp: String?,
    val createdDate: String? = null,
    val archivedDate: String? = null,
    val description: String,
    val status: String, // "active" | "archived"
    val hasProposal: Boolean,
    val hasDesign: Boolean,
    val hasTasks: Boolean,
    val hasSpecs: Boolean,
    val artifactCount: Int,
    val schema: String?,
    /**
     * 此 change 所在 repo 的預設 schema（openspec/config.yaml schema:），無法判定為 null。
     * 刻意不給預設值：與 @spekjs/core 的必填欄位對齊，讓漏 stamp 的 producer 在編譯期就失敗
     * （若給了預設值，漏填會靜默送出 null，前端 SchemaBadge 便會對每個 change 都顯示 badge）。
     */
    val defaultSchema: String?,
    val taskStats: TaskStats?,
)

// 動態探索到的單一 change artifact；kind 為 "markdown" | "tasks" | "specs"
@Serializable
data class ChangeArtifact(
    val id: String,
    val title: String,
    val kind: String,
    val content: String? = null,
    val tasks: ParsedTasks? = null,
    val specs: List<ChangeSpec>? = null,
)

@Serializable
data class ChangeDetail(
    val slug: String,
    val status: String,
    val schema: String?,
    /** repo 預設 schema（openspec/config.yaml schema:），無法判定為 null；供 UI 隱藏與 default 相同的 badge。刻意不給預設值，理由同 ChangeInfo */
    val defaultSchema: String?,
    val artifacts: List<ChangeArtifact>,
    /** schema 權威順序（artifact id 清單）；CLI 不可用 / archived 時為 null */
    val schemaOrder: List<String>? = null,
    // Timeline 生命週期：createdDate 供 change-detail banner，archivedDate 由 archive/<slug> 判定
    val createdDate: String? = null,
    val archivedDate: String? = null,
    val metadata: Map<String, String>?,
)

@Serializable
data class ChangeSpec(
    val topic: String,
    val content: String,
)

@Serializable
data class ChangesData(
    val active: List<ChangeInfo>,
    val archived: List<ChangeInfo>,
    /** repo 預設 schema（openspec/config.yaml schema:），無法判定為 null；供 list/overview 隱藏與 default 相同的 badge。刻意不給預設值，理由同 ChangeInfo */
    val defaultSchema: String?,
)

@Serializable
data class OverviewData(
    val specsCount: Int,
    val changesCount: ChangesCount,
    val taskStats: TaskStats,
)

@Serializable
data class ChangesCount(
    val active: Int,
    val archived: Int,
)

@Serializable
data class SearchResult(
    val type: String, // "spec" | "change"
    val title: String,
    val slug: String? = null,
    val topic: String? = null,
    val context: String,
    val file: String? = null,
)

@Serializable
data class BrowseEntry(
    val name: String,
    val type: String, // "directory" | "file"
    val path: String,
)

@Serializable
data class BrowseData(
    val path: String,
    val entries: List<BrowseEntry>,
)

@Serializable
data class DetectData(
    val hasOpenSpec: Boolean,
    val schema: String? = null,
)

@Serializable
data class SpecVersionContent(
    val content: String,
)

@Serializable
data class GraphNode(
    val id: String,
    val type: String, // "spec" | "change"
    val label: String,
    val date: String? = null,
    val status: String? = null,
    val historyCount: Int? = null,
    val specCount: Int? = null,
)

@Serializable
data class GraphEdge(
    val source: String,
    val target: String,
)

@Serializable
data class GraphData(
    val nodes: List<GraphNode>,
    val edges: List<GraphEdge>,
)

// --- Workflow schemas -------------------------------------------------------
// Mirrors @spekjs/core's schema types (packages/core/src/types.ts). The web SPA is the client for
// both, so these names and nullability must match the TypeScript exactly — the same view code
// deserialises whichever backend served it.

/**
 * Where a schema resolved from, in the resolver's precedence order: the repo's own
 * `openspec/schemas/` (project), the machine's global data directory (user), then the schemas
 * shipped inside the openspec package (package). An earlier match shadows a later one.
 *
 * Serialised as the lowercase string the TypeScript uses, not the enum name.
 */
@Serializable
enum class SchemaSource {
    @SerialName("package")
    PACKAGE,

    @SerialName("user")
    USER,

    @SerialName("project")
    PROJECT,
    ;

    companion object {
        /** Parse the CLI's / API's spelling. Unknown values are null rather than guessed at —
         *  an unrecognised source once made the TypeScript drop the schema from the list entirely. */
        fun from(value: String?): SchemaSource? = when (value) {
            "package" -> PACKAGE
            "user" -> USER
            "project" -> PROJECT
            else -> null
        }
    }
}

/** Why package schemas could not be enumerated. A code, not a sentence: each surface words it. */
@Serializable
enum class SchemaDegradedReason {
    @SerialName("cli-unavailable")
    CLI_UNAVAILABLE,

    @SerialName("cli-failed")
    CLI_FAILED,

    @SerialName("cli-timeout")
    CLI_TIMEOUT,

    @SerialName("cli-unparsable")
    CLI_UNPARSABLE,
}

/** One schema as it appears in the list. `artifactCount` is what it declares — see schemaArtifactCount. */
@Serializable
data class SchemaSummary(
    val name: String,
    val description: String? = null,
    val source: SchemaSource,
    val artifactCount: Int? = null,
    val isDefault: Boolean = false,
)

/** One artifact (workflow step) a schema declares. */
@Serializable
data class SchemaArtifactDef(
    val id: String,
    val generates: String? = null,
    val description: String? = null,
    val requires: List<String> = emptyList(),
    val instruction: String? = null,
)

/** A schema's apply step: when a change authored under it becomes implementable. */
@Serializable
data class SchemaApplyDef(
    val requires: List<String> = emptyList(),
    val tracks: String? = null,
    val instruction: String? = null,
)

/** A same-named schema this one takes precedence over. */
@Serializable
data class SchemaShadow(
    val source: SchemaSource,
    val path: String,
)

/** One schema's full definition, read from its schema.yaml. */
@Serializable
data class SchemaDefinition(
    val name: String,
    val version: Int? = null,
    val description: String? = null,
    val source: SchemaSource,
    val path: String,
    val displayPath: String,
    val isDefault: Boolean = false,
    val shadows: List<SchemaShadow> = emptyList(),
    val artifacts: List<SchemaArtifactDef> = emptyList(),
    val apply: SchemaApplyDef? = null,
)

/** Active changes declaring a schema. Counted from ChangeInfo.schema — no artifact reads. */
@Serializable
data class SchemaUsage(
    val count: Int,
    val slugs: List<String>,
)

/** A schema row as the API serves it: the summary plus who is using it. */
@Serializable
data class SchemaSummaryWithUsage(
    val name: String,
    val description: String? = null,
    val source: SchemaSource,
    val artifactCount: Int? = null,
    val isDefault: Boolean = false,
    val usage: SchemaUsage,
)

/**
 * Active changes whose declared schema matched no enumerated schema, grouped by that name (null
 * groups changes declaring no schema at all), so the per-schema counts reconcile against the
 * Changes page rather than quietly losing changes.
 */
@Serializable
data class UnresolvedSchemaUsage(
    val schema: String? = null,
    val count: Int,
    val slugs: List<String>,
)

/** The `/schemas` response: the catalog joined with change usage. */
@Serializable
data class SchemasResponse(
    val defaultSchema: String? = null,
    val schemas: List<SchemaSummaryWithUsage>,
    val degradedReason: SchemaDegradedReason? = null,
    val unresolved: List<UnresolvedSchemaUsage> = emptyList(),
)

/**
 * A 404 body. Typed rather than interpolated: `reason` is what lets the shared frontend tell "we
 * could not look" from "it does not exist", and hand-building the JSON only worked because the
 * current `@SerialName`s happen to contain nothing needing escaping.
 */
@Serializable
data class ApiErrorBody(
    val error: String,
    /** Either a [SchemaDegradedReason]'s wire spelling or "not-found" — the same union the web sends. */
    val reason: String,
)

/**
 * The wire spelling, read from the serializer rather than restated. Declaring it a second time (as a
 * constructor arg, or by trimming quotes off `encodeToString`) would let the two drift silently.
 */
val SchemaDegradedReason.wire: String
    get() = SchemaDegradedReason.serializer().descriptor.getElementName(ordinal)

/** The schemas available to a repo, plus why the list may be incomplete. */
data class SchemaCatalogResult(
    val defaultSchema: String?,
    val schemas: List<SchemaSummary>,
    val degradedReason: SchemaDegradedReason?,
)

/**
 * Reading one schema either works or explains why not. "We could not look" and "it does not exist"
 * stay distinct all the way to the view — only one of them is the reader's to fix.
 */
sealed interface SchemaReadResult {
    data class Ok(val schema: SchemaDefinition) : SchemaReadResult

    /** `reason` is null for not-found; otherwise the CLI degradation code. */
    data class Failed(val reason: SchemaDegradedReason?) : SchemaReadResult
}
