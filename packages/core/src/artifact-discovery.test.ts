import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverArtifacts } from "./artifact-discovery.js";
import {
  countArtifacts,
  changeDirMtime,
  listChangeArtifactFiles,
} from "./artifact-files.js";

function mkRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spek-artifacts-test-"));
}

function writeChange(repo: string, slug: string, files: Record<string, string>): string {
  const changePath = path.join(repo, "openspec", "changes", slug);
  fs.mkdirSync(changePath, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(changePath, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return changePath;
}

// 明確設定某檔案的 mtime（秒），讓排序測試不受寫入時序影響
function setMtime(changePath: string, rel: string, seconds: number): void {
  fs.utimesSync(path.join(changePath, rel), seconds, seconds);
}

// 讓 change 內所有 *.md（含 specs 內）共用同一個 mtime，以觸發「mtime 完全相同」的 tiebreak
// 分支（注意這並非模擬 clone —— 實際 clone/checkout 會寫出各異的 mtime；此處刻意壓平以測 tiebreak）
function levelMtimes(changePath: string, seconds: number): void {
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.toLowerCase().endsWith(".md")) fs.utimesSync(full, seconds, seconds);
    }
  };
  walk(changePath);
}

test("discoverArtifacts: orders by mtime, newest first", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "add-foo", {
    "proposal.md": "## Why\n",
    "design.md": "## Context\n",
    "tasks.md": "## 1. Group\n\n- [x] 1.1 done\n- [ ] 1.2 todo\n",
  });
  setMtime(changePath, "proposal.md", 1000);
  setMtime(changePath, "design.md", 2000);
  setMtime(changePath, "tasks.md", 3000); // newest -> first
  const arts = discoverArtifacts(changePath);
  assert.deepEqual(arts.map((a) => a.id), ["tasks", "design", "proposal"]);
});

test("discoverArtifacts: preserves kinds and parsed data while ordering by mtime", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "add-foo", {
    "proposal.md": "## Why\n",
    "tasks.md": "## 1. Group\n\n- [x] 1.1 done\n- [ ] 1.2 todo\n",
    "specs/foo/spec.md": "## ADDED Requirements\n",
  });
  setMtime(changePath, "proposal.md", 3000); // newest markdown
  setMtime(changePath, "tasks.md", 1000);
  setMtime(changePath, "specs/foo/spec.md", 2000);
  const arts = discoverArtifacts(changePath);
  assert.deepEqual(arts.map((a) => a.id), ["proposal", "specs", "tasks"]);
  const proposal = arts.find((a) => a.id === "proposal")!;
  assert.equal(proposal.kind, "markdown");
  assert.equal(proposal.content, "## Why\n"); // raw file content, correct encoding
  const specs = arts.find((a) => a.id === "specs")!;
  assert.equal(specs.kind, "specs");
  assert.equal(specs.id, "specs");
  assert.equal(specs.title, "Specs"); // fixed display title for the specs delta artifact
  assert.deepEqual(specs.specs?.map((s) => s.topic), ["foo"]);
  assert.equal(specs.specs?.[0].content, "## ADDED Requirements\n");
  const tasks = arts.find((a) => a.id === "tasks")!;
  assert.equal(tasks.kind, "tasks");
  assert.equal(tasks.tasks?.total, 2);
  assert.equal(tasks.tasks?.completed, 1);
});

test("discoverArtifacts: specs artifact sorts by its newest delta file", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "x\n",
    "specs/foo/spec.md": "x\n",
    "specs/bar/spec.md": "x\n",
  });
  setMtime(changePath, "proposal.md", 3000);
  setMtime(changePath, "specs/bar/spec.md", 2000);
  setMtime(changePath, "specs/foo/spec.md", 5000); // newest delta -> specs leads
  const arts = discoverArtifacts(changePath);
  assert.deepEqual(arts.map((a) => a.id), ["specs", "proposal"]);
});

test("discoverArtifacts: equal mtimes fall back to the stable default order", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "zebra.md": "x\n",
    "tasks.md": "## 1. G\n\n- [ ] 1.1 a\n",
    "apple.md": "x\n",
    "design.md": "x\n",
    "proposal.md": "x\n",
    "specs/foo/spec.md": "x\n",
  });
  levelMtimes(changePath, 1000); // force identical mtimes to exercise the equal-mtime tiebreak
  const arts = discoverArtifacts(changePath);
  // DEFAULT_ORDER first (proposal, design, specs, tasks) — note `design` ranks ahead of the
  // alphabetical remainder `apple`, so this depends on DEFAULT_ORDER, not plain alpha — then
  // the remainder alphabetically (apple, zebra).
  assert.deepEqual(arts.map((a) => a.id), ["proposal", "design", "specs", "tasks", "apple", "zebra"]);
});

