import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { isMarkdownLike, dataLanguage, fencedBlock } from "./dataArtifact";

test("dataLanguage maps .yaml / .yml to yaml and .json to json (case-insensitive)", () => {
  assert.equal(dataLanguage("asyncapi.yaml"), "yaml");
  assert.equal(dataLanguage("config.yml"), "yaml");
  assert.equal(dataLanguage("schema.json"), "json");
  assert.equal(dataLanguage("SCHEMA.JSON"), "json");
});

test("fencedBlock wraps content in a plain 3-backtick fence when it contains none", () => {
  assert.equal(fencedBlock("a: 1", "yaml"), "```yaml\na: 1\n```");
});

test("fencedBlock strips the file's trailing newline so the block has no blank last line", () => {
  // Files end in a newline. Without the strip, `${content}\n` leaves an empty line before the closing
  // fence, which renders as a spurious blank line at the bottom of the block.
  assert.equal(fencedBlock("a: 1\n", "yaml"), "```yaml\na: 1\n```");
  assert.equal(fencedBlock("a: 1\r\n", "yaml"), "```yaml\na: 1\n```");
});

test("fencedBlock grows the fence past any backtick run so content cannot break out", () => {
  // a data file whose text contains a ``` run (e.g. an AsyncAPI description holding Markdown)
  const out = fencedBlock("desc: |\n  ```\n  code\n  ```\n", "yaml");
  assert.match(out, /^````yaml\n/); // opening fence is 4 backticks, longer than the inner 3
  assert.match(out, /\n````$/); // and so is the closing fence
});

test("a data artifact renders as a highlighted code block via the same MarkdownRenderer pipeline", () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownRenderer, {
      content: fencedBlock('{"name": 1}', dataLanguage("schema.json")),
    }),
  );
  assert.match(html, /language-json/);
  assert.match(html, /hljs-attr/);
});

test("a data artifact is not markdown-like, so its tab shows no table of contents", () => {
  assert.equal(isMarkdownLike("data"), false);
  assert.equal(isMarkdownLike("tasks"), false);
  assert.equal(isMarkdownLike("markdown"), true);
  assert.equal(isMarkdownLike("specs"), true);
});
