import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseTasks } from "@spekjs/core";
import { TaskText } from "./TaskText";

// The folding rules in parseTasks exist for one reason: a task's text must render the way a standard
// CommonMark+GFM renderer shows that same source in place. So these tests assert exactly that
// property rather than snapshotting our own output — render the whole tasks.md as Markdown, pull each
// task list item's inner HTML, and compare it to what TaskText produces from the folded text.

/** Render the source as plain Markdown — the reference a standard viewer would show. */
function renderReference(source: string): string {
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, source)
  );
}

/**
 * Inner HTML of every top-level (column-0) task list item in the reference rendering. Note the
 * opening tag carries attributes — remark-gfm emits `<li class="task-list-item">` — so this scans
 * open/close tags and tracks depth rather than matching a bare `<li>`.
 */
function referenceTaskItems(source: string): string[] {
  const html = renderReference(source);
  const tag = /<li(?:\s[^>]*)?>|<\/li>/g;
  const items: string[] = [];
  const openStarts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html)) !== null) {
    if (m[0] === "</li>") {
      const start = openStarts.pop();
      // Depth 0 after popping means this item was not inside another: nested items belong to a
      // parent's text and are never tasks in their own right, exactly as parseTasks treats them.
      if (start !== undefined && openStarts.length === 0) {
        items.push(html.slice(start, m.index));
      }
    } else {
      openStarts.push(m.index + m[0].length);
    }
  }
  return (
    items
      .filter((inner) => /^\s*(<p>\s*)?<input[^>]*type="checkbox"/.test(inner))
      // Drop the item's own checkbox: the Tasks tab draws that as a custom SVG outside TaskText, so
      // only the text after it is TaskText's job. Checkboxes further in are nested ones and stay.
      .map((inner) => inner.replace(/<input[^>]*type="checkbox"[^>]*>\s*/, ""))
  );
}

/**
 * Compare structure and text, not styling. TaskText carries Tailwind classes the bare reference has
 * no equivalent for, a tight reference item has no `<p>` wrapper, and the two renderers spell a
 * read-only checkbox differently — none of which is what these tests are about.
 */
function normalize(html: string): string {
  return html
    .replace(/<input[^>]*type="checkbox"[^>]*>/g, (tag) =>
      /checked/.test(tag) ? "<checkbox:checked>" : "<checkbox>"
    )
    .replace(/\sclass="[^"]*"/g, "")
    // Links open in a new tab, matching MarkdownRenderer elsewhere in the viewer. That is link
    // policy, not Markdown structure, so it is not what this comparison is about.
    .replace(/\s(?:target|rel)="[^"]*"/g, "")
    .replace(/<\/?p>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ourTaskItems(source: string): string[] {
  return parseTasks(source).sections.flatMap((s) =>
    s.tasks.map((t) => renderToStaticMarkup(createElement(TaskText, { text: t.text })))
  );
}

function assertMatchesReference(source: string, label: string): void {
  const expected = referenceTaskItems(source).map(normalize);
  const actual = ourTaskItems(source).map(normalize);
  assert.deepEqual(actual, expected, label);
}

test("TaskText: inline formatting renders as Markdown", () => {
  const html = renderToStaticMarkup(
    createElement(TaskText, { text: "Use `parseTasks` with **care**" })
  );
  assert.match(html, /<code[^>]*>parseTasks<\/code>/);
  assert.match(html, /<strong[^>]*>care<\/strong>/);
  assert.doesNotMatch(html, /\*\*/);
  assertMatchesReference("- [ ] Use `parseTasks` with **care**", "inline formatting");
});

test("TaskText: a hard line break renders as a break", () => {
  const source = "- [ ] First line  \n  second line";
  assert.match(ourTaskItems(source)[0], /<br\s*\/?>/);
  assertMatchesReference(source, "hard break");
});

test("TaskText: a soft line break does not become a break", () => {
  const source = "- [ ] First line\n  second line";
  assert.doesNotMatch(ourTaskItems(source)[0], /<br\s*\/?>/);
  assertMatchesReference(source, "soft break");
});

test("TaskText: sub-bullets indented two spaces render as a nested list", () => {
  const source = "- [ ] Parent\n  - first\n  - second";
  assert.match(ourTaskItems(source)[0], /<ul[^>]*>/);
  assertMatchesReference(source, "2-space sub-bullets");
});

test("TaskText: sub-bullets indented four spaces match the reference", () => {
  assertMatchesReference("- [ ] Parent\n    - first\n    - second", "4-space sub-bullets");
});

test("TaskText: continuation indented six spaces is not promoted to a list", () => {
  const source = "- [ ] Parent\n      - first\n      - second";
  assert.doesNotMatch(ourTaskItems(source)[0], /<ul[^>]*>/);
  assertMatchesReference(source, "6-space continuation");
});

test("TaskText: relative nesting renders as nested lists", () => {
  assertMatchesReference("- [ ] Parent\n  - outer\n    - inner", "nested sub-bullets");
});

test("TaskText: lazy continuation at column 0 stays in the task", () => {
  assertMatchesReference("- [ ] Task one\nlazy continuation.", "lazy continuation");
});

test("TaskText: unindented prose after a blank line is not part of the task", () => {
  assertMatchesReference("- [ ] Task one\n\nStandalone prose.", "blank-line boundary");
});

test("TaskText: indented prose after a blank line stays in the task", () => {
  assertMatchesReference("- [ ] Task one\n\n  Belongs to item.", "indented after blank");
});

test("TaskText: an indented code block keeps its exact content", () => {
  // The only construct that distinguishes the dedent rule from doing nothing. Without this case the
  // rule is untested and a regression would pass everything else.
  const source = "- [ ] Task\n\n      six space content";
  const html = ourTaskItems(source)[0];
  assert.match(html, /<pre[^>]*><code[^>]*>six space content/);
  assert.doesNotMatch(html, /<code[^>]*>\s+six space content/);
  assertMatchesReference(source, "indented code block");
});

test("TaskText: nested checkboxes render inside the parent task", () => {
  const source = "- [ ] Parent\n  - [ ] sub one\n  - [x] sub two";
  const items = ourTaskItems(source);
  assert.equal(items.length, 1, "nested checkboxes are not separate tasks");
  assert.match(items[0], /type="checkbox"/);
  assertMatchesReference(source, "nested checkboxes");
});

test("TaskText: several tasks with continuation lines each keep their own text", () => {
  assertMatchesReference(
    "## Phase 1\n- [ ] one\n  - a\n- [x] two\n  - b\n## Phase 2\n- [ ] three",
    "multiple multi-line tasks"
  );
});

test("TaskText: single-line tasks render without block spacing", () => {
  const html = renderToStaticMarkup(createElement(TaskText, { text: "Just this" }));
  // first:mt-0 keeps the sole paragraph flush so the row looks exactly as it did before.
  assert.match(html, /first:mt-0/);
  assert.doesNotMatch(html, /<ul|<pre|<br/);
});

test("TaskText: matches the reference across the repo's own tasks.md corpus", async () => {
  const { readdirSync, readFileSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = new URL("../../../../openspec", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  if (!existsSync(root)) {
    // The guarantees live in the cases above; this sweep is a regression net over real content and
    // must not turn into a failure when run outside the repo.
    return;
  }
  const files: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === "tasks.md") files.push(p);
    }
  })(root);
  assert.ok(files.length > 0, "expected to find tasks.md fixtures");
  for (const file of files) {
    const source = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    assertMatchesReference(source, file);
  }
});
