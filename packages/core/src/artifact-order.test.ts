import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangeArtifact } from "./types.js";
import {
  ARTIFACT_SORT_MODES,
  DEFAULT_ORDER,
  defaultRank,
  sortArtifacts,
} from "./artifact-order.js";

function art(id: string, title?: string): ChangeArtifact {
  return { id, title: title ?? id, kind: "markdown", content: "" };
}

const ids = (arts: ChangeArtifact[]) => arts.map((a) => a.id);

test("DEFAULT_ORDER is the spec-driven narrative sequence", () => {
  assert.deepEqual(DEFAULT_ORDER, ["proposal", "design", "specs", "tasks"]);
});

test("defaultRank ranks by position, and puts unknown ids last", () => {
  assert.equal(defaultRank("proposal"), 0);
  assert.equal(defaultRank("tasks"), 3);
  assert.equal(defaultRank("brainstorm"), Number.POSITIVE_INFINITY);
});

test("ARTIFACT_SORT_MODES lists every mode sortArtifacts accepts", () => {
  // The type is derived from this array, so the two cannot disagree — what this pins is the
  // content: a mode dropped here is a mode consumers can no longer restore from storage.
  assert.deepEqual([...ARTIFACT_SORT_MODES], ["modified", "schema", "alpha"]);
  const arts = [art("proposal"), art("tasks")];
  for (const mode of ARTIFACT_SORT_MODES) {
    assert.deepEqual(ids(sortArtifacts(arts, mode)).sort(), ["proposal", "tasks"]);
  }
});

test("modified: returns artifacts in the delivered order", () => {
  const arts = [art("tasks"), art("design"), art("proposal")];
  assert.deepEqual(ids(sortArtifacts(arts, "modified")), ["tasks", "design", "proposal"]);
});

test("modified: preserves the input order and leaves the input untouched", () => {
  const arts = [art("tasks"), art("proposal")];
  const out = sortArtifacts(arts, "modified");
  assert.deepEqual(ids(out), ["tasks", "proposal"]);
  // Returning the input array itself is permitted, not promised (the contract is that callers
  // must not mutate what they get back). This pins today's no-copy behavior.
  assert.equal(out, arts);
});

test("alpha: sorts by display title A–Z (not by id or default order)", () => {
  // ids are deliberately ordered opposite to titles, so passing this REQUIRES sorting by
  // title — id order or the default narrative order would produce a different result.
  const arts = [art("c", "Apple"), art("a", "Mango"), art("b", "Zebra")];
  assert.deepEqual(ids(sortArtifacts(arts, "alpha")), ["c", "a", "b"]);
});

test("alpha: equal titles break the tie deterministically by id", () => {
  // two files that humanize to the same display title must sort the same regardless of
  // input order — i.e. not depend on engine sort stability. The id tiebreak guarantees this.
  const a = art("my-plan", "My Plan");
  const b = art("my_plan", "My Plan");
  const forward = ids(sortArtifacts([a, b], "alpha"));
  const reversed = ids(sortArtifacts([b, a], "alpha"));
  assert.deepEqual(forward, reversed);
});

test("alpha: the tiebreak is the id, not some other field", () => {
  // Agreement between input orders (above) also holds for a tiebreak on any constant field, so
  // pin that it is the id — with ids whose relative order no collation disputes.
  //
  // Deliberately NOT `my-plan` vs `my_plan`: ICU orders `my_plan` first, the opposite of what the
  // codepoints suggest, and that ordering is a property of the host's collation rather than of this
  // function. Asserting it would make the test fail on a small-icu build for a reason that is not a bug.
  const arts = [art("b-plan", "My Plan"), art("a-plan", "My Plan")];
  assert.deepEqual(ids(sortArtifacts(arts, "alpha")), ["a-plan", "b-plan"]);
});

test("schema: orders by schemaOrder", () => {
  const arts = [art("proposal"), art("brainstorm"), art("plan")];
  const out = sortArtifacts(arts, "schema", ["brainstorm", "proposal", "plan"]);
  assert.deepEqual(ids(out), ["brainstorm", "proposal", "plan"]);
});

test("schema: artifacts absent from schemaOrder are appended in default narrative order", () => {
  // `apple` sorts before `design` alphabetically, but `design` outranks it in the default
  // narrative order — so this only passes if DEFAULT_ORDER (not plain alpha) breaks the tie.
  const arts = [art("tasks"), art("apple"), art("proposal"), art("design")];
  const out = sortArtifacts(arts, "schema", ["proposal", "tasks"]);
  // matched first (proposal, tasks), then unmatched by DEFAULT_ORDER: design (ranked) before apple (alpha)
  assert.deepEqual(ids(out), ["proposal", "tasks", "design", "apple"]);
});

