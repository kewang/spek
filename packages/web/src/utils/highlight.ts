import { createLowlight } from "lowlight";
import { visit } from "unist-util-visit";
import { toText } from "hast-util-to-text";
import type { Root, Element, ElementContent } from "hast";
// Explicit highlight.js grammars, and the reason for a hand-rolled plugin instead of rehype-highlight.
// rehype-highlight imports lowlight's `common` binding (37 grammars from lowlight/lib/common.js) as its
// default. rollup then keeps every one of them in the bundle, whatever `languages` you pass. The bundle
// measured the same size with the option and without it. `createLowlight` alone pulls only
// highlight.js/lib/core. So registering just these grammars keeps the rest out of the SPA bundle, both
// webview bundles, and the committed docs/demo.html.
//
// The set is tuned to the fence languages that appear in this repo's own openspec/docs markdown (bash,
// ts, js, yaml, kotlin, xml, markdown), plus json and yaml for data artifacts. This is much smaller than
// the old 37-grammar default. A fence in a language outside the set renders plain rather than throwing.
// To support a new one, add its import here. lowlight also registers each grammar's aliases (typescript ->
// ts/tsx, javascript -> js/jsx, xml -> html, markdown -> md, bash -> sh), so those fence hints work.
// Note: the typescript grammar does NOT cover js/jsx, so javascript is registered separately.
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import bash from "highlight.js/lib/languages/bash";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import kotlin from "highlight.js/lib/languages/kotlin";
import xml from "highlight.js/lib/languages/xml";
import markdown from "highlight.js/lib/languages/markdown";

const lowlight = createLowlight({ json, yaml, bash, typescript, javascript, kotlin, xml, markdown });

/** The language name of a `language-*` class on a code node, or null if it has none. */
function languageOf(node: Element): string | null {
  const className = node.properties?.className;
  const list = Array.isArray(className)
    ? className
    : typeof className === "string"
      ? className.split(/\s+/)
      : [];
  for (const c of list) {
    if (typeof c === "string" && c.startsWith("language-")) return c.slice("language-".length);
  }
  return null;
}

/**
 * A rehype plugin that highlights `pre > code` blocks with a `language-*` hint. It keeps the parts of
 * rehype-highlight this app relied on. It never auto-detects (the same as `detect: false`). It leaves an
 * unregistered language plain rather than throwing. It sets the same `hljs language-<lang>` classes (hljs
 * first), so the code component's block detection and the `--color-hl-*` token mapping do not change.
 */
export function rehypeHighlightNarrow() {
  return (tree: Root) => {
    visit(tree, "element", (node, _index, parent) => {
      if (node.tagName !== "code" || !parent || parent.type !== "element" || parent.tagName !== "pre") {
        return;
      }
      const lang = languageOf(node);
      // No language hint, or a language outside the registered set -> leave the block untouched (plain).
      if (!lang || !lowlight.registered(lang)) return;
      const result = lowlight.highlight(lang, toText(node, { whitespace: "pre" }));
      node.properties = node.properties ?? {};
      node.properties.className = ["hljs", `language-${lang}`];
      node.children = result.children as ElementContent[];
    });
  };
}
