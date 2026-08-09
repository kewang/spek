package com.spek.intellij.core

import com.intellij.openapi.application.ApplicationManager
import java.io.File
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Talking to the `openspec` CLI, and remembering what it said.
 *
 * The Kotlin counterpart of `packages/core/src/openspec-cli.ts`, and it exists for the same reason
 * that module does: both of these were written twice before — once in [SchemaOrder] and again in
 * [SchemaCatalog] — and the duplication was not free. On the TypeScript side the cache's original
 * "remember failures forever" bug had to be found once and then hand-copied as a fix into the second
 * copy. The subprocess safeguards and the cache policy are each stated once, here.
 */
object OpenspecCli {
    /**
     * How long the CLI gets before it is killed.
     *
     * Load-bearing against [TtlCache]'s default TTL, which must stay >= this — see the note there.
     */
    const val TIMEOUT_SECONDS = 10L

    /**
     * The raw outcome of running the CLI — deliberately *not* a verdict.
     *
     * Interpretation differs by caller and belongs to them: [SchemaOrder] collapses every failure to
     * null, while [SchemaCatalog] needs a failure taxonomy *and* stdout even on a non-zero exit,
     * because `openspec schema which <unknown>` answers correctly and exits 1.
     */
    sealed interface Outcome {
        data class Completed(val exitCode: Int, val stdout: String) : Outcome
        data object TimedOut : Outcome
        data object StartFailed : Outcome
    }

    /**
     * Run `openspec <args>` in [cwd] and return its exit code and stdout.
     *
     * Four safeguards, all load-bearing:
     * 1. stderr is DISCARDed rather than merged — the schema commands print an experimental-command
     *    notice there, which would corrupt stdout's JSON, and an undrained stderr pipe can fill and
     *    deadlock the child.
     * 2. stdout is drained on an IDE pooled thread, so a full pipe cannot block the child. The IDE
     *    pool is cached-type and suited to blocking IO; `commonPool` has parallelism = cores-1, where
     *    a blocking read can starve the reader task on a low-core machine and make a healthy CLI look
     *    like a timeout.
     * 3. `waitFor` has a hard timeout and `destroyForcibly` follows it — cancelling the reader future
     *    cannot interrupt a blocking read; closing the child's stdout is what releases it.
     * 4. the reader's own `get` is bounded too.
     *
     * **Callers must validate every interpolated argument first.** On Windows, ProcessBuilder's argv
     * is re-parsed by cmd.exe for `openspec.cmd` (BatBadBut / CVE-2024-27980) and, unlike Node's
     * cross-spawn on the TypeScript side, it does not escape for us — so an allowlist at the call
     * site is a security boundary here, not a tidiness rule.
     */
    fun run(args: List<String>, cwd: String, timeoutSeconds: Long = TIMEOUT_SECONDS): Outcome {
        return try {
            val bin = if (System.getProperty("os.name").orEmpty().lowercase().contains("win")) {
                "openspec.cmd"
            } else {
                "openspec"
            }
            val proc = ProcessBuilder(listOf(bin) + args)
                .directory(File(cwd))
                .redirectError(ProcessBuilder.Redirect.DISCARD)
                .start()
            val reader = ApplicationManager.getApplication().executeOnPooledThread(
                Callable { proc.inputStream.bufferedReader().use { it.readText() } },
            )
            if (!proc.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                proc.destroyForcibly()
                reader.cancel(true)
                return Outcome.TimedOut
            }
            Outcome.Completed(proc.exitValue(), reader.get(2, TimeUnit.SECONDS))
        } catch (_: Exception) {
            // openspec not installed → IOException from start(); anything else is equally unusable.
            Outcome.StartFailed
        }
    }

    /**
     * Run [tasks] concurrently on IDE pooled threads and collect the results in order.
     *
     * Falls back to running them in sequence when there is no Application — plain unit tests have no
     * IDE, and this is an optimisation, not a requirement. Failing there would make the tests depend
     * on a platform they otherwise do not need.
     */
    fun <T> inParallel(tasks: List<() -> T>): List<T> {
        val app = ApplicationManager.getApplication()
        if (tasks.size <= 1 || app == null) return tasks.map { it() }
        return tasks.map { task -> app.executeOnPooledThread(Callable { task() }) }.map { it.get() }
    }
}

/**
 * A TTL- and size-capped cache, holding one value per key.
 *
 * Caching a failure forever meant a reader who installed the CLI after first load never got data
 * without restarting the IDE — and the same for editing a schema on disk. Hence a TTL, deliberately
 * **>= [OpenspecCli.TIMEOUT_SECONDS]** so an in-flight call can never be judged stale and run a
 * second time, plus a size cap: these caches are application-level singletons shared across every
 * project window, so they outlive any one project.
 *
 * `ConcurrentHashMap` because the built-in server's handlers arrive on Netty threads. CHM forbids
 * null values, so entries wrap the value — "computed, and the answer was unavailable" must be
 * cacheable too, which is why [V] may be nullable. CHM has no insertion order, so the cap evicts an
 * arbitrary entry rather than the oldest; strict FIFO would need a synchronized LinkedHashMap, which
 * a best-effort cache does not warrant.
 *
 * The get→miss→compute→put race is benign: two callers may compute the same idempotent value and the
 * later write wins with an equal result.
 */
class TtlCache<K : Any, V>(
    private val ttlMs: Long = 30_000L,
    private val maxSize: Int = 256,
) {
    private data class Entry<V>(val at: Long, val value: V)

    private val map = ConcurrentHashMap<K, Entry<V>>()

    fun getOrCompute(key: K, compute: () -> V): V {
        map[key]?.let {
            if (System.currentTimeMillis() - it.at <= ttlMs) return it.value
            map.remove(key)
        }
        val value = compute()
        if (map.size >= maxSize) map.keys.firstOrNull()?.let { map.remove(it) }
        map[key] = Entry(System.currentTimeMillis(), value)
        return value
    }

    fun clear() = map.clear()
}