test("discoverArtifacts: root specs.md coexists with the specs/ tree without losing content", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "## Why\n",
    "specs.md": "## Root specs doc\n",
    "specs/foo/spec.md": "## ADDED\n",
  });
  // distinct mtimes so order is deterministic and independent of the equal-mtime tiebreak
  setMtime(changePath, "proposal.md", 3000);
  setMtime(changePath, "specs.md", 2000);
  setMtime(changePath, "specs/foo/spec.md", 1000);
  const arts = discoverArtifacts(changePath);
  // the delta tree keeps the canonical id "specs"; the root specs.md is disambiguated to "specs-2"
  const tree = arts.find((a) => a.kind === "specs")!;
  assert.equal(tree.id, "specs");
  const rootDoc = arts.find((a) => a.kind === "markdown" && a.content === "## Root specs doc\n")!;
  assert.equal(rootDoc.id, "specs-2"); // content preserved, not overwritten by the tree
  // no data loss; discover and count agree
  assert.equal(arts.length, 3);
  assert.equal(countArtifacts(changePath), 3);
  // mtime is keyed by the ALLOCATED id: root specs.md (2000) must sort above the tree (1000).
  // If mtime were keyed by the raw stem "specs", the root doc would read 0 and sink last.
  assert.deepEqual(arts.map((a) => a.id), ["proposal", "specs-2", "specs"]);
});

test("discoverArtifacts: a lone root specs.md (no specs/ tree) keeps the canonical id 'specs'", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "## Why\n",
    "specs.md": "## Root specs doc\n",
  });
  const arts = discoverArtifacts(changePath);
  const specsDoc = arts.find((a) => a.content === "## Root specs doc\n")!;
  assert.equal(specsDoc.id, "specs"); // no tree to collide with → no disambiguating suffix
  assert.equal(arts.length, 2);
  assert.equal(countArtifacts(changePath), 2);
});

test("discoverArtifacts: id disambiguation loops past an already-taken suffix", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "specs.md": "root\n",
    "specs-2.md": "sibling\n",
    "specs/foo/spec.md": "## ADDED\n",
  });
  const arts = discoverArtifacts(changePath);
  // tree = "specs"; the two root files take "specs-2" and "specs-3" — no collision, no loss
  assert.deepEqual(arts.map((a) => a.id).sort(), ["specs", "specs-2", "specs-3"]);
  assert.equal(arts.length, 3);
  assert.equal(countArtifacts(changePath), 3);
  const contents = arts
    .filter((a) => a.kind === "markdown")
    .map((a) => a.content)
    .sort();
  assert.deepEqual(contents, ["root\n", "sibling\n"]);
});

test("discoverArtifacts: custom-schema files all surface, ordered by mtime, no CLI involved", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "bridge-change", {
    "brainstorm.md": "raw\n",
    "proposal.md": "## Why\n",
    "plan.md": "plan\n",
    "verify.md": "verify\n",
    "retrospective.md": "retro\n",
  });
  setMtime(changePath, "brainstorm.md", 1000);
  setMtime(changePath, "proposal.md", 2000);
  setMtime(changePath, "plan.md", 5000); // newest
  setMtime(changePath, "verify.md", 3000);
  setMtime(changePath, "retrospective.md", 4000);
  const arts = discoverArtifacts(changePath);
  assert.deepEqual(
    arts.map((a) => a.id),
    ["plan", "retrospective", "verify", "proposal", "brainstorm"],
  );
  const retro = arts.find((a) => a.id === "retrospective")!;
  assert.equal(retro.title, "Retrospective");
  assert.equal(retro.kind, "markdown");
});

test("discoverArtifacts: humanize trims leading separator before title-casing", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", { "_foo.md": "x\n" });
  const arts = discoverArtifacts(changePath);
  assert.equal(arts[0].title, "Foo");
});

test("discoverArtifacts: humanizes dashes and underscores into Title Case", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", { "my_cool-artifact.md": "x\n" });
  const arts = discoverArtifacts(changePath);
  assert.equal(arts[0].id, "my_cool-artifact");
  assert.equal(arts[0].title, "My Cool Artifact");
});

test("discoverArtifacts: collapses runs of separators in titles", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", { "a__b--c.md": "x\n" });
  const arts = discoverArtifacts(changePath);
  assert.equal(arts[0].title, "A B C");
});

