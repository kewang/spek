package com.spek.intellij.core

import com.intellij.openapi.application.ApplicationManager
import java.io.File
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException
import java.util.concurrent.FutureTask
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
     * Reasons a second read could plausibly come out differently — the ones a running host repairs
     * by itself: a binary not on `PATH` *yet*, or load easing before the next call.
     *
     * The other two are not. A non-zero exit with no body, or output that cannot be parsed, is the
     * *installed CLI* answering — a version too old for a command it still marks experimental, a
     * wrapper printing a banner — and a read a second later finds it identical. Retrying those on
     * every read spawns a process to be told the same thing, on views that re-read whenever the
     * watched tree changes.
     *
     * The mirror of `isTransient` in `openspec-cli.ts`, and stated once here for the same reason.
     */
    fun isTransient(reason: SchemaDegradedReason): Boolean =
        reason == SchemaDegradedReason.CLI_UNAVAILABLE || reason == SchemaDegradedReason.CLI_TIMEOUT

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
 * A TTL- and size-capped cache holding one **computation** per key.
 *
 * A TTL because caching a failure forever meant a reader who installed the CLI after first load
 * never got data without restarting the IDE; it must stay >= [OpenspecCli.TIMEOUT_SECONDS] so an
 * in-flight call is never judged stale. A size cap because these are application-level singletons
 * shared across every project window. (`cli-budget.ts` states the same bounds.) The TTL is the
 * bound on a remembered *answer*; a failure worth retrying is not held for it at all — see
 * [Outcome].
 *
 * `ConcurrentHashMap` because handlers arrive on Netty threads. CHM forbids null values, so entries
 * wrap the result — [V] may be nullable, since "computed, and there is none" is an answer like any
 * other. CHM has no insertion order, so the cap evicts an arbitrary entry rather than the oldest.
 *
 * The entry holds a [FutureTask] so a caller arriving mid-flight joins the run rather than starting
 * a second one — storing the value instead made two concurrent callers each run the whole CLI
 * enumeration for one answer. `putIfAbsent` + `run()`, **not** `computeIfAbsent`, which would hold
 * the bin lock across a subprocess.
 *
 * What is remembered is decided by [compute], which returns an [Outcome] saying so — see
 * `openspec-cli.ts`'s `CliOutcome`, of which this is the mirror. The cache cannot judge it from the
 * value, because by then the value has usually lost the distinction: a null schema order is both
 * "the CLI answered and there is no order" and "the CLI could not be reached".
 */
class TtlCache<K : Any, V>(
    private val ttlMs: Long = 30_000L,
    private val maxSize: Int = 256,
) {
    /**
     * A result, plus whether it is worth remembering.
     *
     * Covariant because it only ever hands [value] out: without that, `failed(null)` and
     * `answered(order)` in one `when` infer as unrelated types and every call site has to spell the
     * type parameter out.
     */
    class Outcome<out V> private constructor(val value: V, val remember: Boolean) {
        companion object {
            /** An answer: kept for the TTL, like any successful read. */
            fun <V> answered(value: V): Outcome<V> = Outcome(value, true)

            /** A failure the next read could find gone: returned to the caller, but not kept. */
            fun <V> failed(value: V): Outcome<V> = Outcome(value, false)
        }
    }

    /** A held value, boxed so an absent entry stays distinguishable from an entry holding null. */
    class Held<out V>(val value: V)

    private class Entry<V>(val at: Long, val task: FutureTask<Outcome<V>>)

    private val map = ConcurrentHashMap<K, Entry<V>>()

    /**
     * What [key] currently holds, or null — **without installing anything**.
     *
     * [getOrCompute] cannot answer this: asking it is asking it to compute. A caller with something
     * cheaper than a CLI call to do when there is no current entry has to find that out without
     * creating one — see [SchemaOrder], which replays a settled failure only when the bucket has no
     * answer to serve. Joins an in-flight run like any hit; an expired entry reads as absent and is
     * left for [getOrCompute] to replace, so a peek cannot race out a run installed since.
     */
    fun peek(key: K): Held<V>? {
        val existing = map[key] ?: return null
        if (System.currentTimeMillis() - existing.at > ttlMs) return null
        return Held(existing.task.awaitValue().value)
    }

    fun getOrCompute(key: K, compute: () -> Outcome<V>): V {
        while (true) {
            val existing = map[key]
            if (existing != null) {
                // A joiner holds the entry itself, so a failure removed from the map after it
                // resolves is still delivered here — sharing the run does not depend on keeping it.
                if (System.currentTimeMillis() - existing.at <= ttlMs) return existing.task.awaitValue().value
                // Two-arg remove, so a fresher entry installed since the read is not discarded.
                map.remove(key, existing)
            }

            val task = FutureTask(compute)
            val entry = Entry(System.currentTimeMillis(), task)
            val raced = map.putIfAbsent(key, entry)
            // Someone else got there first; loop so their entry is freshness-checked like any hit.
            if (raced != null) continue
            if (map.size > maxSize) {
                // Never the entry just installed, or a burst evicts the run everyone is waiting on.
                map.keys.firstOrNull { it != key }?.let { map.remove(it) }
            }
            task.run()
            // The thread that installed the entry is the only one that runs it, so it is the one
            // that drops it. `finally` rather than a check on the result: a compute that threw
            // produces no outcome to inspect, and a remembered exception is the same bug in another
            // shape — every caller in the window handed a failure whose cause may be gone.
            var remember = false
            try {
                val outcome = task.awaitValue()
                remember = outcome.remember
                return outcome.value
            } finally {
                if (!remember) map.remove(key, entry)
            }
        }
    }

    fun clear() = map.clear()

    /** Unwrapped, so a shared run reports the same exception an unshared one would. */
    private fun FutureTask<Outcome<V>>.awaitValue(): Outcome<V> =
        try {
            get()
        } catch (e: ExecutionException) {
            throw e.cause ?: e
        }
}

/**
 * A TTL- and size-capped set of keys: the record that something happened, carrying no value.
 *
 * Beside [TtlCache] rather than in a module of its own, and taking the same bounds, because the one
 * thing it must never do is age differently from the cache it complements — [SchemaOrder] keeps a
 * cache of answers and a set of settled changes, and a mark outliving an answer is a mark denying a
 * consultation the cache would already have re-run.
 *
 * `ConcurrentHashMap` for the reason [TtlCache] uses one: handlers arrive on Netty threads. CHM has
 * no insertion order, so the cap evicts an arbitrary key rather than the oldest — a bound, not a
 * policy.
 */
class TtlMarks<K : Any>(
    private val ttlMs: Long = 30_000L,
    private val maxSize: Int = 256,
) {
    private val map = ConcurrentHashMap<K, Long>()

    fun isMarked(key: K): Boolean {
        val at = map[key] ?: return false
        if (System.currentTimeMillis() - at > ttlMs) {
            map.remove(key, at)
            return false
        }
        return true
    }

    fun mark(key: K) {
        if (map.size >= maxSize) map.keys.firstOrNull { it != key }?.let { map.remove(it) }
        map[key] = System.currentTimeMillis()
    }

    fun clear() = map.clear()
}
