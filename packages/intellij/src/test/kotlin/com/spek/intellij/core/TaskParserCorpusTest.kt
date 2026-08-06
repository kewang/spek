package com.spek.intellij.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * The Kotlin half of the shared task-parser fixture corpus. The same directory is read by
 * `packages/core/src/tasks.corpus.test.ts`; adding a fixture there is what makes both languages
 * assert a case, with no step anyone has to remember.
 *
 * The two loaders are specified by behavior, not by being the same code, and every rule is spelled
 * out on both sides rather than inherited from a JSON library — the libraries disagree about which
 * documents are valid, which would make the loaders disagree about which fixtures exist.
 *
 * See openspec/specs/task-parser-fixture-corpus.
 */
class TaskParserCorpusTest {

    @TestFactory
    fun corpus(): List<DynamicTest> =
        TaskParserCorpus.load(TaskParserCorpus.configuredDir()).map { fixture ->
            DynamicTest.dynamicTest("corpus: ${fixture.name}") {
                val expected = fixture.divergences[TaskParserCorpus.SELF]?.expected ?: fixture.expected
                assertEquals(expected, TaskParser.parse(fixture.input), fixture.note)
            }
        }

    // --- the loader's own rules -------------------------------------------------------------
    //
    // Driven by test-fixtures/task-parser/invalid/, which the Node loader reads too. These rules were
    // two hand-written suites mirroring each other until verification found what that always misses:
    // a `"meta": null` that this side rejected properly and the Node one threw a bare TypeError on,
    // with no filename. That is the mechanism this whole change exists to remove, reappearing one
    // level down. Now each rejection -- and the wording of each message -- is asserted in both
    // languages from one file.
    //
    // Positive cases need no tests here: every fixture in the corpus above is a pretty-printed
    // document that loaded successfully, and one of them carries a single-implementation divergence.

    @TestFactory
    fun rejections(): List<DynamicTest> =
        TaskParserCorpus.loadInvalidCases(TaskParserCorpus.configuredInvalidDir()).map { invalid ->
            DynamicTest.dynamicTest("loader rejects: ${invalid.name}") {
                val error = assertFailsWith<IllegalArgumentException>(invalid.note) {
                    if (invalid.stage == "bytes") {
                        TaskParserCorpus.checkFixtureBytes(
                            invalid.document.toByteArray(Charsets.UTF_8),
                            invalid.fileName,
                        )
                    } else {
                        TaskParserCorpus.parseFixture(invalid.document, invalid.fileName)
                    }
                }
                val message = error.message ?: ""
                // Naming the file is part of the contract, not a nicety: a rejection nobody can
                // locate is barely better than none.
                assertTrue(
                    message.contains(invalid.fileName),
                    "${invalid.name}: message must name the file, got: $message",
                )
                assertTrue(
                    message.contains(invalid.expectedMessage),
                    "${invalid.name}: message must contain \"${invalid.expectedMessage}\", got: $message",
                )
            }
        }
}

/**
 * Loader for the shared corpus. Separate from the test class so its rules can be exercised directly.
 */
object TaskParserCorpus {

    const val SELF = "kotlin"
    private val IMPLEMENTATIONS = setOf("typescript", SELF)
    private const val CORPUS_PROPERTY = "spek.taskParserCorpus"

    data class Divergence(val reason: String, val expected: ParsedTasks)

    data class Fixture(
        val name: String,
        val note: String,
        val input: String,
        val expected: ParsedTasks,
        val divergences: Map<String, Divergence> = emptyMap(),
    )

    private val FIXTURE_FIELDS = setOf("name", "note", "input", "expected", "divergences", "meta")
    private val DIVERGENCE_FIELDS = setOf("reason", "expected")

    // Validated field by field against the parse tree rather than decoded straight into the data
    // classes above. Deserialising @Serializable classes looks like it would give the type checking
    // for free, and mostly it does — but kotlinx accepts a quoted number for an Int, so
    // `"total": "1"` decodes happily here while JSON.parse plus the Node loader rejects it. That is
    // the two loaders disagreeing about which fixtures are valid, which is the one thing they must
    // not do. Every type rule is therefore spelled out on both sides.
    private val json = Json

    /**
     * The corpus directory, passed by the build. Absent means the wiring is broken, so this throws
     * rather than skipping: a suite that quietly asserts nothing is the failure this corpus exists to
     * make impossible.
     */
    fun configuredDir(): File {
        val configured = System.getProperty(CORPUS_PROPERTY)
            ?: throw IllegalStateException(
                "system property $CORPUS_PROPERTY is not set; the test task must pass the corpus directory",
            )
        return File(configured)
    }

