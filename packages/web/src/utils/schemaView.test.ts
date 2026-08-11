import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  SchemaApplyDef,
  SchemaArtifactDef,
  SchemaDegradedReason,
  SchemaSource,
} from "@spekjs/core";
import {
  buildFlowSteps,
  degradedMessage,
  groupIntoLevels,
  isFilePattern,
  schemaCountClaims,
  withArchiveStep,
  schemaUnavailableMessage,
  sourceTitle,
  usageLabel,
} from "./schemaView";
import { SchemaBadge } from "../components/SchemaBadge";
import { fitLabel, layoutGraph, NODE_H, NODE_W, sampleCubicPath } from "./schemaLayout";

function artifact(id: string, over: Partial<SchemaArtifactDef> = {}): SchemaArtifactDef {
  return {
    id,
    generates: `${id}.md`,
    description: null,
    requires: [],
    instruction: null,
    ...over,
  };
}

const APPLY: SchemaApplyDef = {
  requires: ["tasks"],
  tracks: "tasks.md",
  instruction: "Work through the tasks.",
};

// --- flow ordering ---------------------------------------------------------

test("buildFlowSteps: keeps the schema's declared order, never re-sorts", () => {
  const steps = buildFlowSteps(
    [
      artifact("brainstorm"),
      artifact("proposal", { requires: ["brainstorm"] }),
      artifact("plan", { requires: ["proposal"] }),
    ],
    null,
  );
  assert.deepEqual(
    steps.map((s) => s.id),
    ["brainstorm", "proposal", "plan"],
  );
  assert.ok(steps.every((s) => !s.isApply));
});

// The point of levelling: two steps depending on the same prerequisite are NOT 2 and 3. Nothing in
// the schema orders them relative to each other, and numbering them sequentially would claim a
// constraint that does not exist.
test("buildFlowSteps: siblings sharing a prerequisite share a level", () => {
  const steps = buildFlowSteps(
    [
      artifact("proposal"),
      artifact("specs", { requires: ["proposal"] }),
      artifact("design", { requires: ["proposal"] }),
      artifact("tasks", { requires: ["specs", "design"] }),
    ],
    null,
  );
  assert.deepEqual(
    steps.map((s) => [s.id, s.level]),
    [
      ["proposal", 1],
      ["specs", 2],
      ["design", 2],
      ["tasks", 3],
    ],
  );
});

test("buildFlowSteps: a step with no requires is level 1 wherever it is declared", () => {
  const steps = buildFlowSteps(
    [artifact("proposal"), artifact("glossary"), artifact("tasks", { requires: ["proposal"] })],
    null,
  );
  assert.deepEqual(
    steps.map((s) => s.level),
    [1, 1, 2],
  );
});

test("buildFlowSteps: a requires entry the schema does not declare cannot rank, and is ignored", () => {
  const steps = buildFlowSteps([artifact("proposal", { requires: ["nowhere"] })], null);
  assert.equal(steps[0].level, 1);
});

test("buildFlowSteps: a dependency cycle falls back to positional levels rather than looping", () => {
  const steps = buildFlowSteps(
    [
      artifact("a", { requires: ["c"] }),
      artifact("b", { requires: ["a"] }),
      artifact("c", { requires: ["b"] }),
    ],
    null,
  );
  assert.deepEqual(
    steps.map((s) => s.level),
    [1, 2, 3],
  );
});

test("buildFlowSteps: apply is levelled one past what it requires", () => {
  const steps = buildFlowSteps(
    [artifact("proposal"), artifact("tasks", { requires: ["proposal"] })],
    APPLY,
  );
  const apply = steps.find((s) => s.id === "apply");
  assert.ok(apply);
  assert.equal(apply.isApply, true);
  assert.equal(apply.level, 3, "tasks is level 2, so apply is 3");
  assert.deepEqual(apply.requires, ["tasks"]);
  assert.equal(apply.generates, "tasks.md");
  assert.match(apply.description ?? "", /tracked in tasks\.md/);
  assert.equal(apply.instruction, "Work through the tasks.");
});

// Two bugs, one shape. Apply was first forced to deepestOverall + 1, pinning it last whatever it
// required, which pushed it past steps that genuinely come after it. Levelling it from its own
// `requires` fixed that but left `verify` *beside* apply, reading as its peer — which is the
// arrangement superpowers-bridge's runtime precheck exists to stop a reader acting on.
test("buildFlowSteps: post-implementation steps are levelled after apply, not beside it", () => {
  const steps = buildFlowSteps(
    [
      artifact("tasks"),
      artifact("plan", { requires: ["tasks"] }),
      artifact("verify", { requires: ["plan"] }),
      artifact("retrospective", { requires: ["verify"] }),
    ],
    { requires: ["plan"], tracks: "tasks.md", instruction: null },
  );
  const level = (id: string) => steps.find((s) => s.id === id)?.level;

  assert.equal(level("plan"), 2);
  assert.equal(level("apply"), 3, "apply follows plan, which is all it requires");
  assert.equal(level("verify"), 4, "verify needs everything apply needs, and apply needs none of it");
  assert.equal(level("retrospective"), 5);
  assert.ok(
    (level("apply") ?? 0) < (level("verify") ?? 0),
    "apply must not be pinned past steps that come after it, nor share their level",
  );
});

