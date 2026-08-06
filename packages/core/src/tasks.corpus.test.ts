import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTasks, type ParsedTasks } from "./tasks.js";

// The shared corpus both implementations of the task parser read. Loader and assertions live in this
// one `*.test.ts` file on purpose: core's build config excludes exactly `src/**/*.test.ts` and
// publishes `dist`, so a loader in its own module would be compiled and shipped to every registry
// consumer of @spekjs/core. See openspec/specs/task-parser-fixture-corpus.
//
// TaskParserCorpusTest.kt reads the same directory. The two loaders are specified by behavior, not by
// being the same code — kotlinx-serialization rejects unknown keys and type mismatches for free, and
// everything it does for free is written out by hand here.

const IMPLEMENTATIONS = ["typescript", "kotlin"] as const;
const SELF = "typescript";

const FIXTURE_FIELDS = ["name", "note", "input", "expected", "divergences", "meta"];
const DIVERGENCE_FIELDS = ["reason", "expected"];

interface Divergence {
  reason: string;
  expected: ParsedTasks;
}

interface Fixture {
  name: string;
  note: string;
  input: string;
  expected: ParsedTasks;
  divergences: Record<string, Divergence>;
  file: string;
}

// Resolved from this module's own URL, never from the working directory: `npm test -w @spekjs/core`
// runs with CWD at the package while the Gradle suite runs at its own project, and either can be
// invoked from the repo root. The env override exists so the generator's scratch directory can be
// substituted without touching either loader.
const CORPUS_DIR =
  process.env.SPEK_TASK_CORPUS_DIR ??
  fileURLToPath(new URL("../../../test-fixtures/task-parser/", import.meta.url));

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireFields(file: string, where: string, value: unknown, allowed: string[]): Record<string, unknown> {
  if (!isPlainObject(value)) fail(file, `${where} must be an object`);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(file, `${where} has unknown field "${key}"`);
  }
  return value;
}

function requireString(file: string, where: string, value: unknown): string {
  if (typeof value !== "string") fail(file, `${where} must be a string`);
  return value;
}

function requireNonEmpty(file: string, where: string, value: unknown): string {
  const s = requireString(file, where, value);
  if (s.trim() === "") fail(file, `${where} must not be empty`);
  return s;
}

function requireCount(file: string, where: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(file, `${where} must be a non-negative integer`);
  }
  return value;
}

function requireArray(file: string, where: string, value: unknown): unknown[] {
  if (!Array.isArray(value)) fail(file, `${where} must be an array`);
  return value;
}

function parseExpectation(file: string, where: string, value: unknown): ParsedTasks {
  const raw = requireFields(file, where, value, ["total", "completed", "sections"]);
  for (const key of ["total", "completed", "sections"]) {
    if (!(key in raw)) fail(file, `${where} is missing "${key}"`);
  }
  const sections = requireArray(file, `${where}.sections`, raw.sections).map((section, i) => {
    const s = requireFields(file, `${where}.sections[${i}]`, section, ["title", "tasks"]);
    if (!("title" in s)) fail(file, `${where}.sections[${i}] is missing "title"`);
    if (!("tasks" in s)) fail(file, `${where}.sections[${i}] is missing "tasks"`);
    const tasks = requireArray(file, `${where}.sections[${i}].tasks`, s.tasks).map((task, j) => {
      const t = requireFields(file, `${where}.sections[${i}].tasks[${j}]`, task, ["text", "completed"]);
      if (!("text" in t)) fail(file, `${where}.sections[${i}].tasks[${j}] is missing "text"`);
      if (typeof t.completed !== "boolean") {
        fail(file, `${where}.sections[${i}].tasks[${j}].completed must be a boolean`);
      }
      return {
        text: requireString(file, `${where}.sections[${i}].tasks[${j}].text`, t.text),
        completed: t.completed,
      };
    });
    return { title: requireString(file, `${where}.sections[${i}].title`, s.title), tasks };
  });
  return {
    total: requireCount(file, `${where}.total`, raw.total),
    completed: requireCount(file, `${where}.completed`, raw.completed),
    sections,
  };
}

