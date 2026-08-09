import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { readRepoSchema } from "./scanner.js";
import { schemaStageCount } from "./schema-flow.js";
import {
  cliErrorMessage,
  runOpenspec,
  setOpenspecRunner,
  ttlCached,
  type CacheEntry,
  type CliResult,
  type OpenspecRunner,
} from "./openspec-cli.js";
import type {
  SchemaApplyDef,
  SchemaArtifactDef,
  SchemaCatalog,
  SchemaDegradedReason,
  SchemaShadow,
  SchemaSource,
  SchemaSummary,
  SchemasResponse,
  SchemaReadResult,
} from "./types.js";

/**
 * Schema catalog: which workflow schemas a repo can use, and what each one declares.
 *
 * The read is split. The `openspec` CLI answers *which schemas exist and where they live* — package
 * schemas sit under the global npm prefix and cannot be found from the repo alone, and the CLI
 * already resolves project-over-package shadowing. Everything a schema *contains* (artifact
 * descriptions, `requires`, and the instruction text that is the point of this feature) is read
 * straight from its `schema.yaml`, because no CLI command exposes it without a change to hang it on.
 *
 * Nothing here runs on the scan hot path. It is reached only when schema information is requested.
 */

/** The schemas directory a repo may keep its own schemas in. */
function projectSchemasDir(repoRoot: string): string {
  return path.join(repoRoot, "openspec", "schemas");
}

/**
 * A schema name arrives from the client and is used both as a CLI argument and as a path segment
 * under `openspec/schemas/`. Validate it against an explicit allowlist before it reaches either:
 * no separators, no `.`/`..`, no null byte, no leading or trailing punctuation.
 *
 * The rule is stated, not inherited. The Kotlin mirror must anchor with `\A`/`\z` rather than
 * `^`/`$`, because Java's `$` also matches before a trailing line terminator (and its terminator
 * set is wider than JavaScript's), which would let `"spec-driven\n"` through on that side only.
 * JavaScript's `$` without the `m` flag matches at end of input only, so this pattern already
 * rejects it here.
 */
const SAFE_SCHEMA_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export function isSafeSchemaName(name: unknown): name is string {
  return typeof name === "string" && SAFE_SCHEMA_NAME_RE.test(name);
}

/** The repo's default schema — openspec/config.yaml's `schema:`, read from disk with no CLI call. */
export function readDefaultSchema(repoRoot: string): string | null {
  return readRepoSchema(repoRoot);
}

// ---------------------------------------------------------------------------
// schema.yaml parsing
// ---------------------------------------------------------------------------

/** Read a scalar as a string, or null when absent/not scalar. Never substitutes a default. */
function str(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/** Read a list of strings, dropping non-strings. Absent → empty list. */
function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toArtifact(raw: unknown): SchemaArtifactDef | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  if (!id) return null; // an artifact with no id cannot be ordered or referenced
  return {
    id,
    generates: str(o.generates),
    description: str(o.description),
    requires: strList(o.requires),
    instruction: str(o.instruction),
  };
}

function toApply(raw: unknown): SchemaApplyDef | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    requires: strList(o.requires),
    tracks: str(o.tracks),
    instruction: str(o.instruction),
  };
}

/**
 * Parse a schema.yaml document into its declared shape. Artifact order is the order declared in
 * the file — that is the schema's authoritative sequence. Absent fields stay null (or an empty
 * list), never a substituted default: the view must not present invented guidance as authored.
 * Returns null when the document is not a mapping.
 */
export function parseSchemaYaml(text: string): {
  name: string | null;
  version: number | null;
  description: string | null;
  artifacts: SchemaArtifactDef[];
  apply: SchemaApplyDef | null;
} | null {
  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
  const o = doc as Record<string, unknown>;
  const rawArtifacts = Array.isArray(o.artifacts) ? o.artifacts : [];
  return {
    name: str(o.name),
    version: typeof o.version === "number" ? o.version : null,
    description: str(o.description),
    artifacts: rawArtifacts.map(toArtifact).filter((a): a is SchemaArtifactDef => a !== null),
    apply: toApply(o.apply),
  };
}