test("buildFlowSteps: the edge from apply to a post-implementation step is marked derived", () => {
  const steps = buildFlowSteps(
    [artifact("tasks"), artifact("plan", { requires: ["tasks"] }), artifact("verify", { requires: ["plan"] })],
    { requires: ["plan"], tracks: "tasks.md", instruction: null },
  );
  const verify = steps.find((s) => s.id === "verify");

  assert.deepEqual(verify?.incoming, [
    { from: "plan", origin: "declared" },
    { from: "apply", origin: "derived" },
  ]);
  // The declared `requires` is untouched — it is what the schema says, and the detail region and
  // tooltip name it. Only the drawn graph gained the connection.
  assert.deepEqual(verify?.requires, ["plan"]);
});

test("buildFlowSteps: a derived edge is not repeated down a chain that already implies it", () => {
  // superpowers-bridge. Both `verify` and `retrospective` follow implementation, but retrospective
  // gets there through verify, so an apply-to-retrospective edge states nothing new. Keeping it
  // drew a second dashed edge and repeated the "spek placed this here" explanation on a step whose
  // position is a consequence of verify's, not an inference of its own.
  const steps = buildFlowSteps(
    [
      artifact("tasks"),
      artifact("plan", { requires: ["tasks"] }),
      artifact("verify", { requires: ["plan"] }),
      artifact("retrospective", { requires: ["verify"] }),
    ],
    { requires: ["plan"], tracks: "tasks.md", instruction: null },
  );
  const derivedFrom = (id: string) =>
    steps.find((s) => s.id === id)?.incoming.filter((e) => e.origin === "derived") ?? [];

  assert.deepEqual(derivedFrom("verify"), [{ from: "apply", origin: "derived" }]);
  assert.deepEqual(derivedFrom("retrospective"), [], "already reached through verify");
  // Still after implementation — the edge went, the ordering did not.
  const level = (id: string) => steps.find((s) => s.id === id)?.level ?? 0;
  assert.ok(level("retrospective") > level("verify") && level("verify") > level("apply"));
});

test("buildFlowSteps: two steps that independently follow apply each keep their edge", () => {
  // The other side of the rule. Neither `verify` nor `audit` reaches apply through the other, so
  // each states something the graph does not otherwise say and each is drawn and explained.
  const steps = buildFlowSteps(
    [
      artifact("tasks"),
      artifact("plan", { requires: ["tasks"] }),
      artifact("verify", { requires: ["plan"] }),
      artifact("audit", { requires: ["plan"] }),
    ],
    { requires: ["plan"], tracks: "tasks.md", instruction: null },
  );
  const derivedFrom = (id: string) =>
    steps.find((s) => s.id === id)?.incoming.filter((e) => e.origin === "derived") ?? [];

  assert.deepEqual(derivedFrom("verify"), [{ from: "apply", origin: "derived" }]);
  assert.deepEqual(derivedFrom("audit"), [{ from: "apply", origin: "derived" }]);
});

// The forward path. OpenSpec is deciding where phase configuration lives (#1456); if a schema gains
// a way to state this ordering, it must arrive as an ordinary declared edge — no derived marking,
// no closure rule consulted. This is the assertion that catches it if the two ever get coupled.
test("buildFlowSteps: an ordering the schema states is drawn as declared, not derived", () => {
  const steps = buildFlowSteps(
    [
      artifact("tasks"),
      // Names the apply phase directly — the shape a legalised declaration would take. The closure
      // rule would not find this one: `verify` requires nothing apply requires.
      artifact("verify", { requires: ["apply"] }),
    ],
    { requires: ["tasks"], tracks: "tasks.md", instruction: null },
  );
  const verify = steps.find((s) => s.id === "verify");
  const apply = steps.find((s) => s.isApply);

  assert.deepEqual(verify?.incoming, [{ from: "apply", origin: "declared" }]);
  assert.ok((verify?.level ?? 0) > (apply?.level ?? 0), "declared or derived, it still follows apply");
});

