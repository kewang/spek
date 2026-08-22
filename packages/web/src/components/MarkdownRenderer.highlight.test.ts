import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "./MarkdownRenderer";

const render = (content: string): string =>
  renderToStaticMarkup(createElement(MarkdownRenderer, { content }));

test("a json fenced block is syntax-highlighted with hljs token spans", () => {
  const html = render('```json\n{"name": 1}\n```\n');
  // rehype-highlight unshifts `hljs`, then the code component appends ` block bg-bg-tertiary`. The
  // block must be detected even though `language-json` is no longer first. `bg-bg-tertiary` is
  // load-bearing: without an explicit background, the VS Code webview's injected bare-`code` style
  // shows through and the block reads dark on a light panel. No browser test can see that host-only
  // bug, so this pins it at the class level.
  assert.match(html, /class="hljs language-json block bg-bg-tertiary"/);
  assert.match(html, /hljs-attr/); // the key is tokenised
  assert.match(html, /hljs-number/); // the number is tokenised
});

test("a yaml fenced block is syntax-highlighted", () => {
  const html = render("```yaml\nname: value\ncount: 3\n```\n");
  assert.match(html, /language-yaml/);
  assert.match(html, /hljs-attr/); // the yaml key
});

test("a fence with no language renders plain, with no hljs classes and no error", () => {
  const html = render("```\nplain text here\n```\n");
  assert.doesNotMatch(html, /hljs/);
  assert.match(html, /plain text here/);
});

test("BDD keywords inside a code fence are not marked (keywords-in-code unchanged)", () => {
  const html = render("```yaml\ndesc: WHEN a THEN b\n```\n");
  assert.doesNotMatch(html, /kw-when|kw-then/); // the BDD text-colour classes never appear in code
});

test("BDD keywords in prose are still marked (highlighting did not disturb the renderer)", () => {
  const html = render("- **WHEN** a thing happens\n- **THEN** another\n");
  assert.match(html, /kw-when/);
  assert.match(html, /kw-then/);
});