// The CLI runner, its failure taxonomy and the injectable seam live in openspec-cli.ts, shared with
// schema-order.ts. Re-exported here because this module's tests and consumers are where they are
// used from.
export type { CliResult, OpenspecRunner };
export { setOpenspecRunner };

// ---------------------------------------------------------------------------
// Enumeration
// ---------------------------------------------------------------------------

function toSource(value: unknown): SchemaSource | null {
  return value === "package" || value === "user" || value === "project" ? value : null;
}

/**
 * Map `openspec schemas --json` output. An unexpected shape is a degradation, not a throw — the
 * schema commands are marked experimental by the CLI itself and may change.
 */
export function parseSchemasList(json: unknown): SchemaSummary[] | null {
  if (!Array.isArray(json)) return null;
  const out: SchemaSummary[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const name = str(o.name);
    const source = toSource(o.source);
    if (!name || !source) continue;
    out.push({
      name,
      description: str(o.description),
      source,
      stageCount: null, // filled in by whoever reads the definitions; the enumeration lacks `requires`
      isDefault: false,
    });
  }
  return out;
}

/**
 * Project-local schemas read straight from disk. This is what keeps the page useful when the CLI
 * is unavailable, and it is the only source that needs no subprocess at all.
 *
 * The directory name — not schema.yaml's `name` — is authoritative, because the directory name is
 * what the name resolves back to on the filesystem.
 */
export function listProjectSchemas(repoRoot: string): SchemaSummary[] {
  const dir = projectSchemasDir(repoRoot);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: SchemaSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeSchemaName(entry.name)) continue;
    const file = path.join(dir, entry.name, "schema.yaml");
    let parsed: ReturnType<typeof parseSchemaYaml> = null;
    try {
      parsed = parseSchemaYaml(fs.readFileSync(file, "utf-8"));
    } catch {
      continue; // no readable schema.yaml → not a schema directory
    }
    if (!parsed) continue;
    out.push({
      name: entry.name,
      description: parsed.description,
      source: "project",
      stageCount: schemaStageCount(parsed.artifacts, parsed.apply),
      isDefault: false,
    });
  }
  return out;
}

/**
 * Order: the repo's default schema first, then the rest by name. Codepoint comparison rather than
 * localeCompare, so the order does not shift with the server's locale.
 */
function byDefaultThenName(a: SchemaSummary, b: SchemaSummary): number {
  if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
  if (a.name === b.name) return 0;
  return a.name < b.name ? -1 : 1;
}

/**
 * Enumerate the schemas available to a repo.
 *
 * The CLI already deduplicates project-over-package shadowing, so its list is taken as given and the
 * disk scan only fills in schemas it did not report — which, when the CLI is unavailable, is all of
 * them.
 */
export async function listSchemasUncached(repoRoot: string): Promise<SchemaCatalog> {
  const defaultSchema = readDefaultSchema(repoRoot);
  const cli = await runOpenspec(["schemas", "--json"], repoRoot);

  let schemas: SchemaSummary[] = [];
  let degradedReason: SchemaDegradedReason | null = null;

  if (cli.ok) {
    const parsed = parseSchemasList(cli.json);
    if (parsed) schemas = parsed;
    else degradedReason = "cli-unparsable";
  } else {
    degradedReason = cli.reason;
  }

  // Project-local schemas the CLI did not report. On a complete enumeration this adds nothing; on a
  // degraded one it is the whole list.
  const seen = new Set(schemas.map((s) => s.name));
  for (const local of listProjectSchemas(repoRoot)) {
    if (!seen.has(local.name)) schemas.push(local);
  }

  for (const s of schemas) s.isDefault = s.name === defaultSchema;
  schemas.sort(byDefaultThenName);

  // Stage counts need each schema's `requires` graph, and `openspec schemas --json` does not carry
  // it — only the definition does. Filled in here rather than by each host, so every surface reports
  // the same number from the same rule.
  //
  // Project schemas were already counted from the schema.yaml read on disk, so this only pays for
  // the ones the CLI reported. Those reads are cached per (repo, name) and run concurrently, and
  // they are the same reads the detail page is about to want. A schema whose definition cannot be
  // read keeps a null count, and its row simply omits the number rather than guessing one.
  await Promise.all(
    schemas.map(async (s) => {
      if (s.stageCount !== null) return;
      const read = await readSchema(repoRoot, s.name);
      if (read.ok) s.stageCount = schemaStageCount(read.schema.artifacts, read.schema.apply);
    }),
  );

  return { defaultSchema, schemas, degradedReason };
}