// Exported shape of the validation so the rejection paths can be unit-tested below without
// committing a malformed file — a malformed fixture on disk would fail the whole suite forever.
export function validateFixture(raw: unknown, file: string): Fixture {
  const obj = requireFields(file, "fixture", raw, FIXTURE_FIELDS);
  for (const key of ["name", "note", "input", "expected"]) {
    if (!(key in obj)) fail(file, `fixture is missing "${key}"`);
  }

  const name = requireNonEmpty(file, "name", obj.name);
  const expectedName = basename(file).replace(/\.json$/, "");
  if (name !== expectedName) {
    fail(file, `name "${name}" does not match the filename "${expectedName}"`);
  }

  const divergences: Record<string, Divergence> = {};
  if ("divergences" in obj) {
    const raw$ = requireFields(file, "divergences", obj.divergences, [...IMPLEMENTATIONS]);
    for (const [impl, entry] of Object.entries(raw$)) {
      const d = requireFields(file, `divergences.${impl}`, entry, DIVERGENCE_FIELDS);
      for (const key of DIVERGENCE_FIELDS) {
        if (!(key in d)) fail(file, `divergences.${impl} is missing "${key}"`);
      }
      divergences[impl] = {
        reason: requireNonEmpty(file, `divergences.${impl}.reason`, d.reason),
        expected: parseExpectation(file, `divergences.${impl}.expected`, d.expected),
      };
    }
    // At least one implementation has to assert the shared expectation. A fixture that overrides
    // every one of them asserts nothing in common and is two single-language tests sharing a name.
    if (Object.keys(divergences).length >= IMPLEMENTATIONS.length) {
      fail(file, "every implementation is overridden, so no shared expectation is asserted");
    }
  }

  // Free-form provenance, so no field list to check against — but it still has to be an object, and
  // the failure still has to name the file the way every other one does. Reaching for Object.keys to
  // build an allow-everything list threw a bare TypeError on `"meta": null` instead.
  if ("meta" in obj && !isPlainObject(obj.meta)) fail(file, "meta must be an object");

  return {
    name,
    note: requireNonEmpty(file, "note", obj.note),
    input: requireString(file, "input", obj.input),
    expected: parseExpectation(file, "expected", obj.expected),
    divergences,
    file,
  };
}

// Byte-level hygiene, stated as an allowlist. "No control characters" would reject the corpus itself
// — pretty-printed JSON is full of U+000A and U+0009 — while still missing U+0085 and U+00A0, which
// are not control characters at the byte level at all (they are C2 85 and C2 A0 in UTF-8, and
// JSON.parse accepts both raw).
//
// Allowing only printable ASCII plus LF and TAB subsumes the whole denylist the spec names — CR,
// U+0085, U+2028, U+2029, U+00A0, U+FEFF and every other C0/C1 character are either control bytes or
// non-ASCII — and needs no list to keep up to date. Anything else a case needs is written as a \u
// escape, which is the point of the format.
//
// This is not optional tidiness. The two JSON parsers disagree about such files: a raw LF, CR or
// U+001C inside a string literal is rejected by JSON.parse and accepted by kotlinx-serialization, so
// a fixture whose escape got flattened fails hard here and passes silently on the Kotlin side.
export function checkFixtureBytes(bytes: Uint8Array, file: string): void {
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x0a || b === 0x09) continue;
    if (b >= 0x20 && b <= 0x7e) continue;
    fail(
      file,
      `byte ${i} is 0x${b.toString(16).padStart(2, "0")}; fixtures are printable ASCII plus line ` +
        `feed and tab, with everything else written as a \\u escape`,
    );
  }
}

// Document in, fixture out — the same entry point the Kotlin loader exposes, so the shared
// invalid-fixture corpus can drive both through one call.
export function parseFixture(document: string, file: string): Fixture {
  let raw: unknown;
  try {
    raw = JSON.parse(document);
  } catch (err) {
    fail(file, `not valid JSON: ${String(err)}`);
  }
  return validateFixture(raw, file);
}

function jsonFilesIn(dir: string, what: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch (err) {
    throw new Error(`${what} is not readable at ${dir}: ${String(err)}`);
  }
}