test("discoverArtifacts: a specs topic dir without spec.md is skipped (not read)", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", { "specs/foo/spec.md": "a\n" });
  fs.mkdirSync(path.join(changePath, "specs", "bar"), { recursive: true }); // no spec.md
  const arts = discoverArtifacts(changePath);
  const specs = arts.find((a) => a.id === "specs")!;
  assert.deepEqual(specs.specs?.map((s) => s.topic), ["foo"]);
});

test("discoverArtifacts: ignores dotfiles and non-markdown files", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "## Why\n",
    ".openspec.yaml": "schema: spec-driven\n",
    "notes.txt": "ignore me\n",
    ".secret.md": "hidden\n",
  });
  const arts = discoverArtifacts(changePath);
  assert.deepEqual(arts.map((a) => a.id), ["proposal"]);
});

test("discoverArtifacts: missing change dir returns empty array", () => {
  const repo = mkRepo();
  assert.deepEqual(discoverArtifacts(path.join(repo, "nope")), []);
});

test("discoverArtifacts: empty specs dir yields no specs artifact", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", { "proposal.md": "## Why\n" });
  fs.mkdirSync(path.join(changePath, "specs"), { recursive: true });
  const arts = discoverArtifacts(changePath);
  assert.deepEqual(arts.map((a) => a.id), ["proposal"]);
});

test("discoverArtifacts: specs delta files are sorted by topic", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "specs/zeta/spec.md": "z\n",
    "specs/alpha/spec.md": "a\n",
    "specs/mid/spec.md": "m\n",
  });
  const arts = discoverArtifacts(changePath);
  const specs = arts.find((a) => a.id === "specs")!;
  assert.deepEqual(specs.specs?.map((s) => s.topic), ["alpha", "mid", "zeta"]);
});

test("discoverArtifacts: strips a case-insensitive .MD extension when deriving the id", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", { "Notes.MD": "x\n" });
  const arts = discoverArtifacts(changePath);
  assert.deepEqual(arts.map((a) => a.id), ["Notes"]); // ".MD" stripped, not left in the id
});

test("discoverArtifacts: ignores dotfile directories inside specs/", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "specs/foo/spec.md": "a\n",
    "specs/.hidden/spec.md": "h\n",
  });
  const arts = discoverArtifacts(changePath);
  const specs = arts.find((a) => a.id === "specs")!;
  assert.deepEqual(specs.specs?.map((s) => s.topic), ["foo"]); // .hidden not treated as a topic
});

test("countArtifacts: counts root md + specs tree", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "x\n",
    "design.md": "x\n",
    "tasks.md": "x\n",
    "specs/foo/spec.md": "x\n",
    ".openspec.yaml": "schema: spec-driven\n",
    ".hidden.md": "x\n", // dotfile that DOES end in .md — must still be excluded
    "notes.txt": "x\n",
  });
  assert.equal(countArtifacts(changePath), 4); // 3 md + 1 specs; .hidden.md / .openspec.yaml / notes.txt excluded
});

test("countArtifacts: markdown only (no specs) does not add a specs count", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", { "proposal.md": "x\n", "design.md": "x\n" });
  assert.equal(countArtifacts(changePath), 2);
});

test("countArtifacts: empty specs dir is not counted", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", { "proposal.md": "x\n" });
  fs.mkdirSync(path.join(changePath, "specs"), { recursive: true });
  assert.equal(countArtifacts(changePath), 1);
});

test("countArtifacts: missing change dir is 0", () => {
  const repo = mkRepo();
  assert.equal(countArtifacts(path.join(repo, "nope")), 0);
});

// The schemas page reports `schemaArtifactCount` (one per declared artifact) and the change page
// reports these. They are two implementations of one unit, so a glob artifact has to resolve to one
// on both sides — otherwise a reader moving between the pages sees two numbers for the same thing.
test("countArtifacts: a specs dir of many files is one artifact, matching a schema's count", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "x\n",
    "design.md": "x\n",
    "tasks.md": "- [ ] a\n",
    // Five delta specs, i.e. what `specs/**/*.md` expands to for this change.
    "specs/one/spec.md": "x\n",
    "specs/two/spec.md": "x\n",
    "specs/three/spec.md": "x\n",
    "specs/four/spec.md": "x\n",
    "specs/five/spec.md": "x\n",
  });

  // Eight files, four artifacts — the same four `spec-driven` declares.
  assert.equal(countArtifacts(changePath), 4);
  assert.deepEqual(
    discoverArtifacts(changePath).map((a) => a.id).sort(),
    ["design", "proposal", "specs", "tasks"],
  );
});