test("buildFlowSteps: a schema declaring an artifact named apply keeps both steps", () => {
  // superspec's shape. Keyed by declared id alone, one silently replaced the other.
  const steps = buildFlowSteps(
    [artifact("plan"), artifact("apply", { requires: ["plan"] })],
    { requires: ["plan"], tracks: "tasks.md", instruction: null },
  );

  assert.equal(steps.length, 3, "two declared artifacts plus the apply phase");
  assert.equal(new Set(steps.map((s) => s.key)).size, 3, "every step has its own key");
  assert.deepEqual(
    steps.filter((s) => s.id === "apply").map((s) => s.isApply),
    [false, true],
    "the declared artifact and the phase are distinct steps sharing a displayed id",
  );

  // The declared artifact keeps the plain key, because it claimed it first.
  const declaredApply = steps.find((s) => s.id === "apply" && !s.isApply);
  const phase = steps.find((s) => s.isApply);
  assert.equal(declaredApply?.key, "apply");
  assert.notEqual(phase?.key, "apply");

  // And it is itself derived to follow the phase, which is right: in superspec the declared `apply`
  // artifact is an implementation receipt, written once the phase has run. The edge points at the
  // phase's key, so the artifact does not end up depending on itself.
  assert.deepEqual(declaredApply?.incoming, [
    { from: "plan", origin: "declared" },
    { from: phase?.key, origin: "derived" },
  ]);
  assert.ok((declaredApply?.level ?? 0) > (phase?.level ?? 0));
});

test("buildFlowSteps: apply requiring nothing the schema declares goes last", () => {
  const steps = buildFlowSteps(
    [artifact("proposal"), artifact("tasks", { requires: ["proposal"] })],
    { requires: ["nowhere"], tracks: null, instruction: null },
  );
  const apply = steps.find((s) => s.id === "apply");
  assert.equal(apply?.level, 3, "nothing to anchor to, so past the deepest artifact");
});

test("buildFlowSteps: apply with no tracked file still describes itself", () => {
  const steps = buildFlowSteps([], { requires: [], tracks: null, instruction: null });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].generates, null);
  assert.doesNotMatch(steps[0].description ?? "", /tracked in/);
});

test("buildFlowSteps: a schema with no steps at all yields none", () => {
  assert.deepEqual(buildFlowSteps([], null), []);
});

test("buildFlowSteps: carries each artifact's own requires and instruction", () => {
  const steps = buildFlowSteps(
    [
      artifact("proposal"),
      artifact("tasks", {
        requires: ["specs", "design"],
        instruction: "Break the work down.",
        description: "Checklist",
      }),
    ],
    null,
  );
  assert.deepEqual(steps[1].requires, ["specs", "design"]);
  assert.equal(steps[1].instruction, "Break the work down.");
  assert.equal(steps[1].description, "Checklist");
});

// --- level grouping --------------------------------------------------------

const SPEC_DRIVEN: SchemaArtifactDef[] = [
  artifact("proposal"),
  artifact("specs", { requires: ["proposal"] }),
  artifact("design", { requires: ["proposal"] }),
  artifact("tasks", { requires: ["specs", "design"] }),
];

test("groupIntoLevels: one row per level, parallel steps sharing a row", () => {
  const rows = groupIntoLevels(buildFlowSteps(SPEC_DRIVEN, APPLY));
  assert.deepEqual(
    rows.map((r) => [r.level, r.steps.map((s) => s.id)]),
    [
      [1, ["proposal"]],
      [2, ["specs", "design"]],
      [3, ["tasks"]],
      [4, ["apply"]],
    ],
  );
});

test("groupIntoLevels: declared order is preserved within a level", () => {
  const rows = groupIntoLevels(
    buildFlowSteps(
      [
        artifact("proposal"),
        artifact("design", { requires: ["proposal"] }),
        artifact("specs", { requires: ["proposal"] }),
      ],
      null,
    ),
  );
  assert.deepEqual(rows[1].steps.map((s) => s.id), ["design", "specs"]);
});

// Grouping is a deliberate departure from declared order: an unconstrained artifact declared last
// still belongs in the first row, because nothing requires it.
test("groupIntoLevels: an unconstrained step declared last moves up to its level", () => {
  const rows = groupIntoLevels(
    buildFlowSteps(
      [
        artifact("proposal"),
        artifact("tasks", { requires: ["proposal"] }),
        artifact("glossary"),
      ],
      null,
    ),
  );
  assert.deepEqual(
    rows.map((r) => [r.level, r.steps.map((s) => s.id)]),
    [
      [1, ["proposal", "glossary"]],
      [2, ["tasks"]],
    ],
  );
});

test("groupIntoLevels: no steps yields no rows", () => {
  assert.deepEqual(groupIntoLevels([]), []);
});

test("groupIntoLevels: apply occupies the last row when nothing follows it", () => {
  const rows = groupIntoLevels(buildFlowSteps(SPEC_DRIVEN, APPLY));
  const last = rows[rows.length - 1];
  assert.deepEqual(last.steps.map((s) => s.id), ["apply"]);
  assert.ok(last.steps.every((s) => s.isApply));
});

// --- file patterns ---------------------------------------------------------

