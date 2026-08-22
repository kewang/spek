import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { openspecRouter } from "./openspec.js";

// The router is mounted on a throwaway app rather than importing server/index.ts, which calls
// listen() at import time. Search is pure filesystem + Fuse, so it needs no CLI runner stub.
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

function tempRepo(files: Record<string, string>): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "spek-search-test-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(repo, "openspec", rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return repo;
}

interface SearchResult {
  type: "spec" | "change";
  slug?: string;
  topic?: string;
}

async function search(repo: string, q: string): Promise<SearchResult[]> {
  const res = await fetch(
    `${base}/api/openspec/search?dir=${encodeURIComponent(repo)}&q=${encodeURIComponent(q)}`,
  );
  assert.equal(res.status, 200);
  return (await res.json()) as SearchResult[];
}

test("search finds content inside a data (.yaml) artifact", async () => {
  const repo = tempRepo({
    "changes/add-events/proposal.md": "## Why\nEvent driven change.\n",
    "changes/add-events/asyncapi.yaml":
      "asyncapi: 3.0.0\nchannels:\n  userSignedUp:\n    address: user.signedup\n",
  });
  const results = await search(repo, "userSignedUp");
  assert.ok(
    results.some((r) => r.type === "change" && r.slug === "add-events"),
    "the change whose asyncapi.yaml holds the match is returned",
  );
});

test("search finds content inside a .json data artifact", async () => {
  const repo = tempRepo({
    "changes/add-config/proposal.md": "## Why\n",
    "changes/add-config/settings.json": '{ "retentionPolicyDays": 42 }\n',
  });
  const results = await search(repo, "retentionPolicyDays");
  assert.ok(
    results.some((r) => r.type === "change" && r.slug === "add-config"),
    "the change whose settings.json holds the match is returned",
  );
});
