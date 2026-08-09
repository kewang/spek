import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearSchemaCache,
  isSafeSchemaName,
  listProjectSchemas,
  listSchemasUncached,
  parseSchemaYaml,
  parseSchemasList,
  readSchemaUncached,
  resolveSchemaPath,
  shortenSchemaPath,
  setOpenspecRunner,
  type CliResult,
  type OpenspecRunner,
} from "./schemas.js";
import { schemaStageCount } from "./schema-flow.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, "../../../test-fixtures/schemas/sample-schema.yaml");

// --- name validation -------------------------------------------------------

// The rule is stated in both languages rather than inherited from either runtime's regex
// semantics. The trailing-newline row is the one that matters most: Java's `$` also matches before
// a trailing line terminator, so a Kotlin mirror anchored with `^`/`$` would accept "spec-driven\n"
// while this side rejects it. That row is the control on the spelling, not on the tests.
const NAME_CASES: Array<[name: string, safe: boolean, why: string]> = [
  ["spec-driven", true, "ordinary kebab-case name"],
  ["a", true, "single character"],
  ["schema.v2", true, "interior dot"],
  ["house_style", true, "underscore"],
  ["S1", true, "digits and uppercase"],
  ["", false, "empty"],
  [".", false, "current directory"],
  ["..", false, "parent directory"],
  ["../etc", false, "traversal"],
  ["../../etc/passwd", false, "deep traversal"],
  ["a/b", false, "forward slash"],
  ["a\\b", false, "backslash"],
  ["-leading", false, "leading dash"],
  [".leading", false, "leading dot"],
  ["trailing-", false, "trailing dash"],
  ["trailing.", false, "trailing dot"],
  ["spec driven", false, "space"],
  ["spec\0driven", false, "null byte"],
  ["spec-driven\n", false, "trailing newline (Java `$` would accept this)"],
  ["\nspec-driven", false, "leading newline"],
  ["spec-driven\r\n", false, "trailing CRLF"],
];

test("isSafeSchemaName: allowlist table", () => {
  for (const [name, safe, why] of NAME_CASES) {
    assert.equal(isSafeSchemaName(name), safe, `${JSON.stringify(name)} — ${why}`);
  }
});

test("isSafeSchemaName: rejects non-strings", () => {
  for (const value of [undefined, null, 42, {}, [], true]) {
    assert.equal(isSafeSchemaName(value), false, String(value));
  }
});

// --- schema.yaml parsing ---------------------------------------------------

// Both this suite and the Kotlin suite parse THIS file and assert the same shape.
test("parseSchemaYaml: shared fixture parses to the declared shape", () => {
  const parsed = parseSchemaYaml(fs.readFileSync(FIXTURE, "utf-8"));
  assert.ok(parsed);

  assert.equal(parsed.name, "fixture-workflow");
  assert.equal(parsed.version, 1);
  assert.equal(
    parsed.description,
    "Fixture workflow used to pin schema.yaml parsing across two languages",
  );

  // Declared order is the authoritative sequence — not alphabetical, not dependency-sorted.
  assert.deepEqual(
    parsed.artifacts.map((a) => a.id),
    ["brainstorm", "proposal", "specs", "tasks"],
  );

  const [brainstorm, proposal, specs, tasks] = parsed.artifacts;

  assert.equal(brainstorm.generates, "brainstorm.md");
  assert.equal(brainstorm.description, "Open-ended exploration before anything is committed to");
  assert.deepEqual(brainstorm.requires, []);
  // A literal block scalar keeps its newlines, blank lines, and interior indentation verbatim.
  assert.equal(
    brainstorm.instruction,
    "Explore the problem before proposing a solution.\n" +
      "\n" +
      "Cover:\n" +
      "- What the user actually asked for\n" +
      "- What they did **not** ask for\n" +
      "\n" +
      "```\n" +
      "indented code inside a block scalar\n" +
      "  stays indented\n" +
      "```\n",
  );

  // Absent fields are null, never an empty string or a substituted default.
  assert.equal(proposal.description, null);
  assert.deepEqual(proposal.requires, ["brainstorm"]);

  assert.equal(specs.generates, "specs/**/*.md");
  // A folded scalar joins onto one line and ends with a single newline.
  assert.equal(
    specs.instruction,
    "Write one spec file per capability. This folded scalar joins onto a single line.\n",
  );

  assert.equal(tasks.description, "Implementation checklist: ordered by dependency");
  assert.deepEqual(tasks.requires, ["specs", "proposal"]);

  assert.deepEqual(parsed.apply, {
    requires: ["tasks"],
    tracks: "tasks.md",
    instruction: "Work through pending tasks, marking each complete as it lands.\n",
  });

  // Pinned on the fixture so the stage rule is controlled across both languages too, not just the
  // parse: the Kotlin mirror asserts this same 5 from this same file. Four artifacts, five stages —
  // brainstorm(1) → proposal(2) → specs(3) → tasks(4) → apply(5).
  assert.equal(schemaStageCount(parsed.artifacts, parsed.apply), 5);
});