/**
 * The schema's location, expressed in the frame its source actually means.
 *
 * An absolute path is the wrong unit for all three sources. A project schema lives at a path
 * relative to the repo you are looking at; a user schema lives under your home directory, and the
 * machine-specific prefix is noise; a package schema's path is mostly the accident of where npm
 * installed the CLI. Showing the raw string makes the reader do the subtraction every time.
 *
 * Done here rather than in the view because only the server knows the repo root and the home
 * directory. The absolute path is still carried on the definition, for a tooltip and for anyone
 * who needs to actually go there.
 */
export function shortenSchemaPath(
  absolutePath: string,
  opts: { repoRoot: string; homedir?: string },
): string {
  const home = opts.homedir ?? os.homedir();

  // Package: everything up to the last node_modules/ is where npm happened to put the CLI.
  const marker = `${path.sep}node_modules${path.sep}`;
  const lastModules = absolutePath.lastIndexOf(marker);
  if (lastModules !== -1) return absolutePath.slice(lastModules + marker.length);

  // Project: relative to the repo the reader is looking at.
  const fromRepo = path.relative(opts.repoRoot, absolutePath);
  if (fromRepo && !fromRepo.startsWith("..") && !path.isAbsolute(fromRepo)) return fromRepo;

  // User: under the home directory, which every platform writes as ~ in prose.
  const fromHome = path.relative(home, absolutePath);
  if (fromHome && !fromHome.startsWith("..") && !path.isAbsolute(fromHome)) {
    return `~${path.sep}${fromHome}`;
  }

  return absolutePath;
}

// ---------------------------------------------------------------------------
// Change usage
// ---------------------------------------------------------------------------

/**
 * Group already-scanned changes onto the schemas they declare.
 *
 * Pure: it takes the change list rather than fetching one, so reading schemas never implies
 * scanning changes. Each host's route does the scan it already does and calls this, instead of
 * three copies of the same grouping.
 *
 * Changes declaring a schema that matched nothing are not dropped — they come back under
 * `unresolved` so the counts reconcile against the Changes page.
 */
export function groupSchemaUsage(
  catalog: SchemaCatalog,
  changes: ReadonlyArray<{ slug: string; schema?: string | null }>,
): SchemasResponse {
  const known = new Map<string, string[]>();
  for (const s of catalog.schemas) known.set(s.name, []);

  const unknown = new Map<string | null, string[]>();
  for (const change of changes) {
    const name = change.schema ?? null;
    const bucket = name !== null ? known.get(name) : undefined;
    if (bucket) bucket.push(change.slug);
    else {
      const list = unknown.get(name) ?? [];
      list.push(change.slug);
      unknown.set(name, list);
    }
  }

  return {
    defaultSchema: catalog.defaultSchema,
    degradedReason: catalog.degradedReason,
    schemas: catalog.schemas.map((s) => {
      const slugs = known.get(s.name) ?? [];
      return { ...s, usage: { count: slugs.length, slugs } };
    }),
    unresolved: [...unknown.entries()].map(([schema, slugs]) => ({
      schema,
      count: slugs.length,
      slugs,
    })),
  };
}

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export type SchemaReadFailure = Extract<SchemaReadResult, { ok: false }>;

export type ResolvedSchemaPath = {
  ok: true;
  /** Directory holding the schema.yaml. */
  dir: string;
  source: SchemaSource;
  shadows: SchemaShadow[];
};

function parseShadows(value: unknown): SchemaShadow[] {
  if (!Array.isArray(value)) return [];
  const out: SchemaShadow[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const source = toSource(o.source);
    const p = str(o.path);
    if (source && p) out.push({ source, path: p });
  }
  return out;
}

