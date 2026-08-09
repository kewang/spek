import { test } from "node:test";
import assert from "node:assert/strict";
import { FOLD_LEVELS, foldOptionsFor } from "./useSpecFold";

test("every mode folds the same levels — only the initial state differs", () => {
  for (const mode of ["default", "expanded", "collapsed"] as const) {
    assert.deepEqual(foldOptionsFor(mode).levels, FOLD_LEVELS);
  }
});

test("default opens requirements and closes scenarios", () => {
  assert.deepEqual(foldOptionsFor("default").openLevels, [3]);
});

test("expanded opens both levels, collapsed opens neither", () => {
  assert.deepEqual(foldOptionsFor("expanded").openLevels, [3, 4]);
  assert.deepEqual(foldOptionsFor("collapsed").openLevels, []);
});

test("openLevels is always a subset of levels", () => {
  for (const mode of ["default", "expanded", "collapsed"] as const) {
    const { levels, openLevels } = foldOptionsFor(mode);
    for (const l of openLevels) assert.ok(levels.includes(l), `${l} is open but never folds`);
  }
});
