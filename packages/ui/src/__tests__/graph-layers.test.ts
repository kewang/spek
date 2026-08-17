import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The graph's drawing order, asserted against the source.
 *
 * A label is protected from the node the layout drifts over it by a halo of the mounted surface's
 * colour — and that protection is delivered by **paint order** and nothing else. While each label
 * was a child of its own node's `<g>`, it was painted over, halo and all, by every node drawn after
 * it: the guarantee held for one direction of each collision and not the other, at no cost to any
 * colour, so no measurement of the palette could see it.
 *
 * This is checked as text because it cannot be checked any other way here: the repo has no DOM
 * environment in any package, `@spekjs/ui`'s suite runs on plain `node --test`, and the overlap
 * itself is geometry a force simulation produces at runtime. What a test can hold is the property
 * the fix rests on — labels are a layer of their own, appended after the nodes.
 */

const src = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "SpecGraph.tsx"),
  "utf-8",
);

test("labels are drawn in their own layer, after the nodes layer", () => {
  const nodes = src.indexOf('.attr("class", "nodes")');
  const labels = src.indexOf('.attr("class", "labels")');
  assert.ok(nodes !== -1, "the nodes layer is no longer named 'nodes'");
  assert.ok(labels !== -1, "the labels layer is no longer named 'labels'");
  assert.ok(
    nodes < labels,
    "the labels layer must be appended after the nodes layer, or a node drawn later paints over a label",
  );
});

test("labels are not appended into the per-node group", () => {
  // The regression this guards is one edit: re-attaching the text to `nodeSel`. It reads as a
  // simplification — one selection instead of two — and silently restores the half-working halo.
  assert.ok(
    !/nodeSel[\s\S]{0,80}\.append\("text"\)/.test(src),
    "a label appended into nodeSel is painted over by every node drawn after it",
  );
});

test("labels take no pointer events", () => {
  // Reachable in paint order must not become reachable to the pointer: the labels layer now sits above
  // every node, so without this a label would swallow the hover and the click of the node it belongs to.
  // Bounded by the end of the statement rather than a character count: the chain carries a long comment,
  // and a window sized to today's prose fails the next time someone edits it.
  const from = src.indexOf('.attr("class", "labels")');
  const statement = src.slice(from, src.indexOf("\n\n", from));
  assert.match(
    statement,
    /\.attr\("pointer-events", "none"\)/,
    "the labels layer must not intercept hover or drag from the nodes beneath it"
  );
});

test("the hover de-emphasis reaches the labels", () => {
  // `graph-view` requires every non-connected node to drop to 0.1, and records "dim the graphics,
  // leave the labels at full strength" as the alternative it considered and rejected. Once the
  // labels left the group that carries the dim, the only thing keeping that decision true is this.
  const enter = src.slice(src.indexOf('.on("mouseenter"'), src.indexOf('.on("mouseleave"'));
  const leave = src.slice(src.indexOf('.on("mouseleave"'));
  assert.match(enter, /labelSel\.attr\("opacity"/, "hover dims the nodes but not their labels");
  assert.match(
    leave.slice(0, 400),
    /labelSel\.attr\("opacity", 1\)/,
    "leaving the hover restores the nodes but not their labels",
  );
});
