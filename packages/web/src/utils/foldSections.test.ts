import { test } from "node:test";
import assert from "node:assert/strict";
import { foldSections, headingLevel, type HastNode } from "./foldSections";

const OPTIONS = { levels: [3, 4], openLevels: [3] };

function h(level: number, text: string, id?: string): HastNode {
  return {
    type: "element",
    tagName: `h${level}`,
    properties: id ? { id } : {},
    children: [{ type: "text", value: text }],
  };
}

function p(text: string): HastNode {
  return { type: "element", tagName: "p", properties: {}, children: [{ type: "text", value: text }] };
}

function root(...children: HastNode[]): HastNode {
  return { type: "root", children };
}

/** Compact shape for assertions: `h3`, `p`, or `details(<summary child>, …)`. */
function shape(node: HastNode): string {
  if (node.type === "text") return `"${node.value}"`;
  if (node.tagName === "details") {
    const [summary, ...body] = node.children ?? [];
    const head = shape((summary.children ?? [])[0]);
    const open = node.properties?.open ? "+" : "-";
    return `details${open}(${[head, ...body.map(shape)].join(", ")})`;
  }
  return node.tagName ?? node.type;
}

const shapes = (tree: HastNode) => (tree.children ?? []).map(shape);

test("headingLevel: recognises h1–h6 and nothing else", () => {
  for (let i = 1; i <= 6; i++) assert.equal(headingLevel(h(i, "x")), i);
  assert.equal(headingLevel(p("x")), null);
  assert.equal(headingLevel({ type: "text", value: "x" }), null);
});

test("requirement is open, scenario is collapsed", () => {
  const tree = foldSections(root(h(3, "Requirement: A"), p("lead"), h(4, "Scenario: one"), p("step")), OPTIONS);
  assert.deepEqual(shapes(tree), ['details+(h3, p, details-(h4, p))']);
});

test("a requirement ends where the next requirement begins", () => {
  const tree = foldSections(root(h(3, "A"), p("a"), h(3, "B"), p("b")), OPTIONS);
  assert.deepEqual(shapes(tree), ["details+(h3, p)", "details+(h3, p)"]);
});

test("a scenario ends at a heading of level 3 or shallower", () => {
  const tree = foldSections(root(h(3, "A"), h(4, "s1"), p("x"), h(4, "s2"), p("y"), h(3, "B")), OPTIONS);
  assert.deepEqual(shapes(tree), [
    "details+(h3, details-(h4, p), details-(h4, p))",
    "details+(h3)",
  ]);
});

test("an h2 closes an open requirement and is not itself folded", () => {
  const tree = foldSections(root(h(2, "Requirements"), h(3, "A"), p("a"), h(2, "Other"), p("o")), OPTIONS);
  assert.deepEqual(shapes(tree), ["h2", "details+(h3, p)", "h2", "p"]);
});

test("content before the first requirement stays unfolded and in place", () => {
  const tree = foldSections(root(h(2, "Purpose"), p("why"), h(3, "A")), OPTIONS);
  assert.deepEqual(shapes(tree), ["h2", "p", "details+(h3)"]);
});

test("a document with no foldable heading is returned unchanged in shape", () => {
  const tree = foldSections(root(h(1, "Title"), h(2, "Purpose"), p("body")), OPTIONS);
  assert.deepEqual(shapes(tree), ["h1", "h2", "p"]);
});

test("a scenario before any requirement folds at top level and drops nothing", () => {
  const tree = foldSections(root(h(4, "orphan"), p("x"), h(3, "A")), OPTIONS);
  assert.deepEqual(shapes(tree), ["details-(h4, p)", "details+(h3)"]);
});

test("openLevels drives the initial state, levels drives what folds at all", () => {
  const nodes = () => root(h(3, "A"), h(4, "s"), p("x"));

  const expanded = foldSections(nodes(), { levels: [3, 4], openLevels: [3, 4] });
  assert.deepEqual(shapes(expanded), ["details+(h3, details+(h4, p))"]);

  const collapsed = foldSections(nodes(), { levels: [3, 4], openLevels: [] });
  assert.deepEqual(shapes(collapsed), ["details-(h3, details-(h4, p))"]);

  const onlyRequirements = foldSections(nodes(), { levels: [3], openLevels: [3] });
  assert.deepEqual(shapes(onlyRequirements), ["details+(h3, h4, p)"]);
});

test("the heading element is preserved, id and all, as the fold's handle", () => {
  const tree = foldSections(root(h(3, "Requirement: A", "requirement-a")), OPTIONS);
  const details = (tree.children ?? [])[0];
  const summary = (details.children ?? [])[0];
  const heading = (summary.children ?? [])[0];
  assert.equal(summary.tagName, "summary");
  assert.equal(heading.tagName, "h3");
  assert.deepEqual(heading.properties, { id: "requirement-a" });
});

test("the input tree is not mutated", () => {
  const input = root(h(3, "A"), p("a"));
  const before = JSON.stringify(input);
  foldSections(input, OPTIONS);
  assert.equal(JSON.stringify(input), before);
});

test("every original node survives, in order", () => {
  const input = root(h(2, "R"), h(3, "A"), p("a"), h(4, "s"), p("b"), h(3, "B"), p("c"));
  const flatten = (n: HastNode): string[] =>
    n.type === "text"
      ? [`"${n.value}"`]
      : n.tagName === "details" || n.tagName === "summary" || n.type === "root"
        ? (n.children ?? []).flatMap(flatten)
        : [n.tagName ?? ""];
  assert.deepEqual(flatten(foldSections(input, OPTIONS)), flatten(input));
});