// A declared artifact count is exact; the file count is not. `specs/**/*.md` is one artifact that
// produces one file per delta the change needs.
test("isFilePattern: any glob is a pattern, a named file is not", () => {
  assert.equal(isFilePattern("specs/**/*.md"), true);
  assert.equal(isFilePattern("specs/*.md"), true);
  assert.equal(isFilePattern("*.md"), true);
  assert.equal(isFilePattern("proposal.md"), false);
  assert.equal(isFilePattern("docs/design.md"), false);
  assert.equal(isFilePattern(null), false);
});

// --- degradation copy ------------------------------------------------------

test("degradedMessage: every reason gets its own wording", () => {
  const reasons: SchemaDegradedReason[] = [
    "cli-unavailable",
    "cli-timeout",
    "cli-failed",
    "cli-unparsable",
  ];
  const messages = reasons.map(degradedMessage);
  assert.equal(new Set(messages).size, reasons.length, "no two reasons may share wording");
  // The one the user can act on says so.
  assert.match(degradedMessage("cli-unavailable"), /not available/);

  // None of them may promise a fallback. The list comes from the CLI alone, including for the
  // repo's own openspec/schemas/, so a degraded catalog is empty — copy claiming that "only this
  // repo's own schemas are shown" sat directly above an empty-state reading "no schemas found".
  for (const message of messages) {
    assert.doesNotMatch(message, /own schemas are shown/i, message);
  }
});

test("schemaUnavailableMessage: not-found and cli-unavailable read differently", () => {
  const notFound = schemaUnavailableMessage("not-found", "ghost");
  const unavailable = schemaUnavailableMessage("cli-unavailable", "ghost");

  assert.match(notFound, /No schema named "ghost"/);
  assert.doesNotMatch(notFound, /CLI/, "a missing schema must not blame the CLI");

  assert.match(unavailable, /OpenSpec CLI is not available/);
  assert.match(unavailable, /[Ii]nstalling it/, "says what would fix it");
  // Not "if it is a built-in schema": names resolve through the CLI whatever their source, so a
  // schema in this very repo is equally unreadable without it.
  assert.doesNotMatch(unavailable, /built-in/);
  assert.notEqual(notFound, unavailable);
});

test("schemaUnavailableMessage: names the schema in every case", () => {
  for (const reason of ["not-found", "cli-unavailable", "cli-timeout", "cli-failed", "cli-unparsable"] as const) {
    assert.match(schemaUnavailableMessage(reason, "house-style"), /house-style/, reason);
  }
});

// --- what the list may claim about the repo --------------------------------

test("schemaCountClaims: a successful enumeration counts, and says so when it found nothing", () => {
  assert.deepEqual(schemaCountClaims(3, null), { showCount: true, showEmptyState: false });
  assert.deepEqual(schemaCountClaims(0, null), { showCount: true, showEmptyState: true });
  assert.deepEqual(schemaCountClaims(0, undefined), { showCount: true, showEmptyState: true });
});

// Both are claims about the repo, and a degraded enumeration has not established one — the list is
// empty because we could not look. They are asserted together because that is how they broke: the
// empty state read "No workflow schemas were found for this repo." directly beneath "Schemas could
// not be listed...", and "0 schemas" made the same claim a few lines up in a smaller font.
test("schemaCountClaims: a degraded enumeration claims nothing about the repo", () => {
  for (const reason of ["cli-unavailable", "cli-timeout", "cli-failed", "cli-unparsable"] as const) {
    assert.deepEqual(
      schemaCountClaims(0, reason),
      { showCount: false, showEmptyState: false },
      reason,
    );
  }
});

// --- usage label -----------------------------------------------------------

// "active" is load-bearing: the count comes from active changes only, so a bare "1 change" would
// read as the total including archived ones.
test("usageLabel: singular, plural, and none — all say active", () => {
  assert.equal(usageLabel(0), "No active changes");
  assert.equal(usageLabel(1), "1 active change");
  assert.equal(usageLabel(2), "2 active changes");
});

// --- badge linking ---------------------------------------------------------

test("SchemaBadge: links to the schema's detail page", () => {
  const el = SchemaBadge({ schema: "house-style", defaultSchema: "spec-driven" });
  assert.ok(el);
  assert.notEqual(el.type, "span", "expected a Link, not a span");
  assert.equal(el.props.to, "/schemas/house-style");
  assert.equal(el.props.children, "house-style");
});

// It links even when the name resolves to nothing installed. The detail page answers with "no
// schema named X was found for this repo" — which is the answer a reader seeing an unfamiliar
// badge is looking for, not a dead end.
test("SchemaBadge: links a name that may not resolve, rather than going inert", () => {
  const el = SchemaBadge({ schema: "ghost", defaultSchema: "spec-driven" });
  assert.ok(el);
  assert.equal(el.props.to, "/schemas/ghost");
});

test("SchemaBadge: escapes a name that needs it", () => {
  const el = SchemaBadge({ schema: "a b/c", defaultSchema: "spec-driven" });
  assert.ok(el);
  assert.equal(el.props.to, "/schemas/a%20b%2Fc");
});

