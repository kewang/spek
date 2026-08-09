package com.spek.intellij.server

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.spek.intellij.core.*
import io.netty.buffer.Unpooled
import io.netty.channel.ChannelHandlerContext
import io.netty.handler.codec.http.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import org.jetbrains.ide.HttpRequestHandler
import java.nio.charset.StandardCharsets

class SpekHttpRequestHandler : HttpRequestHandler() {
    private val log = Logger.getInstance(SpekHttpRequestHandler::class.java)
    private val json = Json { encodeDefaults = true }

    companion object {
        private const val API_PREFIX = "/api/spek/"
        private const val WEBVIEW_PREFIX = "/spek/webview/"
    }

    override fun isSupported(request: FullHttpRequest): Boolean {
        val uri = request.uri().substringBefore("?")
        return uri.startsWith(API_PREFIX) || uri.startsWith(WEBVIEW_PREFIX)
    }

    override fun process(
        urlDecoder: QueryStringDecoder,
        request: FullHttpRequest,
        context: ChannelHandlerContext,
    ): Boolean {
        val path = urlDecoder.path()

        // 靜態資源
        if (path.startsWith(WEBVIEW_PREFIX)) {
            return serveStaticResource(path, context)
        }

        // API 路由
        if (!path.startsWith(API_PREFIX)) return false

        val apiPath = path.removePrefix(API_PREFIX).trimEnd('/')
        val params = urlDecoder.parameters()
        val projectPath = params["projectPath"]?.firstOrNull()

        if (projectPath.isNullOrBlank() && apiPath.startsWith("openspec/")) {
            return sendError(context, HttpResponseStatus.BAD_REQUEST, "Missing projectPath parameter")
        }

        // 把 API 路由（含檔案掃描與 openspec CLI 子行程）移出內建 server 的 Netty 執行緒——該執行緒
        // 池為整個 IDE 內建 server 共用，若在此同步等待 CLI（至多 10s）會拖累其他平台功能。改丟到
        // pooled thread 處理；Netty 的 writeAndFlush 可安全跨執行緒呼叫，故 handler 立即回 true。
        ApplicationManager.getApplication().executeOnPooledThread {
            dispatchApiRequest(apiPath, projectPath, params, path, context)
        }
        return true
    }

    // 於 pooled thread 執行實際路由並寫回回應；回傳 Unit，寫入前檢查 channel 是否仍連線。
    private fun dispatchApiRequest(
        apiPath: String,
        projectPath: String?,
        params: Map<String, List<String>>,
        path: String,
        context: ChannelHandlerContext,
    ) {
        try {
            val result = routeRequest(apiPath, projectPath ?: "", params)
            if (!context.channel().isActive) return // client 已斷線
            when (result) {
                is ApiResult.Json -> sendJson(context, result.body)
                is ApiResult.NotFound -> sendJson(context, result.body, HttpResponseStatus.NOT_FOUND)
                null -> sendError(context, HttpResponseStatus.NOT_FOUND, "Endpoint not found: $apiPath")
            }
        } catch (e: Exception) {
            log.error("Error handling request: $path", e)
            if (context.channel().isActive) {
                sendError(context, HttpResponseStatus.INTERNAL_SERVER_ERROR, e.message ?: "Internal error")
            }
        }
    }

    /**
     * What a route produced. `null` from [routeRequest] still means "no such endpoint", which the
     * caller turns into a generic 404.
     *
     * [NotFound] exists because one route needs a 404 that carries a **body**: the shared frontend
     * reads `reason` off a schema 404 to tell "we could not look" (the CLI is missing) from "it does
     * not exist". Collapsing those would tell a reader whose CLI is not installed that their schema
     * is gone.
     */
    internal sealed interface ApiResult {
        data class Json(val body: String) : ApiResult
        data class NotFound(val body: String) : ApiResult
    }

