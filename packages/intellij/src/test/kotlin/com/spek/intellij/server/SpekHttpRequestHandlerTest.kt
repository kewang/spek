package com.spek.intellij.server

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SpekHttpRequestHandlerTest {

    /**
     * 迴歸測試：這條路由曾經根本不存在，導致三個宿主共用的前端每按一次 Refresh，
     * IntelliJ 就回一個 404 —— 前端沒有 catch，於是整顆按鈕靜默失效（issue #18）。
     */
    @Test
    fun resyncRouteExistsAndReportsOk() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/resync", "/tmp/does-not-matter", emptyMap())

        assertEquals(SpekHttpRequestHandler.ApiResult.Json("""{"ok":true}"""), result, "resync 必須被路由到，且回報成功")
    }

    /** 未知路徑仍須回 null（由呼叫端轉成 404），確認上面那條不是靠萬用比對矇到的。 */
    @Test
    fun unknownRouteReturnsNull() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/no-such-endpoint", "/tmp/does-not-matter", emptyMap())

        assertNull(result)
    }

    /** resync 不讀專案內容，故不得因為 projectPath 不存在而丟例外。 */
    @Test
    fun resyncDoesNotTouchTheProjectDirectory() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/resync", "/nonexistent/project/path", emptyMap())

        assertEquals(SpekHttpRequestHandler.ApiResult.Json("""{"ok":true}"""), result)
    }

    /**
     * A schema name that resolves to nothing is a 404 **with a body**: the shared frontend reads
     * `reason` off it to tell "it does not exist" from "we could not look". A bare 404 would make a
     * missing openspec CLI read as a missing schema.
     */
    @Test
    fun unknownSchemaNameIsANotFoundCarryingAReason() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest(
            "openspec/schemas/no-such-schema",
            createTempProject().absolutePath,
            emptyMap(),
        )

        val notFound = assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(result)
        assertTrue(notFound.body.contains(""""reason":"""), "expected a reason in ${notFound.body}")
    }

    /**
     * A name failing the allowlist must not reach the CLI or the filesystem at all — it is rejected
     * as not-found rather than being looked up.
     */
    @Test
    fun unsafeSchemaNameIsRejectedAsNotFound() {
        val handler = SpekHttpRequestHandler()

        // `..` cannot appear in a path segment the router matches, so the traversal attempt that can
        // actually arrive is a single unsafe segment.
        val result = handler.routeRequest(
            "openspec/schemas/-leading",
            createTempProject().absolutePath,
            emptyMap(),
        )

        val notFound = assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(result)
        assertTrue(notFound.body.contains(""""reason":"not-found""""), notFound.body)
    }

    /**
     * A missing *resource* is not a missing *endpoint*. These routes matched — the spec simply is not
     * there — so answering "Endpoint not found" would be untrue, and it read identically to a typo in
     * the URL.
     */
    @Test
    fun missingResourcesSayWhatIsActuallyMissing() {
        val handler = SpekHttpRequestHandler()
        val project = createTempProject().absolutePath

        val spec = handler.routeRequest("openspec/specs/no-such-topic", project, emptyMap())
        assertTrue(assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(spec).body.contains("Spec not found"))

        val change = handler.routeRequest("openspec/changes/no-such-change", project, emptyMap())
        assertTrue(assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(change).body.contains("Change not found"))

        // An endpoint that genuinely does not exist still returns null, so the two stay distinguishable.
        assertNull(handler.routeRequest("openspec/no-such-endpoint", project, emptyMap()))
    }

    /** The bare route is a plain 200 even with no schemas: the view renders its own empty state. */
    @Test
    fun schemasListIsAlwaysA200() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/schemas", createTempProject().absolutePath, emptyMap())

        val ok = assertIs<SpekHttpRequestHandler.ApiResult.Json>(result)
        assertTrue(ok.body.contains("\"schemas\""), ok.body)
    }

    private fun createTempProject(): File =
        File.createTempFile("spek-routes", "").let {
            it.delete()
            File(it, "openspec").mkdirs()
            it.deleteOnExit()
            it
        }
}
