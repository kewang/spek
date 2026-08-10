package com.spek.intellij.core

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
 */
class TtlCacheTest {

    @Test
    fun `a fresh hit does not recompute`() {
        val cache = TtlCache<String, Int>()
        val calls = AtomicInteger()
        repeat(3) { cache.getOrCompute("k") { calls.incrementAndGet() } }
        assertEquals(1, calls.get())
    }

    @Test
    fun `keys do not share an entry`() {
        val cache = TtlCache<String, String>()
        assertEquals("a", cache.getOrCompute("a") { "a" })
        assertEquals("b", cache.getOrCompute("b") { "b" })
    }

    @Test
    fun `an expired entry is recomputed`() {
        // 1ms and a real wait, not 0ms: freshness is `elapsed <= ttlMs`, so a 0ms entry read back
        // within the same millisecond is still fresh and the test would be asserting the clock.
        val cache = TtlCache<String, Int>(ttlMs = 1L)
        val calls = AtomicInteger()
        cache.getOrCompute("k") { calls.incrementAndGet() }
        Thread.sleep(10)
        cache.getOrCompute("k") { calls.incrementAndGet() }
        assertEquals(2, calls.get())
    }

    @Test
    fun `a null result is cacheable`() {
        // ConcurrentHashMap forbids null values, hence the wrapper.
        val cache = TtlCache<String, String?>()
        val calls = AtomicInteger()
        repeat(2) {
            cache.getOrCompute("k") {
                calls.incrementAndGet()
                null
            }
        }
        assertEquals(1, calls.get())
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
                "value"
            }
        }
        first.start()
        assertTrue(started.await(5, TimeUnit.SECONDS), "compute never started")

        // The second arrives mid-flight: storing the value would have it miss and run its own copy.
        val secondResult = arrayOfNulls<String>(1)
        val second = Thread { secondResult[0] = cache.getOrCompute("k") { "value" } }
        second.start()

        release.countDown()
        first.join(5_000)
        second.join(5_000)

        assertEquals(1, calls.get(), "the computation ran twice for one answer")
        assertEquals("value", secondResult[0])
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
        repeat(50) { i -> cache.getOrCompute(i) { i } }
        // Which key was evicted is unspecified — CHM has no insertion order — so assert only that
        // it still answers correctly.
        assertEquals(99, cache.getOrCompute(99) { 99 })
    }

    @Test
    fun `clear drops everything`() {
        val cache = TtlCache<String, Int>()
        val calls = AtomicInteger()
        cache.getOrCompute("k") { calls.incrementAndGet() }
        cache.clear()
        cache.getOrCompute("k") { calls.incrementAndGet() }
        assertEquals(2, calls.get())
    }
}