// --- data artifacts (.yaml / .yml / .json) ---

test("discoverArtifacts: root .yaml / .yml / .json surface as data artifacts, titled with extension", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "event-change", {
    "proposal.md": "## Why\n",
    "asyncapi.yaml": "asyncapi: 3.0.0\n",
    "config.yml": "a: 1\n",
    "schema.json": '{"x":1}\n',
  });
  const arts = discoverArtifacts(changePath);
  const async = arts.find((a) => a.title === "asyncapi.yaml")!;
  assert.equal(async.kind, "data");
  assert.equal(async.id, "asyncapi"); // id is the stem; title keeps the extension
  assert.equal(async.content, "asyncapi: 3.0.0\n"); // raw text, correct encoding
  const yml = arts.find((a) => a.title === "config.yml")!;
  assert.equal(yml.kind, "data");
  const json = arts.find((a) => a.title === "schema.json")!;
  assert.equal(json.kind, "data");
  assert.equal(json.content, '{"x":1}\n');
  // markdown still classified as markdown; four artifacts total
  assert.equal(arts.find((a) => a.id === "proposal")!.kind, "markdown");
  assert.equal(arts.length, 4);
});

test("discoverArtifacts: the change's own .openspec.yaml (a dotfile) is never a data artifact", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "## Why\n",
    ".openspec.yaml": "schema: spec-driven\n",
  });
  const arts = discoverArtifacts(changePath);
  assert.deepEqual(arts.map((a) => a.id), ["proposal"]); // no data artifact for the dotfile
  assert.equal(arts.some((a) => a.kind === "data"), false);
});

test("discoverArtifacts: a .json inside a subdirectory is not discovered (root-only)", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "## Why\n",
    "nested/data.json": '{"deep":true}\n',
  });
  const arts = discoverArtifacts(changePath);
  assert.deepEqual(arts.map((a) => a.id), ["proposal"]); // subdir json ignored
});

test("discoverArtifacts: spec.md and spec.json get different ids (markdown wins the stem)", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "spec.md": "## markdown\n",
    "spec.json": '{"data":1}\n',
  });
  const arts = discoverArtifacts(changePath);
  const md = arts.find((a) => a.kind === "markdown")!;
  const data = arts.find((a) => a.kind === "data")!;
  assert.equal(md.id, "spec"); // markdown producer runs before data → keeps the bare stem
  assert.equal(data.id, "spec-2"); // data disambiguated, no content lost
  assert.equal(data.title, "spec.json"); // and its tab label keeps the extension
  assert.equal(arts.length, 2);
});

test("discoverArtifacts / countArtifacts: data artifacts are counted, count equals tab count", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "## Why\n",
    "asyncapi.yaml": "asyncapi: 3.0.0\n",
    "specs/foo/spec.md": "## ADDED\n",
  });
  const arts = discoverArtifacts(changePath);
  assert.equal(arts.length, 3); // proposal (markdown) + asyncapi (data) + specs
  assert.equal(countArtifacts(changePath), 3); // count matches the number of tabs
});

test("listChangeArtifactFiles: includes markdown + tasks + data, excludes dotfiles and subdirs", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "## Why\n",
    "tasks.md": "- [ ] a\n",
    "asyncapi.yaml": "asyncapi: 3.0.0\n",
    "schema.json": "{}\n",
    ".openspec.yaml": "schema: spec-driven\n",
    "nested/data.json": "{}\n",
    // the specs/ delta tree contributes no root files to the artifact file set (rootArtifacts covers
    // root files only); change delta specs are not part of the full-text index, and never were
    "specs/foo/spec.md": "## ADDED\n",
  });
  assert.deepEqual(listChangeArtifactFiles(changePath), [
    "asyncapi.yaml",
    "proposal.md",
    "schema.json",
    "tasks.md",
  ]);
});

test("changeDirMtime: an edit to only a data file bumps the change mtime", () => {
  const repo = mkRepo();
  const changePath = writeChange(repo, "c", {
    "proposal.md": "## Why\n",
    "asyncapi.yaml": "asyncapi: 3.0.0\n",
  });
  setMtime(changePath, "proposal.md", 1000);
  setMtime(changePath, "asyncapi.yaml", 5000); // data file is the newest edit
  const dataMtime = fs.statSync(path.join(changePath, "asyncapi.yaml")).mtimeMs;
  assert.equal(changeDirMtime(changePath), dataMtime); // the data file's mtime, not ignored
});
