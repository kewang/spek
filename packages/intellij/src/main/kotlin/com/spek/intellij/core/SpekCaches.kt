package com.spek.intellij.core

/**
 * Every server-side cache this host holds, invalidated together.
 *
 * One seam rather than a list of `X.clearCache()` calls repeated at each event site. There are two
 * such sites — the resync route and the file watcher — and each new cache previously meant a new
 * hand-added line at both, with the ordering rationale copied alongside it. A cache missed at one
 * site silently serves a stale view from that path only, which is the hardest shape of this bug to
 * notice.
 *
 * Ordering matters at the call sites, not here: callers must clear **before** telling the webview to
 * refetch, or the refetch can beat the invalidation and repopulate the cache with stale data.
 */
object SpekCaches {
    fun clearAll() {
        SchemaOrder.clearCache()
        // Schemas resolve from three places and only this project's own openspec/ is watched, so a
        // schema edited at the machine level — or promoted from project to user — produces no event
        // this host can see. Dropping this cache is what makes Refresh able to pick it up at all.
        SchemaCatalog.clearCache()
    }
}