test("SchemaBadge: hiding still wins over linking", () => {
  // Equal to the repo default → hidden. A pill means "not the default", so the default gets none.
  assert.equal(SchemaBadge({ schema: "spec-driven", defaultSchema: "spec-driven" }), null);
});

// It must lift above the stretched row link that covers the whole card on the changes list and the
// dashboard; without this the row's overlay swallows the click and the badge is decorative.
test("SchemaBadge: stays above a stretched row overlay", () => {
  const el = SchemaBadge({ schema: "house-style", defaultSchema: "spec-driven" });
  assert.ok(el);
  assert.match(el.props.className, /\brelative\b/);
  assert.match(el.props.className, /\bz-10\b/);
});

// --- diagram layout --------------------------------------------------------

test("layoutGraph: levels descend, and a node sits above the mean of its children", () => {
  const levels = groupIntoLevels(buildFlowSteps(SPEC_DRIVEN, APPLY));
  const { nodes, width, height } = layoutGraph(levels);

  assert.equal(nodes.length, 5, "four artifacts plus apply");

  const rowY = (id: string) => nodes.find((n) => n.step.id === id)?.y;
  assert.equal(rowY("specs"), rowY("design"), "same level shares a row");
  assert.ok((rowY("proposal") ?? 0) < (rowY("specs") ?? 0), "levels descend");
  assert.ok((rowY("tasks") ?? 0) < (rowY("apply") ?? 0));

  // `proposal` feeds both `specs` and `design`, so barycentre placement puts it above their mean.
  const proposal = nodes.find((n) => n.step.id === "proposal");
  const specs = nodes.find((n) => n.step.id === "specs");
  const design = nodes.find((n) => n.step.id === "design");
  assert.ok(proposal && specs && design);
  const pairCentre = (specs.x + design.x + NODE_W) / 2;
  assert.equal(proposal.x + NODE_W / 2, pairCentre);

  assert.ok(width > 0 && height > 0);
});

test("layoutGraph: an edge per resolvable requires entry", () => {
  const { edges } = layoutGraph(groupIntoLevels(buildFlowSteps(SPEC_DRIVEN, APPLY)));
  const pairs = edges.map((e) => `${e.from}->${e.to}`).sort();
  assert.deepEqual(pairs, [
    "design->tasks",
    "proposal->design",
    "proposal->specs",
    "specs->tasks",
    "tasks->apply",
  ]);
  assert.ok(edges.every((e) => e.path.startsWith("M ")));
});

test("layoutGraph: a requires entry with no node draws no edge", () => {
  const { edges } = layoutGraph(
    groupIntoLevels(buildFlowSteps([artifact("proposal", { requires: ["nowhere"] })], null)),
  );
  assert.deepEqual(edges, []);
});

test("layoutGraph: nothing to lay out is empty, not a zero-size crash", () => {
  assert.deepEqual(layoutGraph([]), { nodes: [], edges: [], width: 0, height: 0 });
});

test("fitLabel: leaves short labels alone and ellipsises long ones", () => {
  assert.equal(fitLabel("tasks", 100, 12), "tasks");
  const cut = fitLabel("a-very-long-artifact-identifier-indeed", 60, 10);
  assert.ok(cut.endsWith("…"));
  assert.ok(cut.length < "a-very-long-artifact-identifier-indeed".length);
});

// A level-skipping edge drawn straight would pass through whatever sits in the level between,
// reading as a dependency that does not exist. superpowers-bridge is the real case: `design`
// (level 2) feeds `tasks` (level 4), and `specs` sits at level 3 in between.
const BRIDGE_SHAPE: SchemaArtifactDef[] = [
  artifact("brainstorm"),
  artifact("proposal", { requires: ["brainstorm"] }),
  artifact("design", { requires: ["brainstorm"] }),
  artifact("specs", { requires: ["proposal"] }),
  artifact("tasks", { requires: ["specs", "design"] }),
];

test("layoutGraph: an edge skipping a level never touches the node it passes", () => {
  const levels = groupIntoLevels(buildFlowSteps(BRIDGE_SHAPE, null));
  const { nodes, edges } = layoutGraph(levels);

  const specs = nodes.find((n) => n.step.id === "specs");
  const skipping = edges.find((e) => e.from === "design" && e.to === "tasks");
  assert.ok(specs && skipping);

  // Assert against the points the curve actually passes through, not its control points. A cubic
  // only touches its controls, so control-point clearance is no evidence at all — that is exactly
  // how the first version shipped clipping the lower corner of `specs`.
  for (const [x, y] of sampleCubicPath(skipping.path)) {
    const insideX = x > specs.x && x < specs.x + NODE_W;
    const insideY = y > specs.y && y < specs.y + NODE_H;
    assert.ok(
      !(insideX && insideY),
      `curve passes through specs at (${x.toFixed(1)}, ${y.toFixed(1)})`,
    );
  }
});