function loadCorpus(dir: string): Fixture[] {
  const fixtures = jsonFilesIn(dir, "task-parser corpus").map((entry) => {
    const file = join(dir, entry);
    checkFixtureBytes(readFileSync(file), file);
    return parseFixture(readFileSync(file, "utf8"), file);
  });
  // A wrong path yielding "0 cases, all passed" reads exactly like a healthy suite. Gradle does not
  // cover this either: an inputs.dir that exists and is empty passes task validation.
  if (fixtures.length === 0) {
    throw new Error(`task-parser corpus at ${dir} contains no fixtures`);
  }
  return fixtures;
}

const corpus = loadCorpus(CORPUS_DIR);

for (const fixture of corpus) {
  test(`corpus: ${fixture.name}`, () => {
    const expected = fixture.divergences[SELF]?.expected ?? fixture.expected;
    assert.deepEqual(parseTasks(fixture.input), expected, fixture.note);
  });
}

// --- the loader's own rules -------------------------------------------------------------------
//
// Driven by test-fixtures/task-parser/invalid/, which the Kotlin loader reads too. These rules were
// two hand-written suites mirroring each other until verification found what that always misses: a
// `"meta": null` that Kotlin rejected properly and this side threw a bare TypeError on, with no
// filename. That is the mechanism this whole change exists to remove, reappearing one level down.
// Now each rejection — and the wording of each message — is asserted in both languages from one file.
//
// Positive cases need no tests here: every fixture in the corpus above is a pretty-printed document
// that loaded successfully, and one of them carries a single-implementation divergence.
//
// Resolved from this module rather than from CORPUS_DIR: a generated scratch corpus replaces the
// parser's inputs, never the loader's own rules.

const INVALID_DIR = fileURLToPath(
  new URL("../../../test-fixtures/task-parser/invalid/", import.meta.url),
);

const INVALID_FIELDS = ["name", "note", "fileName", "document", "stage", "expectedMessage"];
const STAGES = ["bytes", "parse"];

interface InvalidCase {
  name: string;
  note: string;
  fileName: string;
  document: string;
  stage: string;
  expectedMessage: string;
}

function loadInvalidCases(dir: string): InvalidCase[] {
  const cases = jsonFilesIn(dir, "task-parser invalid-fixture corpus").map((entry) => {
    const file = join(dir, entry);
    checkFixtureBytes(readFileSync(file), file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (err) {
      throw new Error(`${file}: not valid JSON: ${String(err)}`);
    }
    const obj = requireFields(file, "invalid case", raw, INVALID_FIELDS);
    for (const key of INVALID_FIELDS) {
      if (!(key in obj)) fail(file, `invalid case is missing "${key}"`);
    }
    const name = requireNonEmpty(file, "name", obj.name);
    if (name !== basename(file).replace(/\.json$/, "")) {
      fail(file, `name "${name}" does not match the filename`);
    }
    const stage = requireNonEmpty(file, "stage", obj.stage);
    if (!STAGES.includes(stage)) fail(file, `stage "${stage}" is not one of ${STAGES.join(", ")}`);
    return {
      name,
      note: requireNonEmpty(file, "note", obj.note),
      fileName: requireNonEmpty(file, "fileName", obj.fileName),
      document: requireString(file, "document", obj.document),
      stage,
      expectedMessage: requireNonEmpty(file, "expectedMessage", obj.expectedMessage),
    };
  });
  if (cases.length === 0) {
    throw new Error(`task-parser invalid-fixture corpus at ${dir} contains no cases`);
  }
  return cases;
}

for (const invalid of loadInvalidCases(INVALID_DIR)) {
  test(`loader rejects: ${invalid.name}`, () => {
    assert.throws(
      () => {
        if (invalid.stage === "bytes") {
          checkFixtureBytes(Buffer.from(invalid.document, "utf8"), invalid.fileName);
        } else {
          parseFixture(invalid.document, invalid.fileName);
        }
      },
      (err: unknown) => {
        assert.ok(err instanceof Error, `${invalid.name}: expected an Error, got ${String(err)}`);
        // Naming the file is part of the contract, not a nicety: a rejection nobody can locate is
        // barely better than none.
        assert.ok(
          err.message.includes(invalid.fileName),
          `${invalid.name}: message must name the file, got: ${err.message}`,
        );
        assert.ok(
          err.message.includes(invalid.expectedMessage),
          `${invalid.name}: message must contain "${invalid.expectedMessage}", got: ${err.message}`,
        );
        return true;
      },
      invalid.note,
    );
  });
}
