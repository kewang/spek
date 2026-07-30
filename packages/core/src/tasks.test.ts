import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTasks } from "./tasks.js";

// A task's text is Markdown, and the folding rules exist so it renders the way a standard
// CommonMark+GFM renderer shows the same source in place. These tests pin the folded strings;
// TaskText.test.ts in @spekjs/web pins the rendering equivalence those strings are chosen for.

function textOf(content: string): string[] {
  return parseTasks(content).sections.flatMap((s) => s.tasks.map((t) => t.text));
}

test("parseTasks: sub-bullets indented two spaces are dedented to column 0", () => {
  assert.deepEqual(textOf("- [ ] Parent\n  - a\n  - b"), ["Parent\n- a\n- b"]);
});

test("parseTasks: removes exactly the content offset, not the whole indent", () => {
  // 6 spaces - 2 leaves 4, which standard Markdown renders as lazy paragraph continuation
  // with a literal "-". Stripping all 6 would promote it to a bullet list no other viewer shows.
  assert.deepEqual(textOf("- [ ] Parent\n      - a"), ["Parent\n    - a"]);
});

test("parseTasks: relative nesting between continuation lines is preserved", () => {
  assert.deepEqual(textOf("- [ ] Parent\n  - a\n    - b"), ["Parent\n- a\n  - b"]);
});

test("parseTasks: lazy continuation at column 0 belongs to the task", () => {
  assert.deepEqual(textOf("- [ ] Task one\nprose line"), ["Task one\nprose line"]);
});

test("parseTasks: a tab counts as one whitespace character when dedenting", () => {
  assert.deepEqual(textOf("- [ ] Parent\n\t- a"), ["Parent\n- a"]);
});

test("parseTasks: unindented prose after a blank line ends the task", () => {
  // A standard renderer puts this prose in its own paragraph outside the list.
  assert.deepEqual(textOf("- [ ] Task one\n\nStandalone prose."), ["Task one"]);
});

test("parseTasks: indented prose after a blank line continues the task", () => {
  assert.deepEqual(textOf("- [ ] Task one\n\n  Belongs to item."), ["Task one\n\nBelongs to item."]);
});

test("parseTasks: an indented code block keeps its exact content", () => {
  // The one case that distinguishes the dedent from doing nothing: 6 spaces - 2 leaves 4, so the
  // line is an indented code block whose content starts flush. Without the dedent it would carry two
  // spurious leading spaces inside the code.
  assert.deepEqual(textOf("- [ ] Task\n\n      six space content"), [
    "Task\n\n    six space content",
  ]);
});

test("parseTasks: trailing blank lines are dropped", () => {
  assert.deepEqual(textOf("- [ ] Task one\n  - a\n\n\n"), ["Task one\n- a"]);
});

test("parseTasks: a two-space hard line break survives folding", () => {
  assert.deepEqual(textOf("- [ ] First line  \n  second line"), ["First line  \nsecond line"]);
});

test("parseTasks: a backslash hard line break survives folding", () => {
  assert.deepEqual(textOf("- [ ] First line\\\n  second line"), ["First line\\\nsecond line"]);
});

test("parseTasks: a soft break stays soft", () => {
  assert.deepEqual(textOf("- [ ] First line\n  second line"), ["First line\nsecond line"]);
});

test("parseTasks: single-line tasks are unchanged and contain no newline", () => {
  const tasks = parseTasks("- [ ] Just this  \n- [x] And this").sections[0].tasks;
  assert.deepEqual(
    tasks.map((t) => t.text),
    ["Just this", "And this"]
  );
  for (const t of tasks) assert.ok(!t.text.includes("\n"));
});

test("parseTasks: indented checkboxes are not counted as separate tasks", () => {
  const parsed = parseTasks("- [ ] Parent\n  - [ ] sub one\n  - [x] sub two");
  assert.equal(parsed.total, 1);
  assert.equal(parsed.completed, 0);
  assert.deepEqual(
    parsed.sections[0].tasks.map((t) => t.text),
    ["Parent\n- [ ] sub one\n- [x] sub two"]
  );
});

test("parseTasks: statistics and section grouping are unchanged", () => {
  const parsed = parseTasks(
    "## Phase 1\n- [x] one\n  - note\n- [ ] two\n## Phase 2\n- [x] three\n"
  );
  assert.equal(parsed.total, 3);
  assert.equal(parsed.completed, 2);
  assert.deepEqual(
    parsed.sections.map((s) => s.title),
    ["Phase 1", "Phase 2"]
  );
  assert.deepEqual(
    parsed.sections[0].tasks.map((t) => t.text),
    ["one\n- note", "two"]
  );
});

test("parseTasks: a section heading ends the preceding task", () => {
  assert.deepEqual(textOf("- [ ] one\n  - a\n## Next\n- [ ] two"), ["one\n- a", "two"]);
});

test("parseTasks: empty input yields no tasks", () => {
  assert.deepEqual(parseTasks(""), { total: 0, completed: 0, sections: [] });
});

test("parseTasks: CRLF input is handled", () => {
  assert.deepEqual(textOf("- [ ] Parent\r\n  - a\r\n"), ["Parent\n- a"]);
});