test("layoutGraph: a bypass is one smooth curve, not an elbow with a straight lane", () => {
  const { edges } = layoutGraph(groupIntoLevels(buildFlowSteps(BRIDGE_SHAPE, null)));
  const skipping = edges.find((e) => e.from === "design" && e.to === "tasks");
  assert.ok(skipping);
  // A single cubic: one M, one C, no line segments. Mixing an angular route in among curved edges
  // is what made it read as bolted on.
  assert.doesNotMatch(skipping.path, / L /, "a bypass must not contain a straight segment");
  assert.equal(skipping.path.match(/C/g)?.length, 1, "a bypass is a single cubic");
});

test("layoutGraph: placement avoids the obstruction, so no detour is drawn", () => {
  // The point of barycentre placement. `specs` has one parent (`proposal`) and belongs under it;
  // centring its row instead dragged it into the middle, directly under `design → tasks`, and that
  // edge then had to bow around a node it has no relationship with. Placed properly, nothing is in
  // the way and the edge is a plain S-curve.
  const { nodes, edges } = layoutGraph(groupIntoLevels(buildFlowSteps(BRIDGE_SHAPE, null)));
  const specs = nodes.find((n) => n.step.id === "specs");
  const proposal = nodes.find((n) => n.step.id === "proposal");
  const skipping = edges.find((e) => e.from === "design" && e.to === "tasks");
  assert.ok(specs && proposal && skipping);

  assert.equal(specs.x, proposal.x, "specs sits under its only parent");

  // Control points share their endpoints' x — the signature of an undetoured curve.
  const nums = skipping.path.match(/-?[\d.]+/g)?.map(Number) ?? [];
  const [x0, , cx1, , cx2, , x3] = nums;
  assert.equal(cx1, x0, "no sideways pull at the start");
  assert.equal(cx2, x3, "no sideways pull at the end");
});

test("layoutGraph: an adjacent-level edge stays a straight drop", () => {
  const { edges } = layoutGraph(groupIntoLevels(buildFlowSteps(BRIDGE_SHAPE, null)));
  const direct = edges.find((e) => e.from === "proposal" && e.to === "specs");
  assert.ok(direct);
  // Control points share the endpoints' x — no bowing when there is nothing to route around.
  const controls = direct.path.match(/M ([\d.-]+) [\d.-]+ C ([\d.-]+) /);
  assert.ok(controls);
  assert.equal(controls[1], controls[2]);
});

/**
 * Two chains converging asymmetrically — the one shape found that still forces a bow.
 *
 * It matters that a fixture exists at all: the diagram draws the transitive reduction, and an edge
 * only survives that when nothing sits on an alternate path between its ends, which is largely the
 * same condition under which barycentre placement leaves it geometrically clear. Measured across
 * every test fixture and all twelve real schemas on hand, **no edge bows**. Without this shape the
 * whole bypass search — `findBow`, `curveClears`, the LANE_* constants — would be guarded by
 * nothing, and a regression in it would ship silently.
 */
const BOWING_SHAPE: SchemaArtifactDef[] = [
  artifact("a"),
  artifact("b"),
  artifact("c", { requires: ["a"] }),
  artifact("d", { requires: ["b"] }),
  artifact("e", { requires: ["c"] }),
  artifact("f", { requires: ["b", "e"] }),
];

/** Control points offset from the endpoints' x — i.e. the edge was routed around something. */
function isBowed(path: string): boolean {
  const n = path.match(/-?[\d.]+/g)!.map(Number);
  return Math.abs(n[2] - n[0]) > 1 || Math.abs(n[4] - n[6]) > 1;
}

const laneReserve = (layout: { nodes: { x: number }[]; width: number }) =>
  layout.width -
  (Math.max(...layout.nodes.map((n) => n.x + NODE_W)) - Math.min(...layout.nodes.map((n) => n.x)));

test("layoutGraph: an edge with nothing implying it still bows", () => {
  const { edges } = layoutGraph(groupIntoLevels(buildFlowSteps(BOWING_SHAPE, null)));

  assert.deepEqual(
    edges.filter((e) => isBowed(e.path)).map((e) => `${e.from}->${e.to}`),
    ["b->f"],
    "this fixture exists to keep the bypass search reachable",
  );

  // Clearance is asserted on BRIDGE_SHAPE, not here, and deliberately: on this shape the search
  // runs out of room. `findBow` tries widths up to LANE_MAX and returns that cap when none clears,
  // so `b->f` still clips `d`. Recorded rather than hidden — it is a real limit of the search, and
  // no schema in the wild produces this shape (measured across twelve).
});

