import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyStepLevel,
  computeArtifactLevels,
  drawableRequires,
  schemaArtifactCount,
  type RequiresNode,
} from "./schema-flow.js";
import type { SchemaApplyDef, SchemaArtifactDef } from "./types.js";

/**
 * Tested from inside core, against `./schema-flow.js`. The web suite covers these too, but via the
 * `@spekjs/core/schema-flow` subpath — i.e. `dist/` — so it goes green against the previous build
 * unless `build:core` was run. `drawableRequires` also has no Kotlin mirror to disagree with it.
 */

function artifact(id: string, requires: string[] = []): SchemaArtifactDef {
  return { id, requires, template: "", output: "" } as unknown as SchemaArtifactDef;
}

function apply(requires: string[]): SchemaApplyDef {
  return { requires } as unknown as SchemaApplyDef;
}

function levels(artifacts: SchemaArtifactDef[]): Record<string, number> {
  return Object.fromEntries(computeArtifactLevels(artifacts));
}

function drawable(steps: RequiresNode[]): Record<string, string[]> {
  return Object.fromEntries(drawableRequires(steps));
}

// --- computeArtifactLevels ---

test("computeArtifactLevels: a chain levels one step at a time", () => {
  assert.deepEqual(
    levels([artifact("proposal"), artifact("specs", ["proposal"]), artifact("tasks", ["specs"])]),
    { proposal: 1, specs: 2, tasks: 3 },
  );
});

test("computeArtifactLevels: independent artifacts share a level", () => {
  assert.deepEqual(levels([artifact("a"), artifact("b"), artifact("c")]), { a: 1, b: 1, c: 1 });
});

test("computeArtifactLevels: a step sits below its deepest prerequisite, not its first", () => {
  assert.deepEqual(
    levels([
      artifact("proposal"),
      artifact("specs", ["proposal"]),
      artifact("tasks", ["proposal", "specs"]),
    ]),
    { proposal: 1, specs: 2, tasks: 3 },
  );
});

test("computeArtifactLevels: declaration order does not decide levels", () => {
  // The chain above, declared bottom-up: array order would rank these exactly backwards.
  assert.deepEqual(
    levels([artifact("tasks", ["specs"]), artifact("specs", ["proposal"]), artifact("proposal")]),
    { proposal: 1, specs: 2, tasks: 3 },
  );
});

test("computeArtifactLevels: a requires entry the schema does not declare is ignored", () => {
  // Nothing to rank it against, so it cannot contribute a depth — `specs` stays a root.
  assert.deepEqual(levels([artifact("specs", ["nonexistent"])]), { specs: 1 });
});

test("computeArtifactLevels: a cycle falls back to positional levels", () => {
  // No valid levelling exists, so the whole schema takes declaration order rather than looping or
  // inventing a rank for the members of the cycle.
  assert.deepEqual(levels([artifact("a", ["b"]), artifact("b", ["a"]), artifact("c")]), {
    a: 1,
    b: 2,
    c: 3,
  });
});

test("computeArtifactLevels: a self-requiring artifact is a cycle", () => {
  assert.deepEqual(levels([artifact("a", ["a"]), artifact("b")]), { a: 1, b: 2 });
});

test("computeArtifactLevels: no artifacts yields no levels", () => {
  assert.deepEqual(levels([]), {});
});

// --- applyStepLevel ---

test("applyStepLevel: null when the schema declares no apply", () => {
  assert.equal(applyStepLevel(computeArtifactLevels([artifact("a")]), null), null);
});

test("applyStepLevel: sits one below its deepest resolvable prerequisite", () => {
  const artifacts = [artifact("proposal"), artifact("specs", ["proposal"])];
  assert.equal(applyStepLevel(computeArtifactLevels(artifacts), apply(["specs"])), 3);
});

test("applyStepLevel: apply is not forced to the end", () => {
  // `verify` follows implementation, so apply lands at 2 and the schema keeps a step below it.
  // Pinning apply to the deepest level would put it at 3, level with `verify` rather than before it.
  const artifacts = [artifact("proposal"), artifact("verify", ["proposal"])];
  assert.equal(applyStepLevel(computeArtifactLevels(artifacts), apply(["proposal"])), 2);
});

test("applyStepLevel: unresolvable requires put apply last for want of anywhere better", () => {
  const artifacts = [artifact("proposal"), artifact("specs", ["proposal"])];
  assert.equal(applyStepLevel(computeArtifactLevels(artifacts), apply(["nonexistent"])), 3);
});