    fun load(dir: File): List<Fixture> {
        val entries = dir.listFiles { file -> file.name.endsWith(".json") }?.sortedBy { it.name }
            ?: throw IllegalStateException("task-parser corpus is not readable at $dir")
        val fixtures = entries.map { file ->
            checkFixtureBytes(file.readBytes(), file.name)
            parseFixture(String(file.readBytes(), Charsets.UTF_8), file.name)
        }
        // A wrong path yielding "0 cases, all passed" reads exactly like a healthy suite, and Gradle
        // does not cover it: an inputs.dir that exists and is empty passes task validation.
        require(fixtures.isNotEmpty()) { "task-parser corpus at $dir contains no fixtures" }
        return fixtures
    }

    private fun fail(fileName: String, message: String): Nothing =
        throw IllegalArgumentException("$fileName: $message")

    private fun requireObject(file: String, where: String, value: JsonElement?, allowed: Set<String>): JsonObject {
        val obj = value as? JsonObject ?: fail(file, "$where must be an object")
        for (key in obj.keys) {
            if (key !in allowed) fail(file, "$where has unknown field \"$key\"")
        }
        return obj
    }

    private fun requireString(file: String, where: String, value: JsonElement?): String {
        val primitive = value as? JsonPrimitive
        if (primitive == null || !primitive.isString) fail(file, "$where must be a string")
        return primitive.content
    }

    private fun requireNonEmpty(file: String, where: String, value: JsonElement?): String {
        val s = requireString(file, where, value)
        if (s.isBlank()) fail(file, "$where must not be empty")
        return s
    }

    private fun requireCount(file: String, where: String, value: JsonElement?): Int {
        val primitive = value as? JsonPrimitive
        // isString rules out the quoted number kotlinx would otherwise accept for an Int.
        if (primitive == null || primitive.isString) fail(file, "$where must be a non-negative integer")
        val n = primitive.content.toIntOrNull()
        if (n == null || n < 0) fail(file, "$where must be a non-negative integer")
        return n
    }

    private fun requireBoolean(file: String, where: String, value: JsonElement?): Boolean {
        val primitive = value as? JsonPrimitive
        if (primitive == null || primitive.isString) fail(file, "$where must be a boolean")
        return primitive.content.toBooleanStrictOrNull() ?: fail(file, "$where must be a boolean")
    }

    private fun requireArray(file: String, where: String, value: JsonElement?): JsonArray =
        value as? JsonArray ?: fail(file, "$where must be an array")

    private fun parseExpectation(file: String, where: String, value: JsonElement?): ParsedTasks {
        val obj = requireObject(file, where, value, setOf("total", "completed", "sections"))
        for (key in listOf("total", "completed", "sections")) {
            if (key !in obj) fail(file, "$where is missing \"$key\"")
        }
        val sections = requireArray(file, "$where.sections", obj["sections"]).mapIndexed { i, section ->
            val s = requireObject(file, "$where.sections[$i]", section, setOf("title", "tasks"))
            if ("title" !in s) fail(file, "$where.sections[$i] is missing \"title\"")
            if ("tasks" !in s) fail(file, "$where.sections[$i] is missing \"tasks\"")
            val tasks = requireArray(file, "$where.sections[$i].tasks", s["tasks"]).mapIndexed { j, task ->
                val t = requireObject(file, "$where.sections[$i].tasks[$j]", task, setOf("text", "completed"))
                if ("text" !in t) fail(file, "$where.sections[$i].tasks[$j] is missing \"text\"")
                if ("completed" !in t) fail(file, "$where.sections[$i].tasks[$j] is missing \"completed\"")
                TaskItem(
                    requireString(file, "$where.sections[$i].tasks[$j].text", t["text"]),
                    requireBoolean(file, "$where.sections[$i].tasks[$j].completed", t["completed"]),
                )
            }
            TaskSection(requireString(file, "$where.sections[$i].title", s["title"]), tasks)
        }
        return ParsedTasks(
            requireCount(file, "$where.total", obj["total"]),
            requireCount(file, "$where.completed", obj["completed"]),
            sections,
        )
    }


    private const val INVALID_CORPUS_PROPERTY = "spek.taskParserInvalidCorpus"
    private val INVALID_FIELDS =
        setOf("name", "note", "fileName", "document", "stage", "expectedMessage")
    private val STAGES = setOf("bytes", "parse")

    data class InvalidCase(
        val name: String,
        val note: String,
        val fileName: String,
        val document: String,
        val stage: String,
        val expectedMessage: String,
    )

    fun configuredInvalidDir(): File {
        val configured = System.getProperty(INVALID_CORPUS_PROPERTY)
            ?: throw IllegalStateException(
                "system property $INVALID_CORPUS_PROPERTY is not set; the test task must pass the directory",
            )
        return File(configured)
    }

