import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import {
  isMarkdownLike,
  dataLanguage,
  dataFormat,
  dataStem,
  dataTabNames,
  fencedBlock,
} from "./dataArtifact";

test("dataLanguage maps .yaml / .yml to yaml and .json to json (case-insensitive)", () => {
  assert.equal(dataLanguage("asyncapi.yaml"), "yaml");
  assert.equal(dataLanguage("config.yml"), "yaml");
  assert.equal(dataLanguage("schema.json"), "json");
  assert.equal(dataLanguage("SCHEMA.JSON"), "json");
});

test("dataLanguage returns no language for an extension it does not know (not yaml)", () => {
  // The fence language must NOT default to yaml for an unrecognised extension, or highlight.js would
  // tokenise e.g. TOML as YAML. "" produces a bare fence, which renders plain.
  assert.equal(dataLanguage("deploy.toml"), "");
  assert.equal(dataLanguage("notes.txt"), "");
});

test("dataFormat gives the short badge label; dataStem drops the extension", () => {
  assert.equal(dataFormat("asyncapi.yaml"), "YAML");
  assert.equal(dataFormat("config.yml"), "YAML");
  assert.equal(dataFormat("schema.json"), "JSON");
  assert.equal(dataStem("asyncapi.yaml"), "asyncapi");
  assert.equal(dataStem("retry-policy.yml"), "retry-policy");
  assert.equal(dataStem("payload-example.json"), "payload-example");
});

test("dataTabNames labels a data tab with its stem plus format, and leaves non-data tabs out", () => {
  const names = dataTabNames([
    { id: "proposal", title: "Proposal", kind: "markdown" },
    { id: "asyncapi", title: "asyncapi.yaml", kind: "data" },
    { id: "specs", title: "Specs", kind: "specs" },
  ]);
  assert.deepEqual(names.get("asyncapi"), { name: "asyncapi", format: "YAML" });
  assert.equal(names.has("proposal"), false); // non-data tabs keep their own title
  assert.equal(names.has("specs"), false);
});

test("dataTabNames restores the full filename when a data stem collides with another tab's label", () => {
  // `notes.md` -> "Notes" and `notes.yaml` -> stem "notes" collide case-insensitively. The data tab keeps
  // its filename, so the two are distinguishable. A non-colliding data tab still drops its extension.
  const names = dataTabNames([
    { id: "notes", title: "Notes", kind: "markdown" },
    { id: "notes-2", title: "notes.yaml", kind: "data" },
    { id: "config", title: "config.json", kind: "data" },
  ]);
  assert.deepEqual(names.get("notes-2"), { name: "notes.yaml", format: "YAML" });
  assert.deepEqual(names.get("config"), { name: "config", format: "JSON" });
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