test("applyStepLevel: an empty requires puts apply last", () => {
  const artifacts = [artifact("proposal"), artifact("specs", ["proposal"])];
  assert.equal(applyStepLevel(computeArtifactLevels(artifacts), apply([])), 3);
});

// --- schemaArtifactCount ---

test("schemaArtifactCount: artifacts sharing a dependency level are still counted separately", () => {
  // `b` and `c` are independent of each other, so the diagram draws them side by side — but each is
  // work that has to be done, and neither stops counting because the other could be produced
  // alongside it.
  const artifacts = [
    artifact("a"),
    artifact("b", ["a"]),
    artifact("c", ["a"]),
    artifact("d", ["b", "c"]),
  ];
  assert.equal(schemaArtifactCount(artifacts), 4);
});

test("schemaArtifactCount: the count does not depend on the requires graph at all", () => {
  // The same artifacts with every dependency removed: a count of work, not of workflow shape —
  // which is what lets it be read off the CLI's enumeration, which carries no `requires`.
  const chained = [artifact("a"), artifact("b", ["a"]), artifact("c", ["b"])];
  const flat = [artifact("a"), artifact("b"), artifact("c")];
  assert.equal(schemaArtifactCount(chained), schemaArtifactCount(flat));
});

test("schemaArtifactCount: a schema declaring nothing counts zero", () => {
  assert.equal(schemaArtifactCount([]), 0);
});

// --- drawableRequires ---

test("drawableRequires: keeps an edge nothing else implies", () => {
  assert.deepEqual(
    drawable([
      { id: "proposal", requires: [] },
      { id: "specs", requires: ["proposal"] },
    ]),
    { proposal: [], specs: ["proposal"] },
  );
});

test("drawableRequires: drops an edge a longer path already imposes", () => {
  // The PR's own example: proposal → specs → verification already imposes proposal → verification,
  // so the direct entry states nothing new and is not drawn.
  assert.deepEqual(
    drawable([
      { id: "proposal", requires: [] },
      { id: "specs", requires: ["proposal"] },
      { id: "verification", requires: ["proposal", "specs"] },
    ]),
    { proposal: [], specs: ["proposal"], verification: ["specs"] },
  );
});

test("drawableRequires: an implied edge is dropped however long the implying path is", () => {
  assert.deepEqual(
    drawable([
      { id: "a", requires: [] },
      { id: "b", requires: ["a"] },
      { id: "c", requires: ["b"] },
      { id: "d", requires: ["a", "c"] },
    ]),
    { a: [], b: ["a"], c: ["b"], d: ["c"] },
  );
});

test("drawableRequires: two independent paths to the same step both survive", () => {
  // Neither branch reaches `d` through the other, so removing either would lose a real dependency.
  assert.deepEqual(
    drawable([
      { id: "a", requires: [] },
      { id: "b", requires: ["a"] },
      { id: "c", requires: ["a"] },
      { id: "d", requires: ["b", "c"] },
    ]),
    { a: [], b: ["a"], c: ["a"], d: ["b", "c"] },
  );
});

test("drawableRequires: an entry naming an undeclared step is dropped", () => {
  // There is nothing to draw an edge to.
  assert.deepEqual(drawable([{ id: "specs", requires: ["ghost"] }]), { specs: [] });
});

test("drawableRequires: surviving entries keep their declared order", () => {
  assert.deepEqual(
    drawable([
      { id: "a", requires: [] },
      { id: "b", requires: [] },
      { id: "c", requires: ["b", "a"] },
    ]).c,
    ["b", "a"],
  );
});

test("drawableRequires: a cycle terminates and keeps both edges", () => {
  // Each of the two edges is implied by the other, and dropping both would erase the relationship
  // entirely. The traversal must also not loop, which is what this really guards.
  assert.deepEqual(
    drawable([
      { id: "a", requires: ["b"] },
      { id: "b", requires: ["a"] },
    ]),
    { a: ["b"], b: ["a"] },
  );
});

test("drawableRequires: levelling still uses the full requires", () => {
  // The property the reduction is only safe under: removing an implied edge never shortens the
  // longest path, so levels are identical either way. Asserted rather than assumed, because a
  // reduction that did move a level would silently reposition steps in the diagram.
  const artifacts = [
    artifact("proposal"),
    artifact("specs", ["proposal"]),
    artifact("verification", ["proposal", "specs"]),
  ];
  const reduced = drawableRequires(
    artifacts.map((a) => ({ id: a.id, requires: a.requires ?? [] })),
  );
  assert.deepEqual(
    levels(artifacts),
    Object.fromEntries(computeArtifactLevels(artifacts.map((a) => artifact(a.id, reduced.get(a.id) ?? [])))),
  );
});
