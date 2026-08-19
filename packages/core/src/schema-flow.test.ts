import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyStepLevel,
  computeArtifactLevels,
  drawableEdges,
  drawableRequires,
  levelArtifacts,
  postApplyArtifacts,
  resolveImplementationOrdering,
  schemaArtifactCount,
  type OriginNode,
  type RequiresNode,
} from "./schema-flow.js";
import type { SchemaApplyDef, SchemaArtifactDef } from "./types.js";

/**
 * Tested from inside core, against `./schema-flow.js`. The web suite covers these too, but via the
 * `@spekjs/core/schema-flow` subpath — i.e. `dist/` — so it goes green against the previous build
 * unless `build:core` was run. The reduction has no Kotlin mirror to disagree with it — no Kotlin
 * host draws the diagram.
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

// The reduction tests exercise the public `drawableRequires`, which delegates to `drawableEdges`.
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

// --- levelArtifacts ---

test("levelArtifacts: reports a DAG as not cyclic, with the same levels as computeArtifactLevels", () => {
  const artifacts = [artifact("proposal"), artifact("specs", ["proposal"])];
  const result = levelArtifacts(artifacts);

  assert.equal(result.cyclic, false);
  assert.deepEqual(Object.fromEntries(result.levels), { proposal: 1, specs: 2 });
  assert.deepEqual([...result.levels], [...computeArtifactLevels(artifacts)]);
});

test("levelArtifacts: reports the positional fallback as cyclic", () => {
  const artifacts = [artifact("a", ["b"]), artifact("b", ["a"]), artifact("c")];
  const result = levelArtifacts(artifacts);

  assert.equal(result.cyclic, true);
  assert.deepEqual(Object.fromEntries(result.levels), { a: 1, b: 2, c: 3 });
});

test("levelArtifacts: a cycle reachable only from elsewhere is still reported", () => {
  // The cycle is `b <-> c`; `a` is an ordinary root. Detection must not depend on the traversal
  // happening to start inside the cycle, or a schema's declaration order would decide the answer.
  const result = levelArtifacts([artifact("a"), artifact("b", ["c"]), artifact("c", ["b"])]);

  assert.equal(result.cyclic, true);
});

test("levelArtifacts: an unresolvable requires entry is not a cycle", () => {
  assert.equal(levelArtifacts([artifact("specs", ["nonexistent"])]).cyclic, false);
});

test("levelArtifacts: no artifacts is not cyclic", () => {
  assert.equal(levelArtifacts([]).cyclic, false);
});

// --- postApplyArtifacts ---

test("postApplyArtifacts: superpowers-bridge's verify and retrospective follow apply", () => {
  const artifacts = [
    artifact("brainstorm"),
    artifact("proposal", ["brainstorm"]),
    artifact("design", ["brainstorm"]),
    artifact("specs", ["proposal"]),
    artifact("tasks", ["specs", "design"]),
    artifact("plan", ["tasks"]),
    artifact("verify", ["plan"]),
    artifact("retrospective", ["verify"]),
  ];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["plan"])), ["verify", "retrospective"]);
});

test("postApplyArtifacts: anvil's verify follows apply", () => {
  const artifacts = [
    artifact("proposal"),
    artifact("specs", ["proposal"]),
    artifact("design", ["proposal", "specs"]),
    artifact("review", ["proposal", "design", "specs"]),
    artifact("test-plan", ["specs", "review"]),
    artifact("tasks", ["test-plan", "design", "review"]),
    artifact("verify", ["tasks"]),
  ];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["tasks"])), ["verify"]);
});

test("postApplyArtifacts: spec-driven has nothing after apply", () => {
  const artifacts = [
    artifact("proposal"),
    artifact("specs", ["proposal"]),
    artifact("design", ["proposal"]),
    artifact("tasks", ["specs", "design"]),
  ];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["tasks"])), []);
});

test("postApplyArtifacts: an artifact apply requires is never placed after it", () => {
  // propose-spec-verify: `verification` is named in apply.requires, so despite its name it is a
  // prerequisite. A rule keyed on what a step is called would get this one backwards.
  const artifacts = [
    artifact("proposal"),
    artifact("specs", ["proposal"]),
    artifact("verification", ["proposal", "specs"]),
  ];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["proposal", "specs", "verification"])), []);
});

test("postApplyArtifacts: a step missing one of apply's requirements keeps its place", () => {
  // `retro` is outside apply's closure but depends only on `specs`, so it can be written before
  // apply is reachable. Only a step that needs everything apply needs is placed after it.
  const artifacts = [
    artifact("proposal"),
    artifact("specs", ["proposal"]),
    artifact("verification", ["proposal", "specs"]),
    artifact("retro", ["specs"]),
  ];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["proposal", "specs", "verification"])), []);
});

test("postApplyArtifacts: a side chain that ties apply's level is not placed after it", () => {
  // `adr` levels to 4, the same as apply, but it is ordinary planning work: it does not depend on
  // `tasks`. Placing it after apply is what a level-tie rule does, and why the rule is a closure.
  const artifacts = [
    artifact("proposal"),
    artifact("specs", ["proposal"]),
    artifact("tasks", ["specs"]),
    artifact("research", ["specs"]),
    artifact("adr", ["research"]),
  ];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["tasks"])), []);
});

test("postApplyArtifacts: no apply step means nothing follows it", () => {
  assert.deepEqual(postApplyArtifacts([artifact("a"), artifact("b", ["a"])], null), []);
});

test("postApplyArtifacts: apply requiring nothing declared places nothing after it", () => {
  // The superset test is vacuously true against an empty set, so without this guard every artifact
  // would be reported as following apply.
  const artifacts = [artifact("proposal"), artifact("tasks", ["proposal"])];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["ghost"])), []);
  assert.deepEqual(postApplyArtifacts(artifacts, apply([])), []);
});

test("postApplyArtifacts: a cyclic schema places nothing after apply", () => {
  // Levels are declaration order here, not a reading of the graph, so there is no ordering to
  // derive against.
  const artifacts = [
    artifact("a", ["b"]),
    artifact("b", ["a"]),
    artifact("tasks", ["a"]),
    artifact("retro", ["tasks"]),
  ];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["tasks"])), []);
});

test("postApplyArtifacts: a post-implementation artifact declaring no requires is not detected", () => {
  // Known limitation, stated so it is not mistaken for a bug: the schema declares nothing linking
  // `retro` to the flow, so nothing is derivable. It levels to 1 and never collides with apply.
  const artifacts = [
    artifact("proposal"),
    artifact("tasks", ["proposal"]),
    artifact("retro"),
  ];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["tasks"])), []);
});

test("postApplyArtifacts: results keep the schema's declared order", () => {
  const artifacts = [
    artifact("tasks"),
    artifact("retrospective", ["verify"]),
    artifact("verify", ["tasks"]),
  ];

  assert.deepEqual(postApplyArtifacts(artifacts, apply(["tasks"])), ["retrospective", "verify"]);
});

// --- resolveImplementationOrdering ---

const applyStep = (requires: string[]) => ({ id: "apply", requires });

test("resolveImplementationOrdering: derives what the schema cannot state", () => {
  const artifacts = [
    artifact("tasks"),
    artifact("plan", ["tasks"]),
    artifact("verify", ["plan"]),
    artifact("retrospective", ["verify"]),
  ];

  assert.deepEqual(
    Object.fromEntries(resolveImplementationOrdering(artifacts, applyStep(["plan"]))),
    { verify: "derived", retrospective: "derived" },
  );
});

test("resolveImplementationOrdering: a stated ordering is reported as declared", () => {
  // The forward path. If the format gains a way to say this, the step names the apply step in its
  // own requires and the derivation never runs for it.
  const artifacts = [artifact("tasks"), artifact("verify", ["apply"])];

  assert.deepEqual(
    Object.fromEntries(resolveImplementationOrdering(artifacts, applyStep(["tasks"]))),
    { verify: "declared" },
  );
});

test("resolveImplementationOrdering: a declared ordering the rule would not have derived still holds", () => {
  // `verify` requires only the apply step, so its closure covers nothing apply requires and the
  // derivation would miss it entirely. The declaration decides it regardless.
  const artifacts = [artifact("proposal"), artifact("tasks", ["proposal"]), artifact("verify", ["apply"])];
  const ordering = resolveImplementationOrdering(artifacts, applyStep(["tasks"]));

  assert.equal(ordering.get("verify"), "declared");
  assert.deepEqual(postApplyArtifacts(artifacts, apply(["tasks"])), []);
});

test("resolveImplementationOrdering: precedence is per step, not per schema", () => {
  // One artifact states its ordering and another does not. Both are placed after implementation,
  // each carrying the source it actually came from.
  const artifacts = [
    artifact("tasks"),
    artifact("plan", ["tasks"]),
    artifact("verify", ["apply"]),
    artifact("retrospective", ["plan"]),
  ];

  assert.deepEqual(
    Object.fromEntries(resolveImplementationOrdering(artifacts, applyStep(["plan"]))),
    { verify: "declared", retrospective: "derived" },
  );
});

test("resolveImplementationOrdering: a declaration wins over the derivation for the same step", () => {
  const artifacts = [artifact("tasks"), artifact("plan", ["tasks"]), artifact("verify", ["plan", "apply"])];

  assert.equal(resolveImplementationOrdering(artifacts, applyStep(["plan"])).get("verify"), "declared");
});

test("resolveImplementationOrdering: the apply step is matched by identity, not by the name apply", () => {
  // A schema may declare an artifact called `apply`; the phase step is whatever the caller passes.
  const artifacts = [artifact("tasks"), artifact("verify", ["implement"])];

  assert.deepEqual(
    Object.fromEntries(
      resolveImplementationOrdering(artifacts, { id: "implement", requires: ["tasks"] }),
    ),
    { verify: "declared" },
  );
});

test("resolveImplementationOrdering: an artifact of the same name claims the id", () => {
  // superspec's shape: it declares an artifact called `apply`, so `verify.requires: [apply]` names
  // that artifact — a dependency the CLI itself resolves — not the phase. Reading it as the phase
  // would invent an edge the author never wrote, and would do it on the schema most likely to hit
  // this. `verify` still follows implementation here, but by derivation rather than by declaration.
  const artifacts = [
    artifact("tasks"),
    artifact("plan", ["tasks"]),
    artifact("apply", ["plan"]),
    artifact("verify", ["apply"]),
  ];

  assert.deepEqual(
    Object.fromEntries(resolveImplementationOrdering(artifacts, applyStep(["plan"]))),
    { apply: "derived", verify: "derived" },
  );
});

test("resolveImplementationOrdering: a step apply waits on is never given a declared edge back", () => {
  // The CLI rejects a `requires` naming the apply phase, but spek parses schema.yaml directly, so
  // one reaches here. Taken at face value it builds a cycle through apply — and not a contained
  // one: levelling then falls back to positional for the *whole* schema and an edge is drawn
  // running backwards up the diagram. Same exclusion `postApplyArtifacts` already applies.
  const artifacts = [artifact("proposal"), artifact("tasks", ["proposal", "apply"])];

  assert.deepEqual([...resolveImplementationOrdering(artifacts, applyStep(["tasks"]))], []);
});

test("resolveImplementationOrdering: no apply step means no ordering to resolve", () => {
  assert.deepEqual([...resolveImplementationOrdering([artifact("a")], null)], []);
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

// --- transitive reduction (via `drawable`) ---

test("reduction:keeps an edge nothing else implies", () => {
  assert.deepEqual(
    drawable([
      { id: "proposal", requires: [] },
      { id: "specs", requires: ["proposal"] },
    ]),
    { proposal: [], specs: ["proposal"] },
  );
});

test("reduction:drops an edge a longer path already imposes", () => {
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

test("reduction:an implied edge is dropped however long the implying path is", () => {
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

test("reduction:two independent paths to the same step both survive", () => {
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

test("reduction:an entry naming an undeclared step is dropped", () => {
  // There is nothing to draw an edge to.
  assert.deepEqual(drawable([{ id: "specs", requires: ["ghost"] }]), { specs: [] });
});

test("reduction:surviving entries keep their declared order", () => {
  assert.deepEqual(
    drawable([
      { id: "a", requires: [] },
      { id: "b", requires: [] },
      { id: "c", requires: ["b", "a"] },
    ]).c,
    ["b", "a"],
  );
});

test("reduction:a cycle terminates and keeps both edges", () => {
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

test("reduction:levelling still uses the full requires", () => {
  // The property the reduction is only safe under: removing an implied edge never shortens the
  // longest path, so levels are identical either way. Asserted rather than assumed, because a
  // reduction that did move a level would silently reposition steps in the diagram.
  const artifacts = [
    artifact("proposal"),
    artifact("specs", ["proposal"]),
    artifact("verification", ["proposal", "specs"]),
  ];
  const reduced = drawable(artifacts.map((a) => ({ id: a.id, requires: a.requires ?? [] })));
  assert.deepEqual(
    levels(artifacts),
    Object.fromEntries(
      computeArtifactLevels(artifacts.map((a) => artifact(a.id, reduced[a.id] ?? []))),
    ),
  );
});

// --- drawableEdges ---

const drawnEdges = (steps: OriginNode[]): Record<string, string[]> =>
  Object.fromEntries(
    Array.from(drawableEdges(steps), ([id, edges]) => [
      id,
      edges.map((e) => `${e.from}:${e.origin}`).sort(),
    ]),
  );

test("drawableEdges: a derived edge reduces a declared edge the same path implies", () => {
  // `anvil`'s `verify`: it declares `requires: [tasks]` and is derived to follow apply, which also
  // requires `tasks`. `tasks → apply ⇢ verify` carries the dependency, so the direct `tasks → verify`
  // edge is dropped and `verify` keeps one incoming edge, from apply — declared and derived hops
  // count alike in the reduction.
  assert.deepEqual(
    drawnEdges([
      { id: "tasks", incoming: [] },
      { id: "apply", incoming: [{ from: "tasks", origin: "declared" }] },
      {
        id: "verify",
        incoming: [
          { from: "tasks", origin: "declared" },
          { from: "apply", origin: "derived" },
        ],
      },
    ]),
    { tasks: [], apply: ["tasks:declared"], verify: ["apply:derived"] },
  );
});

test("drawableEdges: a derived edge nothing else implies survives", () => {
  // Nothing carries `apply ⇢ verify` but the edge itself, so it is kept — the reduction removes
  // repetition, not the ordering.
  assert.deepEqual(
    drawnEdges([
      { id: "tasks", incoming: [] },
      { id: "apply", incoming: [{ from: "tasks", origin: "declared" }] },
      { id: "verify", incoming: [{ from: "apply", origin: "derived" }] },
    ]),
    { tasks: [], apply: ["tasks:declared"], verify: ["apply:derived"] },
  );
});

test("drawableEdges: a repeated prerequisite collapses to one edge", () => {
  // Two edges from the same source would draw two paths sharing one React key. Deduped.
  assert.deepEqual(
    drawnEdges([
      { id: "a", incoming: [] },
      {
        id: "b",
        incoming: [
          { from: "a", origin: "declared" },
          { from: "a", origin: "declared" },
        ],
      },
    ]),
    { a: [], b: ["a:declared"] },
  );
});

test("drawableEdges: a declared edge wins a same-source tie", () => {
  assert.deepEqual(
    drawnEdges([
      { id: "a", incoming: [] },
      {
        id: "b",
        incoming: [
          { from: "a", origin: "derived" },
          { from: "a", origin: "declared" },
        ],
      },
    ]),
    { a: [], b: ["a:declared"] },
  );
});
