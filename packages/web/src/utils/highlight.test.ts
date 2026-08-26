import { test } from "node:test";
import assert from "node:assert/strict";
import type { Root, Element, ElementContent, RootContent } from "hast";
import { rehypeHighlightNarrow } from "./highlight";

// A minimal `pre > code` hast tree, as react-markdown produces for a fenced block. `lang` is the fence
// language (undefined for a bare fence). Wrap in `pre` unless `bare` is set, which puts the code under a
// paragraph instead — the shape of inline code, which the plugin must not touch.
function tree(code: string, lang?: string, bare = false): Root {
  const className = lang ? [`language-${lang}`] : undefined;
  const codeNode: Element = {
    type: "element",
    tagName: "code",
    properties: className ? { className } : {},
    children: [{ type: "text", value: code }],
  };
  const parent: Element = {
    type: "element",
    tagName: bare ? "p" : "pre",
    properties: {},
    children: [codeNode],
  };
  return { type: "root", children: [parent] };
}

function codeOf(root: Root): Element {
  return (root.children[0] as Element).children[0] as Element;
}

// Every `hljs*` class found anywhere under a node (the token spans lowlight emits).
function hljsClasses(node: ElementContent | RootContent): string[] {
  const out: string[] = [];
  if (node.type === "element") {
    const cn = node.properties?.className;
    const list = Array.isArray(cn) ? cn : typeof cn === "string" ? [cn] : [];
    for (const c of list) if (typeof c === "string" && c.startsWith("hljs")) out.push(c);
    for (const child of node.children) out.push(...hljsClasses(child));
  }
  return out;
}

// The concatenated text of a node's subtree.
function textOf(node: ElementContent | RootContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

test("highlights a registered language: sets `hljs language-<lang>` and token spans", () => {
  const root = tree('{"name": 1}\n', "json");
  rehypeHighlightNarrow()(root);
  const code = codeOf(root);
  assert.deepEqual(code.properties?.className, ["hljs", "language-json"]);
  const tokens = hljsClasses(code);
  assert.ok(tokens.includes("hljs-attr"), "the json key is a token"); // "name"
  assert.ok(tokens.includes("hljs-number"), "the json number is a token"); // 1
});

test("preserves the source text exactly, including the trailing newline", () => {
  const src = "name: value\ncount: 3\n";
  const root = tree(src, "yaml");
  rehypeHighlightNarrow()(root);
  assert.equal(textOf(codeOf(root)), src);
});

test("registers grammar aliases: `ts` and `html` resolve to typescript and xml", () => {
  const ts = tree("const x: number = 1\n", "ts");
  rehypeHighlightNarrow()(ts);
  assert.deepEqual(codeOf(ts).properties?.className, ["hljs", "language-ts"]);
  assert.ok(hljsClasses(codeOf(ts)).length > 0, "ts alias tokenises via the typescript grammar");

  const html = tree("<a href='x'>y</a>\n", "html");
  rehypeHighlightNarrow()(html);
  assert.ok(hljsClasses(codeOf(html)).length > 0, "html alias tokenises via the xml grammar");
});

test("leaves a language outside the set plain: class unchanged, children untouched", () => {
  const root = tree("def foo(): pass\n", "python");
  const before = codeOf(root).children;
  rehypeHighlightNarrow()(root);
  const code = codeOf(root);
  assert.deepEqual(code.properties?.className, ["language-python"]); // no `hljs` added
  assert.equal(code.children, before); // same nodes, not re-tokenised
  assert.equal(hljsClasses(code).length, 0);
});

test("leaves a bare fence (no language class) untouched", () => {
  const root = tree("plain text\n");
  rehypeHighlightNarrow()(root);
  const code = codeOf(root);
  assert.equal(code.properties?.className, undefined);
  assert.equal(hljsClasses(code).length, 0);
});

test("ignores inline code: a `code` not inside a `pre` is never highlighted", () => {
  const root = tree('{"a": 1}', "json", true); // under a <p>, not a <pre>
  rehypeHighlightNarrow()(root);
  const code = codeOf(root);
  // The language class stays as-is and no hljs token spans are added.
  assert.deepEqual(code.properties?.className, ["language-json"]);
  assert.equal(hljsClasses(code).length, 0);
});