    fun loadInvalidCases(dir: File): List<InvalidCase> {
        val entries = dir.listFiles { file -> file.name.endsWith(".json") }?.sortedBy { it.name }
            ?: throw IllegalStateException("task-parser invalid-fixture corpus is not readable at $dir")
        val cases = entries.map { file ->
            checkFixtureBytes(file.readBytes(), file.name)
            val root = try {
                json.parseToJsonElement(String(file.readBytes(), Charsets.UTF_8))
            } catch (e: Exception) {
                throw IllegalArgumentException("${file.name}: not valid JSON: ${e.message}", e)
            }
            val obj = requireObject(file.name, "invalid case", root, INVALID_FIELDS)
            for (key in INVALID_FIELDS) {
                if (key !in obj) fail(file.name, "invalid case is missing \"$key\"")
            }
            val name = requireNonEmpty(file.name, "name", obj["name"])
            require(name == file.name.removeSuffix(".json")) {
                "${file.name}: name \"$name\" does not match the filename"
            }
            val stage = requireNonEmpty(file.name, "stage", obj["stage"])
            require(stage in STAGES) { "${file.name}: stage \"$stage\" is not one of $STAGES" }
            InvalidCase(
                name = name,
                note = requireNonEmpty(file.name, "note", obj["note"]),
                fileName = requireNonEmpty(file.name, "fileName", obj["fileName"]),
                document = requireString(file.name, "document", obj["document"]),
                stage = stage,
                expectedMessage = requireNonEmpty(file.name, "expectedMessage", obj["expectedMessage"]),
            )
        }
        require(cases.isNotEmpty()) { "task-parser invalid-fixture corpus at $dir contains no cases" }
        return cases
    }

    fun parseFixture(document: String, fileName: String): Fixture {
        val root = try {
            json.parseToJsonElement(document)
        } catch (e: Exception) {
            throw IllegalArgumentException("$fileName: not valid JSON: ${e.message}", e)
        }
        val obj = requireObject(fileName, "fixture", root, FIXTURE_FIELDS)
        for (key in listOf("name", "note", "input", "expected")) {
            if (key !in obj) fail(fileName, "fixture is missing \"$key\"")
        }

        val name = requireNonEmpty(fileName, "name", obj["name"])
        val expectedName = fileName.removeSuffix(".json")
        require(name == expectedName) {
            "$fileName: name \"$name\" does not match the filename \"$expectedName\""
        }

        val divergences = mutableMapOf<String, Divergence>()
        obj["divergences"]?.let { raw ->
            val entries = requireObject(fileName, "divergences", raw, IMPLEMENTATIONS)
            for ((impl, entry) in entries) {
                val d = requireObject(fileName, "divergences.$impl", entry, DIVERGENCE_FIELDS)
                for (key in DIVERGENCE_FIELDS) {
                    if (key !in d) fail(fileName, "divergences.$impl is missing \"$key\"")
                }
                divergences[impl] = Divergence(
                    requireNonEmpty(fileName, "divergences.$impl.reason", d["reason"]),
                    parseExpectation(fileName, "divergences.$impl.expected", d["expected"]),
                )
            }
            // At least one implementation has to assert the shared expectation. A fixture that
            // overrides every one asserts nothing in common and is two single-language tests
            // sharing a name.
            require(divergences.size < IMPLEMENTATIONS.size) {
                "$fileName: every implementation is overridden, so no shared expectation is asserted"
            }
        }

        obj["meta"]?.let { requireObject(fileName, "meta", it, (it as? JsonObject)?.keys ?: emptySet()) }

        return Fixture(
            name = name,
            note = requireNonEmpty(fileName, "note", obj["note"]),
            input = requireString(fileName, "input", obj["input"]),
            expected = parseExpectation(fileName, "expected", obj["expected"]),
            divergences = divergences,
        )
    }

    /**
     * Byte-level hygiene, stated as an allowlist. "No control characters" would reject the corpus
     * itself — pretty-printed JSON is full of U+000A and U+0009 — while still missing U+0085 and
     * U+00A0, which are not control characters at the byte level at all.
     *
     * Allowing only printable ASCII plus line feed and tab subsumes the whole denylist and needs no
     * list to keep up to date. This side has to run it too: kotlinx-serialization accepts a raw line
     * feed, carriage return or U+001C inside a string literal where JSON.parse rejects them, so
     * without this check a fixture whose escape got flattened would fail on Node and pass silently
     * here — the two loaders would disagree about which files are even valid corpus members.
     */
    fun checkFixtureBytes(bytes: ByteArray, fileName: String) {
        for (i in bytes.indices) {
            val b = bytes[i].toInt() and 0xff
            if (b == 0x0a || b == 0x09) continue
            if (b in 0x20..0x7e) continue
            val hex = b.toString(16).padStart(2, '0')
            throw IllegalArgumentException(
                "$fileName: byte $i is 0x$hex; fixtures are printable ASCII plus line feed and tab, " +
                    "with everything else written as a \\u escape",
            )
        }
    }
}