test("parseSchemaYaml: unparsable or non-mapping input returns null", () => {
  assert.equal(parseSchemaYaml("a: [unclosed"), null);
  assert.equal(parseSchemaYaml("- just\n- a\n- list\n"), null);
  assert.equal(parseSchemaYaml(""), null);
});

test("parseSchemaYaml: artifacts without an id are dropped, order otherwise preserved", () => {
  const parsed = parseSchemaYaml(
    ["artifacts:", "  - id: one", "  - generates: nameless.md", "  - id: two"].join("\n"),
  );
  assert.ok(parsed);
  assert.deepEqual(
    parsed.artifacts.map((a) => a.id),
    ["one", "two"],
  );
});

test("parseSchemaYaml: missing artifacts and apply are empty/null, not invented", () => {
  const parsed = parseSchemaYaml("name: bare\n");
  assert.ok(parsed);
  assert.deepEqual(parsed.artifacts, []);
  assert.equal(parsed.apply, null);
  assert.equal(parsed.version, null);
});

// --- CLI enumeration parsing ----------------------------------------------

// The enumeration cannot know a stage count — `openspec schemas --json` carries no `requires` — so
// every entry it produces starts null and is filled in later, from each schema's definition. The
// entry's `artifacts` array is therefore read for nothing and deliberately not counted: a summary
// reports stages only.
test("parseSchemasList: maps CLI entries", () => {
  const list = parseSchemasList([
    { name: "spec-driven", description: "Default", artifacts: ["a", "b"], source: "package" },
    { name: "house-style", description: null, artifacts: [], source: "project" },
  ]);
  assert.deepEqual(list, [
    {
      name: "spec-driven",
      description: "Default",
      source: "package",
      stageCount: null,
      isDefault: false,
    },
    {
      name: "house-style",
      description: null,
      source: "project",
      stageCount: null,
      isDefault: false,
    },
  ]);
});

test("parseSchemasList: unexpected shapes degrade rather than throw", () => {
  assert.equal(parseSchemasList({ not: "an array" }), null);
  assert.equal(parseSchemasList(null), null);
  // Entries missing a name or a recognised source are skipped, not guessed at.
  assert.deepEqual(parseSchemasList([{ description: "no name", source: "package" }]), []);
  assert.deepEqual(parseSchemasList([{ name: "x", source: "elsewhere" }]), []);
  assert.deepEqual(parseSchemasList([{ name: "x", source: "package" }]), [
    {
      name: "x",
      description: null,
      source: "package",
      stageCount: null,
      isDefault: false,
    },
  ]);
});

// --- enumeration against a stubbed CLI ------------------------------------

function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spek-schemas-"));
  fs.mkdirSync(path.join(dir, "openspec"), { recursive: true });
  return dir;
}

function writeConfig(repo: string, schema: string): void {
  fs.writeFileSync(path.join(repo, "openspec", "config.yaml"), `schema: ${schema}\n`);
}

function writeProjectSchema(repo: string, name: string, body?: string): void {
  const dir = path.join(repo, "openspec", "schemas", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "schema.yaml"),
    body ?? `name: ${name}\ndescription: Local ${name}\nartifacts:\n  - id: only\n`,
  );
}

