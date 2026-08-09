import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import {
  clearSchemaCache,
  setOpenspecRunner,
  type CliResult,
  type OpenspecRunner,
  type SchemaSource,
} from "@spekjs/core";
import { openspecRouter } from "./openspec.js";

// The router is mounted on a throwaway app rather than importing server/index.ts, which calls
// listen() at import time.
let server: Server;
let base: string;

before(async () => {
  const app = express();
  app.use("/api/openspec", openspecRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

let restoreRunner: OpenspecRunner | null = null;

function useRunner(answers: Record<string, CliResult>): void {
  const stub: OpenspecRunner = async (args) =>
    answers[args.slice(0, 2).join(" ")] ?? { ok: false, reason: "cli-failed" };
  const prev = setOpenspecRunner(stub);
  if (restoreRunner === null) restoreRunner = prev;
  clearSchemaCache();
}

afterEach(() => {
  if (restoreRunner) setOpenspecRunner(restoreRunner);
  restoreRunner = null;
  clearSchemaCache();
});

/** A repo with an openspec/ tree and the given active changes, each declaring a schema. */
function tempRepo(opts: {
  defaultSchema?: string;
  changes?: Array<{ slug: string; schema?: string }>;
  projectSchemas?: string[];
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spek-route-schemas-"));
  const openspec = path.join(dir, "openspec");
  fs.mkdirSync(path.join(openspec, "changes"), { recursive: true });
  fs.mkdirSync(path.join(openspec, "specs"), { recursive: true });
  if (opts.defaultSchema) {
    fs.writeFileSync(path.join(openspec, "config.yaml"), `schema: ${opts.defaultSchema}\n`);
  }
  for (const change of opts.changes ?? []) {
    const changeDir = path.join(openspec, "changes", change.slug);
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "proposal.md"), "## Why\n\nbecause\n");
    if (change.schema) {
      fs.writeFileSync(path.join(changeDir, ".openspec.yaml"), `schema: ${change.schema}\n`);
    }
  }
  for (const name of opts.projectSchemas ?? []) {
    const schemaDir = path.join(openspec, "schemas", name);
    fs.mkdirSync(schemaDir, { recursive: true });
    fs.writeFileSync(
      path.join(schemaDir, "schema.yaml"),
      `name: ${name}\ndescription: Local ${name}\nartifacts:\n  - id: only\n`,
    );
  }
  return dir;
}

function schemasJson(entries: Array<{ name: string; source: SchemaSource }>): CliResult {
  return {
    ok: true,
    json: entries.map((e) => ({
      name: e.name,
      description: `desc ${e.name}`,
      artifacts: ["a", "b"],
      source: e.source,
    })),
  };
}

// --- GET /schemas ----------------------------------------------------------

test("GET /schemas: lists schemas with usage, default first", async () => {
  const repo = tempRepo({
    defaultSchema: "spec-driven",
    changes: [
      { slug: "one", schema: "spec-driven" },
      { slug: "two", schema: "spec-driven" },
      { slug: "three", schema: "house-style" },
    ],
  });
  useRunner({
    "schemas --json": schemasJson([
      { name: "house-style", source: "project" },
      { name: "spec-driven", source: "package" },
    ]),
  });

  const res = await fetch(`${base}/api/openspec/schemas?dir=${encodeURIComponent(repo)}`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.defaultSchema, "spec-driven");
  assert.equal(body.degradedReason, null);
  assert.deepEqual(
    body.schemas.map((s: { name: string }) => s.name),
    ["spec-driven", "house-style"],
  );
  assert.equal(body.schemas[0].usage.count, 2);
  assert.deepEqual(body.schemas[0].usage.slugs.sort(), ["one", "two"]);
  assert.equal(body.schemas[1].usage.count, 1);
  assert.deepEqual(body.unresolved, []);
});

test("GET /schemas: changes declaring an unenumerated schema are reported, not dropped", async () => {
  const repo = tempRepo({
    defaultSchema: "spec-driven",
    changes: [
      { slug: "kept", schema: "spec-driven" },
      { slug: "orphan", schema: "retired-workflow" },
    ],
  });
  useRunner({ "schemas --json": schemasJson([{ name: "spec-driven", source: "package" }]) });

  const res = await fetch(`${base}/api/openspec/schemas?dir=${encodeURIComponent(repo)}`);
  const body = await res.json();

  assert.equal(body.schemas[0].usage.count, 1);
  assert.deepEqual(body.unresolved, [{ schema: "retired-workflow", count: 1, slugs: ["orphan"] }]);
});

test("GET /schemas: CLI failure is a degraded 200, not a 5xx", async () => {
  const repo = tempRepo({ defaultSchema: "house-style", projectSchemas: ["house-style"] });
  useRunner({ "schemas --json": { ok: false, reason: "cli-unavailable" } });

  const res = await fetch(`${base}/api/openspec/schemas?dir=${encodeURIComponent(repo)}`);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.degradedReason, "cli-unavailable");
  assert.deepEqual(
    body.schemas.map((s: { name: string }) => s.name),
    ["house-style"],
  );
});

test("GET /schemas: without dir → 400", async () => {
  const res = await fetch(`${base}/api/openspec/schemas`);
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "dir parameter is required" });
});