    // internal 而非 private：路由表本身要能單測。缺 projectPath 的 400 由 process() 的共用檢查負責，
    // 那段需要 Netty channel，不在此層。
    internal fun routeRequest(
        apiPath: String,
        projectPath: String,
        params: Map<String, List<String>>,
    ): ApiResult? {
        // openspec/overview
        if (apiPath == "openspec/overview") {
            return ApiResult.Json(handleOverview(projectPath))
        }

        // openspec/specs/:topic/at/:slug
        val specAtChangeMatch = Regex("""^openspec/specs/([^/]+)/at/([^/]+)$""").find(apiPath)
        if (specAtChangeMatch != null) {
            val topic = specAtChangeMatch.groupValues[1]
            val slug = specAtChangeMatch.groupValues[2]
            return handleSpecAtChange(projectPath, topic, slug)?.let(ApiResult::Json)
                ?: notFound("Spec version not found")
        }

        // openspec/specs/:topic
        val specDetailMatch = Regex("""^openspec/specs/([^/]+)$""").find(apiPath)
        if (specDetailMatch != null) {
            val topic = specDetailMatch.groupValues[1]
            return handleSpecDetail(projectPath, topic)?.let(ApiResult::Json)
                ?: notFound("Spec not found")
        }

        // openspec/specs
        if (apiPath == "openspec/specs") {
            return ApiResult.Json(handleSpecs(projectPath))
        }

        // openspec/changes/:slug
        val changeDetailMatch = Regex("""^openspec/changes/([^/]+)$""").find(apiPath)
        if (changeDetailMatch != null) {
            val slug = changeDetailMatch.groupValues[1]
            return handleChangeDetail(projectPath, slug)?.let(ApiResult::Json)
                ?: notFound("Change not found")
        }

        // openspec/changes
        if (apiPath == "openspec/changes") {
            return ApiResult.Json(handleChanges(projectPath))
        }

        // openspec/graph
        if (apiPath == "openspec/graph") {
            return ApiResult.Json(handleGraph(projectPath))
        }

        // openspec/schemas/:name — before the bare /schemas route, as the spec routes are ordered.
        val schemaDetailMatch = Regex("""^openspec/schemas/([^/]+)$""").find(apiPath)
        if (schemaDetailMatch != null) {
            return handleSchemaDetail(projectPath, schemaDetailMatch.groupValues[1])
        }

        // openspec/schemas
        if (apiPath == "openspec/schemas") {
            return ApiResult.Json(handleSchemas(projectPath))
        }

        // openspec/search
        if (apiPath == "openspec/search") {
            val query = params["q"]?.firstOrNull() ?: ""
            return ApiResult.Json(handleSearch(projectPath, query))
        }

        // openspec/resync
        if (apiPath == "openspec/resync") {
            return ApiResult.Json(handleResync())
        }

        // fs/detect
        if (apiPath == "fs/detect") {
            val path = params["path"]?.firstOrNull() ?: projectPath
            return ApiResult.Json(handleDetect(path))
        }

        return null
    }

    /**
     * 讓本宿主實際持有、且可能供出陳舊視圖的伺服端狀態失效。
     *
     * 少了這條路由，前端（三個宿主共用）的 Refresh 每按一次就在 IntelliJ 收到一個 404 —— 一個假的
     * 錯誤訊號。缺 projectPath 時的 400 由上游 openspec/ 前綴的共用檢查負責，此處毋須重複。
     *
     * 這裡清的是 schema-order 快取，**不是** git timestamp 快取：Kotlin scanner 根本沒有後者
     * （ChangeInfo.timestamp 恆為 null），不該為了跟 Web / VS Code 形式對齊而假造一份不存在的工作。
     * 而清 schema-order 正是 plugin 的 file watcher 在刷新 webview 前已經會做的事
     * （見 SpekBrowserPanel 的 SchemaOrder.clearCache()）：手動 Refresh 沒有理由失效得比自動刷新少。
     */
    private fun handleResync(): String {
        SpekCaches.clearAll()
        return """{"ok":true}"""
    }

    private fun handleOverview(projectPath: String): String {
        val scan = OpenSpecScanner.scan(projectPath)
        var totalTasks = 0
        var completedTasks = 0
        for (change in scan.activeChanges + scan.archivedChanges) {
            change.taskStats?.let {
                totalTasks += it.total
                completedTasks += it.completed
            }
        }
        val overview = OverviewData(
            specsCount = scan.specs.size,
            changesCount = ChangesCount(scan.activeChanges.size, scan.archivedChanges.size),
            taskStats = TaskStats(totalTasks, completedTasks),
        )
        return json.encodeToString(overview)
    }

    private fun handleSpecs(projectPath: String): String {
        val scan = OpenSpecScanner.scan(projectPath)
        return json.encodeToString(scan.specs)
    }

    private fun handleSpecDetail(projectPath: String, topic: String): String? {
        val spec = SpecReader.read(projectPath, topic) ?: return null
        return json.encodeToString(spec)
    }

    private fun handleSpecAtChange(projectPath: String, topic: String, slug: String): String? {
        val result = SpecReader.readAtChange(projectPath, topic, slug) ?: return null
        return json.encodeToString(result)
    }

    private fun handleChanges(projectPath: String): String {
        val scan = OpenSpecScanner.scan(projectPath)
        val data = ChangesData(scan.activeChanges, scan.archivedChanges, scan.defaultSchema)
        return json.encodeToString(data)
    }

    private fun handleChangeDetail(projectPath: String, slug: String): String? {
        val change = ChangeReader.read(projectPath, slug) ?: return null
        return json.encodeToString(change)
    }

    private fun handleGraph(projectPath: String): String {
        val data = GraphBuilder.build(projectPath)
        return json.encodeToString(data)
    }

    /**
     * The catalog joined with the active changes using it.
     *
     * A CLI failure is a degraded 200, never a 5xx: the view still has project-local schemas to show
     * and a `degradedReason` to explain the rest.
     */
    private fun handleSchemas(projectPath: String): String {
        // Independent of each other, so run them together — the web route does the same with
        // Promise.all. On a cold catalog this overlaps the CLI round trips with the file walk
        // instead of stacking them.
        val (catalog, scan) = OpenspecCli.inParallel(
            listOf<() -> Any>(
                { SchemaCatalog.listSchemas(projectPath) },
                { OpenSpecScanner.scan(projectPath) },
            ),
        )
        return json.encodeToString(
            SchemaCatalog.groupSchemaUsage(catalog as SchemaCatalogResult, (scan as ScanResult).activeChanges),
        )
    }

