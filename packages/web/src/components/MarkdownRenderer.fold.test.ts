import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { foldOptionsFor } from "../hooks/useSpecFold";

const SPEC = `## Requirements

### Requirement: Alpha

The system SHALL do the thing.

#### Scenario: One

- **WHEN** a thing happens
- **THEN** another thing happens

### Requirement: Beta

More prose.
`;

function render(content: string, fold?: ReturnType<typeof foldOptionsFor>): string {
  return renderToStaticMarkup(createElement(MarkdownRenderer, { content, fold }));
}

test("folding off renders no disclosure elements at all", () => {
  const html = render(SPEC);
  assert.ok(!html.includes("<details"), "expected no <details>");
  assert.ok(!html.includes("<summary"), "expected no <summary>");
});

test("folding on wraps requirements and scenarios in <details>", () => {
  const html = render(SPEC, foldOptionsFor("default"));
  assert.equal(html.match(/<details/g)?.length, 3, "two requirements plus one scenario");
  assert.equal(html.match(/<summary/g)?.length, 3);
});

test("default mode opens requirements and leaves scenarios closed", () => {
  const html = render(SPEC, foldOptionsFor("default"));
  // `open` is emitted only on the requirement folds; the scenario's <details> carries none.
  assert.equal(html.match(/<details[^>]*\bopen\b/g)?.length, 2);
  assert.equal(html.match(/data-spek-fold="4"[^>]*\bopen\b/g), null);
});

test("expanded opens every fold, collapsed opens none", () => {
  const expanded = render(SPEC, foldOptionsFor("expanded"));
  assert.equal(expanded.match(/<details[^>]*\bopen\b/g)?.length, 3);

  const collapsed = render(SPEC, foldOptionsFor("collapsed"));
  assert.equal(collapsed.match(/<details[^>]*\bopen\b/g), null);
});

test("the heading and its id stay inside the summary", () => {
  const html = render(SPEC, foldOptionsFor("default"));
  assert.match(html, /<summary[^>]*>.*?<h3 id="requirement-alpha"/s);
});

test("heading ids are identical whether or not folding is on", () => {
  const ids = (html: string) => [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids(render(SPEC, foldOptionsFor("default"))), ids(render(SPEC)));
});

test("content outside a requirement is left where it is", () => {
  const html = render(SPEC, foldOptionsFor("default"));
  // The `## Requirements` heading precedes the first <details> and is not inside one.
  assert.match(html, /<h2 id="requirements"[^>]*>.*?<\/h2>\s*<details/s);
});

test("BDD keywords are still highlighted inside a folded scenario", () => {
  const html = render(SPEC, foldOptionsFor("default"));
  assert.match(html, /text-kw-when/);
  assert.match(html, /text-kw-then/);
});

test("a keyword inside author emphasis does not carry its own weight class", () => {
  // `- **WHEN** …` — the <strong> already supplies bold; adding font-semibold here would render the
  // emphasised word lighter than the emphasis around it.
  const html = render("- **WHEN** something\n");
  const span = /<span class="([^"]*text-kw-when[^"]*)"/.exec(html);
  assert.ok(span, "expected a highlighted WHEN span");
  assert.ok(!span[1].includes("font-semibold"), `weight leaked into: ${span[1]}`);
});

test("a keyword outside emphasis keeps its weight class", () => {
  const html = render("A paragraph mentioning WHEN directly.\n");
  const span = /<span class="([^"]*text-kw-when[^"]*)"/.exec(html);
  assert.ok(span?.[1].includes("font-semibold"));
});
