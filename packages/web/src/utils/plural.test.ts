import { test } from "node:test";
import assert from "node:assert/strict";
import { plural } from "./plural";

test("plural: only exactly one is singular", () => {
  assert.equal(plural(1, "stage"), "stage");
  assert.equal(plural(0, "stage"), "stages");
  assert.equal(plural(2, "stage"), "stages");
  // Zero is plural in English ("no stages", "0 stages") — the boundary is at 1, not at 0.
});

test("plural: capitalisation is the caller's, not the helper's", () => {
  assert.equal(plural(1, "Stage"), "Stage");
  assert.equal(plural(3, "Stage"), "Stages");
});

test("plural: an irregular plural can be given outright", () => {
  assert.equal(plural(1, "entry", "entries"), "entry");
  assert.equal(plural(2, "entry", "entries"), "entries");
});