test("layoutGraph: lane is reserved only when an edge actually bows", () => {
  const bowing = layoutGraph(groupIntoLevels(buildFlowSteps(BOWING_SHAPE, null)));
  const straight = layoutGraph(groupIntoLevels(buildFlowSteps(SPEC_DRIVEN, APPLY)));

  // Compared as *reserve*, not raw width: the old form compared two whole diagrams and passed
  // because one simply had a wider row, which it would have done with no bow at all.
  assert.ok(laneReserve(bowing) > laneReserve(straight), "a bowing graph reserves lane, a flat one does not");
  assert.equal(laneReserve(straight), 16, "no bow, so nothing beyond the 8px padding either side");
});

/**
 * `super-spec-driven`'s shape: a chain whose later steps also declare the earlier ones they already
 * depend on transitively.
 */
const SINGLE_COLUMN_WITH_SHORTCUTS: SchemaArtifactDef[] = [
  artifact("brainstorm"),
  artifact("proposal", { requires: ["brainstorm"] }),
  artifact("specs", { requires: ["proposal"] }),
  artifact("design", { requires: ["proposal", "specs"] }),
  artifact("plan", { requires: ["specs", "design"] }),
  artifact("tasks", { requires: ["plan"] }),
];

/**
 * The diagram draws the transitive reduction.
 *
 * `design` declares `proposal` and `specs`; `specs` already requires `proposal`, so the direct edge
 * repeats what the chain says. Drawn, it was worse than redundant — it detoured around the very node
 * that implies it, and produced the tangle this fixture is named for. Every bypass curve across the
 * eleven community schemas surveyed was one of these.
 */
test("layoutGraph: a requires already implied by a longer path is not drawn", () => {
  const steps = buildFlowSteps(SINGLE_COLUMN_WITH_SHORTCUTS, APPLY);
  const { edges } = layoutGraph(groupIntoLevels(steps));
  const drawn = edges.map((e) => `${e.from}->${e.to}`).sort();

  assert.deepEqual(drawn, [
    "brainstorm->proposal",
    "design->plan",
    "plan->tasks",
    "proposal->specs",
    "specs->design",
    "tasks->apply",
  ]);

  // The step itself still declares both — only the picture leaves the implied one out, because the
  // panel is where an exact answer belongs.
  const design = steps.find((s) => s.id === "design");
  assert.deepEqual(design?.requires, ["proposal", "specs"]);
});


/** A shortcut nothing else implies is still drawn — the reduction removes repetition, not structure. */
test("layoutGraph: a level-skipping edge with no implying path is kept", () => {
  const { edges } = layoutGraph(groupIntoLevels(buildFlowSteps(BRIDGE_SHAPE, null)));
  const drawn = edges.map((e) => `${e.from}->${e.to}`);
  assert.ok(drawn.includes("design->tasks"), `expected design->tasks in ${drawn.join(", ")}`);
});

test("layoutGraph: edges converging on one node meet it at different points", () => {
  const { nodes, edges } = layoutGraph(groupIntoLevels(buildFlowSteps(BRIDGE_SHAPE, null)));
  const tasks = nodes.find((n) => n.step.id === "tasks");
  assert.ok(tasks);

  // Both `specs` and `design` feed `tasks`. Landing them on the same point stacks two arrowheads
  // at different angles on top of each other.
  const arrivals = edges
    .filter((e) => e.to === "tasks")
    .map((e) => sampleCubicPath(e.path).at(-1)?.[0] ?? NaN);
  assert.equal(arrivals.length, 2);
  assert.notEqual(arrivals[0], arrivals[1], "converging edges must not share an entry point");
  for (const x of arrivals) {
    assert.ok(x > tasks.x && x < tasks.x + NODE_W, `entry ${x} must be on the node's edge`);
  }
});

test("layoutGraph: edges leaving one node depart from different points", () => {
  const { nodes, edges } = layoutGraph(groupIntoLevels(buildFlowSteps(BRIDGE_SHAPE, null)));
  const brainstorm = nodes.find((n) => n.step.id === "brainstorm");
  assert.ok(brainstorm);

  const departures = edges
    .filter((e) => e.from === "brainstorm")
    .map((e) => sampleCubicPath(e.path)[0]?.[0] ?? NaN);
  assert.equal(departures.length, 2);
  assert.notEqual(departures[0], departures[1]);
});

test("layoutGraph: a lone edge still meets the node centre", () => {
  const { nodes, edges } = layoutGraph(
    groupIntoLevels(
      buildFlowSteps([artifact("proposal"), artifact("tasks", { requires: ["proposal"] })], null),
    ),
  );
  const tasks = nodes.find((n) => n.step.id === "tasks");
  const only = edges[0];
  assert.ok(tasks && only);
  assert.equal(sampleCubicPath(only.path).at(-1)?.[0], tasks.x + NODE_W / 2);
});