test("schema: absent schemaOrder falls back to narrative order, not the delivered order", () => {
  // The artifacts arrive in recency order — the one written last is first — which is exactly the
  // order the fallback must overturn. Reversing the input would also produce this result, so the
  // input is not a straight reversal of the expectation.
  const arts = [art("tasks"), art("specs", "Specs"), art("design"), art("proposal")];
  const out = sortArtifacts(arts, "schema", undefined);
  assert.deepEqual(ids(out), ["proposal", "design", "specs", "tasks"]);
});

test("schema: null schemaOrder falls back to default narrative order", () => {
  const arts = [art("zebra"), art("tasks"), art("apple"), art("proposal"), art("specs", "Specs")];
  const out = sortArtifacts(arts, "schema", undefined);
  assert.deepEqual(ids(out), ["proposal", "specs", "tasks", "apple", "zebra"]);
});

test("schema: empty schemaOrder falls back to default narrative order", () => {
  const arts = [art("tasks"), art("proposal")];
  const out = sortArtifacts(arts, "schema", []);
  assert.deepEqual(ids(out), ["proposal", "tasks"]);
});

test("schema: does not mutate the input array", () => {
  const arts = [art("tasks"), art("proposal")];
  const snapshot = ids(arts);
  sortArtifacts(arts, "schema", ["proposal", "tasks"]);
  assert.deepEqual(ids(arts), snapshot);
});

test("every mode returns the same set and leaves the input array as it found it", () => {
  const given = ["tasks", "apple", "proposal", "design"];
  for (const mode of ARTIFACT_SORT_MODES) {
    const arts = given.map((id) => art(id));
    const out = sortArtifacts(arts, mode, ["proposal", "tasks"]);
    assert.deepEqual(ids(out).sort(), [...given].sort(), `set changed in ${mode} mode`);
    if (mode !== "modified") {
      assert.deepEqual(ids(arts), given, `input reordered in ${mode} mode`);
    }
  }
});

// --- Element type ------------------------------------------------------------------------------
//
// What regressed in issue #45 was the *signature*, not the behavior: a return type of
// `ChangeArtifact[]` dropped a consumer's own fields from the result's type while every value
// survived at runtime, so no behavior test could see it. These assertions are therefore checked by
// `tsc -p tsconfig.test.json` (`npm run type-check`) as much as by the runtime asserts below.

/** The issue's shape: core's own artifact plus a field of the consumer's. */
interface ArtifactWithPath extends ChangeArtifact {
  relPath: string;
}

/** Only the two fields the rule reads, plus one of its own — deliberately not a `ChangeArtifact`. */
interface OrderingFieldsOnly {
  id: string;
  title: string;
  relPath: string;
}

test("sorting hands back the element type it was given, extra fields and all", () => {
  const views: ArtifactWithPath[] = [
    { ...art("tasks"), relPath: "changes/x/tasks.md" },
    { ...art("proposal"), relPath: "changes/x/proposal.md" },
  ];

  for (const mode of ARTIFACT_SORT_MODES) {
    // No cast. A signature narrowed back to ChangeArtifact[] fails to compile on this assignment,
    // and reading .relPath off the result fails with it.
    const sorted: ArtifactWithPath[] = sortArtifacts(views, mode, ["proposal", "tasks"]);
    assert.deepEqual(
      sorted.map((a) => a.relPath).sort(),
      ["changes/x/proposal.md", "changes/x/tasks.md"],
      `relPath did not survive ${mode} mode`,
    );
  }
});

test("an element carrying the fields the rule reads is enough — it need not be a ChangeArtifact", () => {
  const minimal: OrderingFieldsOnly[] = [
    { id: "tasks", title: "Tasks", relPath: "changes/x/tasks.md" },
    { id: "proposal", title: "Proposal", relPath: "changes/x/proposal.md" },
  ];
  const sorted: OrderingFieldsOnly[] = sortArtifacts(minimal, "schema", ["proposal", "tasks"]);
  assert.deepEqual(
    sorted.map((a) => a.relPath),
    ["changes/x/proposal.md", "changes/x/tasks.md"],
  );
});

// Never called — tsc is the assertion. `title` is one of the two fields the rule reads, so elements
// without it are not acceptable input; the directive also fails as *unused* if the constraint is
// ever loosened enough to accept them, so this catches a widening as well as a narrowing.
function _elementsWithoutTitleAreRejected(idsOnly: { id: string }[]) {
  // @ts-expect-error element type is missing `title`, which `alpha` orders by
  return sortArtifacts(idsOnly, "alpha");
}