/** Stub runner: answers keyed by the first two args, so `schemas` and `schema which` can differ. */
function stubRunner(answers: Record<string, CliResult>): OpenspecRunner {
  return async (args) => answers[args.slice(0, 2).join(" ")] ?? { ok: false, reason: "cli-failed" };
}

let restore: OpenspecRunner | null = null;
function useRunner(r: OpenspecRunner): void {
  const prev = setOpenspecRunner(r);
  if (restore === null) restore = prev;
  clearSchemaCache();
}

test.afterEach(() => {
  if (restore) setOpenspecRunner(restore);
  restore = null;
  clearSchemaCache();
});

test("listSchemas: CLI enumeration, default schema first then A–Z", async () => {
  const repo = tempRepo();
  writeConfig(repo, "spec-driven");
  useRunner(
    stubRunner({
      "schemas --json": {
        ok: true,
        json: [
          { name: "zebra", description: "Z", artifacts: ["a"], source: "package" },
          { name: "spec-driven", description: "Default", artifacts: ["a", "b"], source: "package" },
          { name: "alpha", description: "A", artifacts: [], source: "project" },
        ],
      },
    }),
  );

  const catalog = await listSchemasUncached(repo);
  assert.equal(catalog.defaultSchema, "spec-driven");
  assert.equal(catalog.degradedReason, null);
  assert.deepEqual(
    catalog.schemas.map((s) => s.name),
    ["spec-driven", "alpha", "zebra"],
  );
  assert.equal(catalog.schemas[0].isDefault, true);
  assert.equal(catalog.schemas[1].isDefault, false);
});

test("listSchemas: no default schema declared → ordered by name alone", async () => {
  const repo = tempRepo();
  useRunner(
    stubRunner({
      "schemas --json": {
        ok: true,
        json: [
          { name: "zebra", artifacts: [], source: "package" },
          { name: "alpha", artifacts: [], source: "package" },
        ],
      },
    }),
  );

  const catalog = await listSchemasUncached(repo);
  assert.equal(catalog.defaultSchema, null);
  assert.deepEqual(
    catalog.schemas.map((s) => s.name),
    ["alpha", "zebra"],
  );
  assert.ok(catalog.schemas.every((s) => !s.isDefault));
});

test("listSchemas: CLI already dedupes shadowing — one entry, sourced project", async () => {
  const repo = tempRepo();
  writeProjectSchema(repo, "spec-driven");
  useRunner(
    stubRunner({
      "schemas --json": {
        ok: true,
        json: [{ name: "spec-driven", artifacts: ["a"], source: "project" }],
      },
    }),
  );

  const catalog = await listSchemasUncached(repo);
  assert.equal(catalog.schemas.length, 1);
  assert.equal(catalog.schemas[0].source, "project");
});

for (const reason of ["cli-unavailable", "cli-failed", "cli-timeout"] as const) {
  test(`listSchemas: ${reason} still lists project schemas, with the reason`, async () => {
    const repo = tempRepo();
    writeConfig(repo, "house-style");
    writeProjectSchema(repo, "house-style");
    useRunner(stubRunner({ "schemas --json": { ok: false, reason } }));

    const catalog = await listSchemasUncached(repo);
    assert.equal(catalog.degradedReason, reason);
    assert.deepEqual(
      catalog.schemas.map((s) => s.name),
      ["house-style"],
    );
    assert.equal(catalog.schemas[0].source, "project");
    assert.equal(catalog.schemas[0].isDefault, true);
    // Read straight off disk, so the stage count survives the CLI being unusable.
    assert.equal(catalog.schemas[0].stageCount, 1);
  });
}

test("listSchemas: unparsable CLI output degrades rather than throwing", async () => {
  const repo = tempRepo();
  useRunner(stubRunner({ "schemas --json": { ok: true, json: { not: "an array" } } }));

  const catalog = await listSchemasUncached(repo);
  assert.equal(catalog.degradedReason, "cli-unparsable");
  assert.deepEqual(catalog.schemas, []);
});

test("listSchemas: CLI unavailable and no project schemas → empty, not an error", async () => {
  const repo = tempRepo();
  useRunner(stubRunner({ "schemas --json": { ok: false, reason: "cli-unavailable" } }));

  const catalog = await listSchemasUncached(repo);
  assert.deepEqual(catalog.schemas, []);
  assert.equal(catalog.degradedReason, "cli-unavailable");
});