    /**
     * One schema's definition, or a 404 whose body says **why**.
     *
     * "We could not look" and "it does not exist" stay distinct all the way to the view — only one
     * of them is the reader's to fix, and a missing CLI reported as "no such schema" sends them
     * hunting for a file that is right where they left it.
     *
     * Carries `usage` beside the definition's own fields, as the web route does.
     */
    private fun handleSchemaDetail(projectPath: String, name: String): ApiResult {
        return when (val result = SchemaCatalog.readSchema(projectPath, name)) {
            is SchemaReadResult.Ok -> {
                val scan = OpenSpecScanner.scan(projectPath)
                val usage = SchemaCatalog.countSchemaUsage(scan.activeChanges, name)
                // Merged as JSON, not via a second data class restating every SchemaDefinition field.
                val body = JsonObject(
                    json.encodeToJsonElement(result.schema).jsonObject +
                        ("usage" to json.encodeToJsonElement(usage)),
                )
                ApiResult.Json(json.encodeToString(body))
            }
            // Through the serializer like every other body in this file. Interpolating it worked only
            // because the reason spellings happen to contain nothing needing escaping.
            is SchemaReadResult.Failed -> notFound("Schema not found", result.reason)
        }
    }

    /** A 404 body carrying why, so "we could not look" never reads as "it does not exist". */
    private fun notFound(message: String, reason: SchemaDegradedReason? = null): ApiResult.NotFound =
        ApiResult.NotFound(json.encodeToString(ApiErrorBody(message, reason?.wire ?: "not-found")))

    private fun handleSearch(projectPath: String, query: String): String {
        val results = SearchService.search(projectPath, query)
        return json.encodeToString(results)
    }

    private fun handleDetect(path: String): String {
        val data = DetectData(hasOpenSpec = OpenSpecScanner.hasOpenSpec(path))
        return json.encodeToString(data)
    }

    private fun serveStaticResource(path: String, context: ChannelHandlerContext): Boolean {
        val resourcePath = "webview/" + path.removePrefix(WEBVIEW_PREFIX)
        val resource = javaClass.classLoader.getResource(resourcePath) ?: return false

        val bytes = resource.readBytes()
        val contentType = when {
            resourcePath.endsWith(".html") -> "text/html; charset=utf-8"
            resourcePath.endsWith(".js") -> "application/javascript; charset=utf-8"
            resourcePath.endsWith(".css") -> "text/css; charset=utf-8"
            resourcePath.endsWith(".svg") -> "image/svg+xml"
            resourcePath.endsWith(".png") -> "image/png"
            else -> "application/octet-stream"
        }

        val response = DefaultFullHttpResponse(
            HttpVersion.HTTP_1_1,
            HttpResponseStatus.OK,
            Unpooled.wrappedBuffer(bytes),
        )
        response.headers().apply {
            set(HttpHeaderNames.CONTENT_TYPE, contentType)
            set(HttpHeaderNames.CONTENT_LENGTH, bytes.size)
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            set(HttpHeaderNames.CACHE_CONTROL, "no-cache")
        }
        context.channel().writeAndFlush(response)
        return true
    }

    private fun sendJson(
        context: ChannelHandlerContext,
        jsonStr: String,
        status: HttpResponseStatus = HttpResponseStatus.OK,
    ): Boolean {
        val bytes = jsonStr.toByteArray(StandardCharsets.UTF_8)
        val response = DefaultFullHttpResponse(
            HttpVersion.HTTP_1_1,
            status,
            Unpooled.wrappedBuffer(bytes),
        )
        response.headers().apply {
            set(HttpHeaderNames.CONTENT_TYPE, "application/json; charset=utf-8")
            set(HttpHeaderNames.CONTENT_LENGTH, bytes.size)
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_METHODS, "GET, POST, OPTIONS")
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_HEADERS, "Content-Type")
        }
        context.channel().writeAndFlush(response)
        return true
    }

    private fun sendError(
        context: ChannelHandlerContext,
        status: HttpResponseStatus,
        message: String,
    ): Boolean {
        val errorJson = """{"error":"$message"}"""
        val bytes = errorJson.toByteArray(StandardCharsets.UTF_8)
        val response = DefaultFullHttpResponse(
            HttpVersion.HTTP_1_1,
            status,
            Unpooled.wrappedBuffer(bytes),
        )
        response.headers().apply {
            set(HttpHeaderNames.CONTENT_TYPE, "application/json; charset=utf-8")
            set(HttpHeaderNames.CONTENT_LENGTH, bytes.size)
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        }
        context.channel().writeAndFlush(response)
        return true
    }
}