test("layoutGraph: the flow is horizontally centred in the diagram", () => {
  // Bypass lanes are reserved on both flanks even when only one carries a bow, so the node column
  // stays centred. superpowers-bridge bows right only; padding one side left it visibly adrift.
  for (const shape of [BRIDGE_SHAPE, SPEC_DRIVEN]) {
    const { nodes, width } = layoutGraph(groupIntoLevels(buildFlowSteps(shape, APPLY)));
    const leftGap = Math.min(...nodes.map((n) => n.x));
    const rightGap = width - Math.max(...nodes.map((n) => n.x + NODE_W));
    assert.equal(leftGap, rightGap, "equal air either side of the node column");
  }
});

test("layoutGraph: lane reserve is measured from the curve, not from the bow", () => {
  // Must be a shape that bows, or this asserts nothing: BRIDGE_SHAPE reserved exactly 2xPAD, so the
  // old version of this test passed without a lane ever being reserved.
  const reserve = laneReserve(layoutGraph(groupIntoLevels(buildFlowSteps(BOWING_SHAPE, null))));
  assert.ok(reserve > 16, "this fixture must actually bow");
  // A cubic reaches only ~60% of its control offset, so reserving the bow itself (up to LANE_MAX +
  // margin, each side) would take far more than sampling the drawn curve does.
  assert.ok(reserve < 88 + 8 + 16, `reserved ${reserve}px, close to the worst case it avoids`);
});

// --- archive ---------------------------------------------------------------

test("withArchiveStep: appends a terminal stage past everything else", () => {
  const steps = withArchiveStep(buildFlowSteps(SPEC_DRIVEN, APPLY));
  const archive = steps.find((s) => s.id === "archive");
  assert.ok(archive);
  assert.equal(archive.isArchive, true);
  assert.equal(archive.isApply, false);
  assert.ok(
    archive.level > Math.max(...steps.filter((s) => !s.isArchive).map((s) => s.level)),
    "archive is past every declared step",
  );
});

test("withArchiveStep: depends on every leaf, not just the last step", () => {
  // Two leaves that do not feed each other: `glossary` is unconstrained and nothing requires it, so
  // a change is only archivable once both it and the apply step are done.
  const steps = withArchiveStep(
    buildFlowSteps(
      [artifact("tasks"), artifact("glossary")],
      { requires: ["tasks"], tracks: "tasks.md", instruction: null },
    ),
  );
  const archive = steps.find((s) => s.id === "archive");
  assert.ok(archive);
  assert.deepEqual([...archive.requires].sort(), ["apply", "glossary"]);
});

test("withArchiveStep: a step derived to follow apply makes apply no longer a leaf", () => {
  // superpowers-bridge's shape. Archive used to depend on `apply` *and* `retrospective`, because
  // nothing required apply. Once `verify` follows it, apply feeds something and drops out — a
  // consequence of the leaf rule rather than a change to it.
  const steps = withArchiveStep(
    buildFlowSteps(
      [
        artifact("tasks"),
        artifact("plan", { requires: ["tasks"] }),
        artifact("verify", { requires: ["plan"] }),
        artifact("retrospective", { requires: ["verify"] }),
      ],
      { requires: ["plan"], tracks: "tasks.md", instruction: null },
    ),
  );
  const archive = steps.find((s) => s.id === "archive");
  assert.ok(archive);
  assert.deepEqual(archive.requires, ["retrospective"]);
});

test("withArchiveStep: carries no schema content, because a schema declares none", () => {
  const archive = withArchiveStep(buildFlowSteps(SPEC_DRIVEN, APPLY)).find((s) => s.isArchive);
  assert.ok(archive);
  assert.equal(archive.instruction, null, "no schema instruction exists for archiving");
  assert.equal(archive.generates, null, "archiving produces no declared artifact");
});

test("withArchiveStep: a schema with no steps gets no archive step either", () => {
  assert.deepEqual(withArchiveStep(buildFlowSteps([], null)), []);
});

test("withArchiveStep: leaves the declared steps untouched", () => {
  const declared = buildFlowSteps(SPEC_DRIVEN, APPLY);
  const withArchive = withArchiveStep(declared);
  assert.deepEqual(withArchive.slice(0, declared.length), declared);
  assert.equal(withArchive.filter((s) => s.isArchive).length, 1);
});

// --- schema sources --------------------------------------------------------

// The OpenSpec resolver has three sources, not two: project, user (a machine-global directory),
// then package. `user` was missing from the type at first, which made the enumeration drop such a
// schema entirely rather than mislabel it.
test("sourceTitle: every source is explained, none falls through", () => {
  const sources: SchemaSource[] = ["project", "user", "package"];
  const titles = sources.map(sourceTitle);
  assert.equal(new Set(titles).size, sources.length, "each source reads differently");
  assert.ok(titles.every((t) => t.length > 0 && !t.includes("undefined")));
  assert.match(sourceTitle("user"), /machine/i, "a user schema is machine-level, not repo-level");
  assert.doesNotMatch(sourceTitle("user"), /shipped/i, "and it is not shipped with OpenSpec");
});