/**
 * Locate a schema.
 *
 * `openspec schema which` is consulted first because it is the only source of the `shadows` list —
 * a project-local schema taking precedence over a same-named package one is worth showing, and
 * nothing on disk records it. When the CLI is unavailable the project-local directory still
 * resolves (with shadowing unknown); only a package schema is genuinely unreachable then, and that
 * reports the CLI reason rather than "not found", because those are different problems.
 */
export async function resolveSchemaPath(
  repoRoot: string,
  name: string,
): Promise<ResolvedSchemaPath | SchemaReadFailure> {
  if (!isSafeSchemaName(name)) return { ok: false, reason: "not-found" };

  const cli = await runOpenspec(["schema", "which", name, "--json"], repoRoot);
  if (cli.ok && cli.json && typeof cli.json === "object") {
    const o = cli.json as Record<string, unknown>;
    const dir = str(o.path);
    const source = toSource(o.source);
    if (dir && source) return { ok: true, dir, source, shadows: parseShadows(o.shadows) };
  }

  // CLI unusable (or it named a schema it could not describe): a project-local schema is still
  // reachable from disk on its own.
  const localDir = path.join(projectSchemasDir(repoRoot), name);
  if (fs.existsSync(path.join(localDir, "schema.yaml"))) {
    return { ok: true, dir: localDir, source: "project", shadows: [] };
  }

  // A failed run that still answered in JSON means the CLI worked and the *name* did not resolve.
  // `schema which <unknown>` prints `{"error": "Schema 'x' not found"}` and exits 1, so trusting the
  // exit code alone reported an ordinary unknown name as "the OpenSpec CLI reported an error" —
  // which reads as broken tooling and hides the one thing the reader can act on.
  if (!cli.ok && cliErrorMessage(cli.json) !== null) return { ok: false, reason: "not-found" };
  if (!cli.ok) return { ok: false, reason: cli.reason };
  return { ok: false, reason: "not-found" };
}

/** Read one schema's full definition. */
export async function readSchemaUncached(
  repoRoot: string,
  name: string,
): Promise<SchemaReadResult> {
  const resolved = await resolveSchemaPath(repoRoot, name);
  if (!resolved.ok) return resolved;

  let text: string;
  try {
    text = fs.readFileSync(path.join(resolved.dir, "schema.yaml"), "utf-8");
  } catch {
    return { ok: false, reason: "not-found" };
  }
  const parsed = parseSchemaYaml(text);
  if (!parsed) return { ok: false, reason: "not-found" };

  return {
    ok: true,
    schema: {
      // The requested name is authoritative over schema.yaml's own `name`: it is what resolved, and
      // what every link back to this schema uses.
      name,
      version: parsed.version,
      description: parsed.description,
      source: resolved.source,
      path: resolved.dir,
      displayPath: shortenSchemaPath(resolved.dir, { repoRoot }),
      isDefault: readDefaultSchema(repoRoot) === name,
      shadows: resolved.shadows,
      artifacts: parsed.artifacts,
      apply: parsed.apply,
    },
  };
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

// Policy (TTL, size cap, and why failures must not be remembered forever) lives on `ttlCached` in
// openspec-cli.ts, shared with schema-order.ts. Only the two stores are local.
const catalogCache = new Map<string, CacheEntry<SchemaCatalog>>();
const definitionCache = new Map<string, CacheEntry<SchemaReadResult>>();

/** The schemas available to a repo. Cached per repo. */
export function listSchemas(repoRoot: string): Promise<SchemaCatalog> {
  return ttlCached(catalogCache, repoRoot, () => listSchemasUncached(repoRoot));
}

/** One schema's full definition. Cached per (repo, name). */
export function readSchema(repoRoot: string, name: string): Promise<SchemaReadResult> {
  return ttlCached(definitionCache, `${repoRoot}::${name}`, () =>
    readSchemaUncached(repoRoot, name),
  );
}

/** Drop every cached schema read. Used by the resync path and by tests. */
export function clearSchemaCache(): void {
  catalogCache.clear();
  definitionCache.clear();
}