test("listSchemas: default schema that resolves to nothing is still reported", async () => {
  const repo = tempRepo();
  writeConfig(repo, "retired-workflow");
  useRunner(stubRunner({ "schemas --json": { ok: true, json: [] } }));

  const catalog = await listSchemasUncached(repo);
  assert.equal(catalog.defaultSchema, "retired-workflow");
  assert.deepEqual(catalog.schemas, []);
});

test("listProjectSchemas: reads from disk with no CLI at all", () => {
  const repo = tempRepo();
  writeProjectSchema(repo, "house-style");
  writeProjectSchema(repo, "other");
  // A directory with no schema.yaml is not a schema.
  fs.mkdirSync(path.join(repo, "openspec", "schemas", "not-a-schema"), { recursive: true });

  const found = listProjectSchemas(repo).map((s) => s.name).sort();
  assert.deepEqual(found, ["house-style", "other"]);
});

test("listProjectSchemas: missing schemas directory is empty, not an error", () => {
  assert.deepEqual(listProjectSchemas(tempRepo()), []);
});

// --- definition reads ------------------------------------------------------

test("readSchema: reads the definition at the CLI-resolved path, with shadows", async () => {
  const repo = tempRepo();
  writeConfig(repo, "fixture-workflow");

  // The fixture is named sample-schema.yaml, so stage it as a real schema directory whose file is
  // named schema.yaml — the reader resolves a directory, not a file.
  const dir = path.join(repo, "openspec", "schemas", "fixture-workflow");
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(FIXTURE, path.join(dir, "schema.yaml"));
  useRunner(
    stubRunner({
      "schema which": {
        ok: true,
        json: {
          name: "fixture-workflow",
          source: "project",
          path: dir,
          shadows: [{ source: "package", path: "/elsewhere/fixture-workflow" }],
        },
      },
    }),
  );

  const result = await readSchemaUncached(repo, "fixture-workflow");
  assert.ok(result.ok);
  assert.equal(result.schema.name, "fixture-workflow");
  assert.equal(result.schema.source, "project");
  assert.equal(result.schema.isDefault, true);
  assert.deepEqual(result.schema.shadows, [
    { source: "package", path: "/elsewhere/fixture-workflow" },
  ]);
  assert.deepEqual(
    result.schema.artifacts.map((a) => a.id),
    ["brainstorm", "proposal", "specs", "tasks"],
  );
  assert.equal(result.schema.apply?.tracks, "tasks.md");
});

test("readSchema: unsafe name is rejected before any spawn or read", async () => {
  const repo = tempRepo();
  let spawned = 0;
  useRunner(async () => {
    spawned += 1;
    return { ok: true, json: {} };
  });

  for (const bad of ["../../etc", "..", "a/b", "spec-driven\n", ""]) {
    const result = await readSchemaUncached(repo, bad);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "not-found");
  }
  assert.equal(spawned, 0, "no process may be spawned for a rejected name");
});

test("readSchema: a CLI that could not be asked reports its reason, not not-found", async () => {
  const repo = tempRepo();
  useRunner(stubRunner({ "schema which": { ok: false, reason: "cli-failed" } }));

  const result = await readSchemaUncached(repo, "no-such-schema");
  // Nothing on disk either, and the CLI said nothing → the CLI reason wins over "not-found",
  // because "we could not look" is a different problem from "it does not exist".
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "cli-failed");
});

// The real CLI exits **non-zero** for an unknown name while printing a perfectly good
// `{"error": "Schema 'x' not found"}`. Trusting the exit code alone told the reader "the OpenSpec
// CLI reported an error" — indistinguishable from broken tooling — for the most ordinary case there
// is: a typo, or a badge naming a schema this machine does not have.
test("readSchema: a non-zero exit that still answers in JSON is not-found, not a CLI failure", async () => {
  const repo = tempRepo();
  useRunner(
    stubRunner({
      "schema which": {
        ok: false,
        reason: "cli-failed",
        json: { error: "Schema 'no-such-schema' not found", available: ["spec-driven"] },
      },
    }),
  );

  const result = await readSchemaUncached(repo, "no-such-schema");
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "not-found");
});

