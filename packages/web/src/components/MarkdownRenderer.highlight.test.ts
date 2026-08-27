import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "./MarkdownRenderer";

const render = (content: string): string =>
  renderToStaticMarkup(createElement(MarkdownRenderer, { content }));

test("a json fenced block is syntax-highlighted with hljs token spans", () => {
  const html = render('```json\n{"name": 1}\n```\n');
  // rehypeHighlightNarrow sets `hljs language-json` (hljs first), then the code component appends
  // ` block bg-bg-tertiary`. The block must be detected even though `language-json` is not first.
  // `bg-bg-tertiary` is
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

test("a fence with no language renders as a plain block, not an inline chip", () => {
  const html = render("```\nplain text here\n```\n");
  assert.doesNotMatch(html, /hljs/); // no highlighting
  assert.match(html, /plain text here/);
  // It must render as a block (inside <pre>, carrying the block background), not as the inline `<code>`
  // chip (amber text-code-text with pill padding). A bare fence gets no language class and no hljs. So
  // blockness is detected from the trailing newline on a code block's text. The markdown-renderer spec
  // requires "plain, uncolored code". Before the fix, a language-less block rendered as an inline chip.
  assert.match(html, /<pre[^>]*>\s*<code class="\s*block bg-bg-tertiary"/);
  assert.doesNotMatch(html, /px-1\.5/); // never the inline chip padding
  assert.doesNotMatch(html, /text-code-text/); // never the inline chip amber
});

test("inline code (single backticks) still renders as the inline chip, not a block", () => {
  const html = render("some `inline` code\n");
  assert.match(html, /px-1\.5/); // the inline chip padding is present
  assert.doesNotMatch(html, /<pre/); // and it is not wrapped in a block
});

test("multi-line inline code stays inline (a source-span check would wrongly promote it to a block)", () => {
  // `` `foo\nbar` `` spans two source lines but is inline code. Its line breaks fold to spaces. Block
  // detection keys off the trailing newline mdast-util-to-hast adds to code blocks, not the line span. So
  // this stays an inline chip inside the paragraph.
  const html = render("a `foo\nbar` b\n");
  assert.doesNotMatch(html, /<pre/);
  assert.match(html, /px-1\.5/);
});

test("a js fence is highlighted (the typescript grammar does not cover js, so javascript is registered)", () => {
  const html = render("```js\nconst x = 1\n```\n");
  assert.match(html, /hljs-keyword/); // `const` tokenised — js would render plain if only ts were registered
});

test("an empty fence renders as a plain block, not an inline chip", () => {
  // An empty fence's text is "" with no trailing newline, so block detection must treat "" as a block.
  const html = render("```\n```\n");
  assert.match(html, /<pre[^>]*>\s*<code class="\s*block bg-bg-tertiary"/);
  assert.doesNotMatch(html, /px-1\.5/); // never the inline chip padding
});

test("a language in the tuned set (kotlin) is highlighted, one outside it (python) renders plain", () => {
  // The grammar registry is tuned to the fences this repo's content uses, to keep the ~37 default grammars
  // out of the bundle. An in-set language (kotlin) still tokenises. A dropped one (python) renders as a
  // plain block with no hljs token spans, and never throws.
  const kt = render("```kotlin\nfun foo() { }\n```\n");
  assert.match(kt, /hljs-keyword/); // `fun` tokenised

  const py = render("```python\ndef foo(): pass\n```\n");
  assert.doesNotMatch(py, /hljs-/); // no token spans for a dropped grammar
  assert.match(py, /def foo\(\): pass/); // content still present
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
