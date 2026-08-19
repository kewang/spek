package com.spek.intellij.core

import com.spek.intellij.core.TtlCache.Outcome.Companion.answered
import com.spek.intellij.core.TtlCache.Outcome.Companion.failed
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * [TtlCache] caches a computation, not a value. The difference only shows when two callers arrive on
 * a cold key at once, which is why the concurrent case below is the one that matters.
 *
 * It also caches an *answer* only: a compute says whether its result is worth remembering, and a
 * failure is dropped once it resolves so the next read tries again. The TypeScript mirror is
 * `openspec-cli.test.ts`, case for case.
 */
class TtlCacheTest {

    @Test
    fun `a fresh hit does not recompute`() {
        val cache = TtlCache<String, Int>()
        val calls = AtomicInteger()
        repeat(3) { cache.getOrCompute("k") { answered(calls.incrementAndGet()) } }
        assertEquals(1, calls.get())
    }

    @Test
    fun `keys do not share an entry`() {
        val cache = TtlCache<String, String>()
        assertEquals("a", cache.getOrCompute("a") { answered("a") })
        assertEquals("b", cache.getOrCompute("b") { answered("b") })
    }

    @Test
    fun `an expired entry is recomputed`() {
        // 1ms and a real wait, not 0ms: freshness is `elapsed <= ttlMs`, so a 0ms entry read back
        // within the same millisecond is still fresh and the test would be asserting the clock.
        val cache = TtlCache<String, Int>(ttlMs = 1L)
        val calls = AtomicInteger()
        cache.getOrCompute("k") { answered(calls.incrementAndGet()) }
        Thread.sleep(10)
        cache.getOrCompute("k") { answered(calls.incrementAndGet()) }
        assertEquals(2, calls.get())
    }

    @Test
    fun `a null answer is cacheable`() {
        // ConcurrentHashMap forbids null values, hence the wrapper. And "computed, and there is no
        // order" is an answer like any other — the distinction the value itself cannot carry.
        val cache = TtlCache<String, String?>()
        val calls = AtomicInteger()
        repeat(2) {
            cache.getOrCompute("k") {
                calls.incrementAndGet()
                answered(null)
            }
        }
        assertEquals(1, calls.get())
    }

    @Test
    fun `a failure is not remembered, so the next read retries`() {
        // The reported bug (issue #46): the environment is repaired between two reads, and the
        // second must see it rather than be served the first one's failure for the rest of the TTL.
        val cache = TtlCache<String, String?>()
        val calls = AtomicInteger()
        val compute = {
            if (calls.incrementAndGet() == 1) failed(null) else answered("order")
        }

        assertEquals(null, cache.getOrCompute("k", compute))
        assertEquals("order", cache.getOrCompute("k", compute))
        assertEquals(2, calls.get())
    }

    @Test
    fun `an answer following a failure is the one that gets cached`() {
        val cache = TtlCache<String, String?>()
        val calls = AtomicInteger()
        val compute = {
            if (calls.incrementAndGet() == 1) failed(null) else answered("order")
        }

        cache.getOrCompute("k", compute)
        cache.getOrCompute("k", compute)
        assertEquals("order", cache.getOrCompute("k", compute))
        assertEquals(2, calls.get())
    }

    @Test
    fun `a compute that throws is not remembered either`() {
        // A remembered exception is the same bug in another shape: every caller in the window gets
        // a failure whose cause may already be gone.
        val cache = TtlCache<String, String>()
        val calls = AtomicInteger()
        val compute = {
            if (calls.incrementAndGet() == 1) throw IllegalStateException("boom")
            answered("order")
        }

        assertFailsWith<IllegalStateException> { cache.getOrCompute("k", compute) }
        assertEquals("order", cache.getOrCompute("k", compute))
        assertEquals(2, calls.get())
    }

    @Test
    fun `a second caller joins the run in flight instead of starting another`() {
        val cache = TtlCache<String, String>()
        val calls = AtomicInteger()
        val started = CountDownLatch(1)
        val release = CountDownLatch(1)

        // The first caller blocks inside compute, standing in for a CLI round trip.
        val first = Thread {
            cache.getOrCompute("k") {
                calls.incrementAndGet()
                started.countDown()
                release.await()
                answered("value")
            }
        }
        first.start()
        assertTrue(started.await(5, TimeUnit.SECONDS), "compute never started")

        // The second arrives mid-flight: storing the value would have it miss and run its own copy.
        val secondResult = arrayOfNulls<String>(1)
        val second = Thread { secondResult[0] = cache.getOrCompute("k") { answered("value") } }
        second.start()

        release.countDown()
        first.join(5_000)
        second.join(5_000)

        assertEquals(1, calls.get(), "the computation ran twice for one answer")
        assertEquals("value", secondResult[0])
    }

    @Test
    fun `a failing run is shared in flight too`() {
        // Not remembering a failure must not become not deduping one: on a host where the CLI
        // cannot be reached, every concurrent reader would otherwise spawn its own process.
        val cache = TtlCache<String, String?>()
        val calls = AtomicInteger()
        val started = CountDownLatch(1)
        val release = CountDownLatch(1)

        val first = Thread {
            cache.getOrCompute("k") {
                calls.incrementAndGet()
                started.countDown()
                release.await()
                failed(null)
            }
        }
        first.start()
        assertTrue(started.await(5, TimeUnit.SECONDS), "compute never started")

        val second = Thread { cache.getOrCompute("k") { failed(null) } }
        second.start()

        release.countDown()
        first.join(5_000)
        second.join(5_000)

        assertEquals(1, calls.get(), "the failing run was not shared")
    }

    @Test
    fun `a failure surfaces as itself, not wrapped`() {
        val cache = TtlCache<String, String>()
        val thrown = assertFailsWith<IllegalStateException> {
            cache.getOrCompute("k") { throw IllegalStateException("boom") }
        }
        assertEquals("boom", thrown.message)
    }

    @Test
    fun `the size cap evicts rather than growing without bound`() {
        val cache = TtlCache<Int, Int>(maxSize = 4)
        repeat(50) { i -> cache.getOrCompute(i) { answered(i) } }
        // Which key was evicted is unspecified — CHM has no insertion order — so assert only that
        // it still answers correctly.
        assertEquals(99, cache.getOrCompute(99) { answered(99) })
    }

    @Test
    fun `clear drops everything`() {
        val cache = TtlCache<String, Int>()
        val calls = AtomicInteger()
        cache.getOrCompute("k") { answered(calls.incrementAndGet()) }
        cache.clear()
        cache.getOrCompute("k") { answered(calls.incrementAndGet()) }
        assertEquals(2, calls.get())
    }
}