test("readSchema: CLI unavailable still resolves a project-local schema from disk", async () => {
  const repo = tempRepo();
  writeProjectSchema(repo, "house-style");
  useRunner(stubRunner({ "schema which": { ok: false, reason: "cli-unavailable" } }));

  const result = await readSchemaUncached(repo, "house-style");
  assert.ok(result.ok);
  assert.equal(result.schema.source, "project");
  assert.deepEqual(result.schema.shadows, [], "shadowing is unknown without the CLI");
  assert.deepEqual(
    result.schema.artifacts.map((a) => a.id),
    ["only"],
  );
});

test("readSchema: package schema unreachable without the CLI is distinguished from not-found", async () => {
  const repo = tempRepo();
  useRunner(stubRunner({ "schema which": { ok: false, reason: "cli-unavailable" } }));

  const result = await readSchemaUncached(repo, "spec-driven");
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "cli-unavailable");
});

test("resolveSchemaPath: prefers the CLI answer over the local directory", async () => {
  const repo = tempRepo();
  writeProjectSchema(repo, "house-style");
  useRunner(
    stubRunner({
      "schema which": {
        ok: true,
        json: { name: "house-style", source: "package", path: "/pkg/house-style", shadows: [] },
      },
    }),
  );

  const resolved = await resolveSchemaPath(repo, "house-style");
  assert.ok(resolved.ok);
  assert.equal(resolved.dir, "/pkg/house-style");
  assert.equal(resolved.source, "package");
});

// The resolver searches project → user → package. A `user` schema lives in OpenSpec's global data
// directory; dropping it because the source string was unrecognised would hide a schema that is
// genuinely available, with no error to explain the absence.
test("parseSchemasList: keeps user-level schemas alongside project and package", () => {
  const list = parseSchemasList([
    { name: "a", artifacts: [], source: "project" },
    { name: "b", artifacts: [], source: "user" },
    { name: "c", artifacts: [], source: "package" },
  ]);
  assert.deepEqual(list?.map((s) => [s.name, s.source]), [
    ["a", "project"],
    ["b", "user"],
    ["c", "package"],
  ]);
});

test("parseSchemasList: an unknown source is still dropped, deliberately", () => {
  // Only the resolver's three sources are trusted; anything else means the CLI changed shape and
  // guessing at it would be worse than reporting a degraded enumeration.
  assert.deepEqual(parseSchemasList([{ name: "x", artifacts: [], source: "elsewhere" }]), []);
});

// --- path display ----------------------------------------------------------

// An absolute path is the wrong unit for every source: a project schema's location is relative to
// the repo, a user schema's prefix is the reader's own home directory, and a package schema's is
// wherever npm happened to install the CLI.
test("shortenSchemaPath: a project schema reads relative to the repo", () => {
  assert.equal(
    shortenSchemaPath(path.join("/repo", "openspec", "schemas", "house-style"), {
      repoRoot: "/repo",
      homedir: "/home/u",
    }),
    path.join("openspec", "schemas", "house-style"),
  );
});

test("shortenSchemaPath: a user schema reads from ~", () => {
  const abs = path.join("/home/u", ".local", "share", "openspec", "schemas", "machine-flow");
  assert.equal(
    shortenSchemaPath(abs, { repoRoot: "/repo", homedir: "/home/u" }),
    `~${path.sep}${path.join(".local", "share", "openspec", "schemas", "machine-flow")}`,
  );
});

test("shortenSchemaPath: a package schema drops the npm install prefix", () => {
  const abs = path.join(
    "/home/u/.local/opt/node/lib",
    "node_modules",
    "@fission-ai",
    "openspec",
    "schemas",
    "spec-driven",
  );
  assert.equal(
    shortenSchemaPath(abs, { repoRoot: "/repo", homedir: "/home/u" }),
    path.join("@fission-ai", "openspec", "schemas", "spec-driven"),
  );
});

test("shortenSchemaPath: anything else stays absolute rather than being guessed at", () => {
  const abs = path.join("/somewhere", "else", "schemas", "x");
  assert.equal(shortenSchemaPath(abs, { repoRoot: "/repo", homedir: "/home/u" }), abs);
});