// --- GET /schemas/:name ----------------------------------------------------

test("GET /schemas/:name: returns the definition in schema order", async () => {
  const repo = tempRepo({ defaultSchema: "house-style", projectSchemas: ["house-style"] });
  useRunner({
    "schema which": {
      ok: true,
      json: {
        name: "house-style",
        source: "project",
        path: path.join(repo, "openspec", "schemas", "house-style"),
        shadows: [],
      },
    },
  });

  const res = await fetch(
    `${base}/api/openspec/schemas/house-style?dir=${encodeURIComponent(repo)}`,
  );
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.name, "house-style");
  assert.equal(body.source, "project");
  assert.equal(body.isDefault, true);
  assert.deepEqual(
    body.artifacts.map((a: { id: string }) => a.id),
    ["only"],
  );
});

test("GET /schemas/:name: unknown name → 404", async () => {
  const repo = tempRepo({});
  useRunner({ "schema which": { ok: true, json: {} } });

  const res = await fetch(
    `${base}/api/openspec/schemas/no-such-schema?dir=${encodeURIComponent(repo)}`,
  );
  assert.equal(res.status, 404);
  assert.equal((await res.json()).reason, "not-found");
});

test("GET /schemas/:name: traversal name → 404, and nothing is spawned", async () => {
  const repo = tempRepo({});
  let spawned = 0;
  const prev = setOpenspecRunner(async () => {
    spawned += 1;
    return { ok: true, json: {} };
  });
  if (restoreRunner === null) restoreRunner = prev;
  clearSchemaCache();

  // Encoded so it survives as a single path segment rather than being normalised away by fetch.
  const res = await fetch(
    `${base}/api/openspec/schemas/${encodeURIComponent("../../etc")}?dir=${encodeURIComponent(repo)}`,
  );
  assert.equal(res.status, 404);
  assert.equal(spawned, 0);
});

test("GET /schemas/:name: CLI unavailable is distinguished from not-found", async () => {
  const repo = tempRepo({});
  useRunner({ "schema which": { ok: false, reason: "cli-unavailable" } });

  const res = await fetch(
    `${base}/api/openspec/schemas/spec-driven?dir=${encodeURIComponent(repo)}`,
  );
  assert.equal(res.status, 404);
  assert.equal((await res.json()).reason, "cli-unavailable");
});

test("GET /schemas/:name: without dir → 400", async () => {
  const res = await fetch(`${base}/api/openspec/schemas/spec-driven`);
  assert.equal(res.status, 400);
});

// --- staying current -------------------------------------------------------

// Schemas resolve from three directories and only one of them — this repo's openspec/schemas/ —
// is watched. Promoting a schema to the machine-global directory, or editing one there, produces
// no filesystem event, so Refresh has to be the authoritative way to pick the change up rather
// than leaving the reader to wait out a 30s cache.
test("POST /resync: makes a moved or edited schema visible immediately", async () => {
  const repo = tempRepo({ defaultSchema: "house-style" });

  // First read: the schema lives in the repo.
  useRunner({
    "schemas --json": schemasJson([{ name: "house-style", source: "project" }]),
  });
  const first = await fetch(`${base}/api/openspec/schemas?dir=${encodeURIComponent(repo)}`);
  assert.equal((await first.json()).schemas[0].source, "project");

  // It is promoted to the machine-global directory. Without invalidation the cached "project"
  // answer would be served for the rest of the TTL.
  const prev = setOpenspecRunner(async (args) =>
    args[0] === "schemas"
      ? schemasJson([{ name: "house-style", source: "user" }])
      : { ok: false, reason: "cli-failed" },
  );
  if (restoreRunner === null) restoreRunner = prev;

  const stale = await fetch(`${base}/api/openspec/schemas?dir=${encodeURIComponent(repo)}`);
  assert.equal((await stale.json()).schemas[0].source, "project", "still cached, as expected");

  const resync = await fetch(`${base}/api/openspec/resync?dir=${encodeURIComponent(repo)}`, {
    method: "POST",
  });
  assert.equal(resync.status, 200);

  const fresh = await fetch(`${base}/api/openspec/schemas?dir=${encodeURIComponent(repo)}`);
  assert.equal((await fresh.json()).schemas[0].source, "user", "resync must drop the schema cache");
});
