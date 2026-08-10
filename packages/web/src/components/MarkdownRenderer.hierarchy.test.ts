import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SpecsTabContent } from "./SpecsTabContent";
import { foldOptionsFor } from "../hooks/useSpecFold";

const DELTA = `## ADDED Requirements

### Requirement: Alpha

The system SHALL do the thing.

#### Scenario: One

- **WHEN** a thing happens
- **THEN** another thing happens
`;

const render = (content: string, specShaped?: boolean): string =>
  renderToStaticMarkup(createElement(MarkdownRenderer, { content, specShaped }));

const classOf = (html: string, tag: string): string =>
  new RegExp(`<${tag}[^>]*class="([^"]*)"`).exec(html)?.[1] ?? "";

// --- 5.1 spec 形狀的 h2 降級 ---

test("a spec-shaped h2 renders as a subordinate label, not a content heading", () => {
  const cls = classOf(render(DELTA, true), "h2");
  assert.match(cls, /uppercase/, "expected the label treatment");
  assert.ok(!cls.includes("text-xl"), `still at content-heading size: ${cls}`);
  assert.ok(!cls.includes("border-b"), `kept the full-width rule: ${cls}`);
});

test("without the declaration an h2 is still a content heading", () => {
  const cls = classOf(render(DELTA), "h2");
  assert.match(cls, /text-xl/);
  assert.match(cls, /font-bold/);
  assert.match(cls, /border-b/);
});

test("the demoted h2 does not fall below the h4s it groups", () => {
  // h3 > h2 > h4 is the intended order. Demoting past h4 would restore the very inversion this
  // change fixes, one level down — so the label sits at h4's size and weight, not below it.
  const html = render(DELTA, true);
  const h2 = classOf(html, "h2");
  const h4 = classOf(html, "h4");
  assert.ok(h4.includes("text-base"), `h4 baseline moved, revisit this test: ${h4}`);
  assert.ok(h2.includes("text-base"), `demoted h2 is smaller than the h4s below it: ${h2}`);
  assert.ok(h2.includes("font-semibold"), `demoted h2 is lighter than the h4s below it: ${h2}`);
});

test("the declaration changes no heading level and no id", () => {
  const levels = (html: string) => [...html.matchAll(/<(h[1-6])[\s>]/g)].map((m) => m[1]);
  const ids = (html: string) => [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(levels(render(DELTA, true)), levels(render(DELTA)));
  assert.deepEqual(ids(render(DELTA, true)), ids(render(DELTA)));
});

test("the declaration is independent of folding", () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownRenderer, { content: DELTA, specShaped: true })
  );
  assert.ok(!html.includes("<details"), "no folding was requested");
  assert.match(classOf(html, "h2"), /uppercase/, "spec typography applies without folding");
});

// --- 5.2 四個 delta operation 都有 badge ---

test("every delta operation is marked, and each is distinct", () => {
  const html = render("Prose mentioning ADDED, MODIFIED, REMOVED and RENAMED.\n");
  const tokens = ["badge-added", "badge-modified", "badge-removed", "badge-renamed"];
  for (const t of tokens) assert.match(html, new RegExp(`text-${t}`), `missing ${t}`);
  assert.equal(new Set(tokens).size, 4);
});

test("ADDED stays orange and MODIFIED stays blue", () => {
  // Pinned because the main spec states these two concretely; a palette shuffle must not drift them.
  const html = render("ADDED and MODIFIED.\n");
  assert.match(html, /bg-orange-500\/20[^"]*text-badge-added/);
  assert.match(html, /bg-blue-500\/20[^"]*text-badge-modified/);
});

test("no delta operation borrows the normative colour", () => {
  const html = render("ADDED MODIFIED REMOVED RENAMED\n");
  const badgeSpans = [...html.matchAll(/<span class="([^"]*text-badge-[^"]*)"/g)].map((m) => m[1]);
  assert.equal(badgeSpans.length, 4);
  for (const cls of badgeSpans) {
    assert.ok(!cls.includes("text-kw-normative"), `operation reuses the normative red: ${cls}`);
  }
});

// --- 5.3 Specs tab 的 topic 標題 ---

test("the Specs tab topic header outranks the headings it encloses", () => {
  const html = renderToStaticMarkup(
    createElement(SpecsTabContent, { specs: [{ topic: "cost-tracker", content: DELTA }] })
  );
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  const [topic, ...content] = levels;
  assert.ok(content.length > 0, "expected the spec's own headings to render");
  assert.ok(
    topic <= Math.min(...content),
    `topic header is nested below its content: h${topic} vs h${Math.min(...content)}`
  );
});

test("the Specs tab renders its delta specs as spec-shaped", () => {
  const html = renderToStaticMarkup(
    createElement(SpecsTabContent, { specs: [{ topic: "cost-tracker", content: DELTA }] })
  );
  // The topic header is the first h2; the operation heading is the one carrying an id.
  const operation = /<h2 id="[^"]*"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
  assert.match(operation, /uppercase/, `operation heading was not demoted: ${operation}`);
});

// --- 5.4 收合狀態不得讓標題錯位 ---

test("the section inset and its summary offset are both scoped to [open]", () => {
  // A DOM test cannot measure left edges, so the guard is on the rule itself. If the negative
  // margin were unscoped, closed sections' headings would sit one indent step left of open ones —
  // and the default mode (requirements open, scenarios closed) shows that on first render.
  const css = readFileSync(
    fileURLToPath(new URL("../styles/global.css", import.meta.url)),
    "utf8"
  );
  const summaryRule = /\.markdown-body details\[data-spek-fold\]([^{]*)>\s*summary\s*\{([^}]*)\}/.exec(css);
  assert.ok(summaryRule, "expected a rule offsetting the summary");
  assert.match(summaryRule[2], /margin-left:\s*-/, "expected a negative offset");
  assert.match(summaryRule[1], /\[open\]/, "summary offset is not scoped to [open]");

  const sectionRule = /\.markdown-body details\[data-spek-fold\]([^{>]*)\{([^}]*)\}/.exec(css);
  assert.ok(sectionRule, "expected a rule insetting the section");
  assert.match(sectionRule[1], /\[open\]/, "section inset is not scoped to [open]");
  assert.match(sectionRule[2], /border-left/, "expected the extent rule");
});

test("the extent rule does not use the panel border colour", () => {
  // `--color-border` measures 1.42:1 dark and 1.18:1 light — below the 3:1 the spec now requires.
  const css = readFileSync(
    fileURLToPath(new URL("../styles/global.css", import.meta.url)),
    "utf8"
  );
  const rule = /\.markdown-body details\[data-spek-fold\]\[open\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(rule, /var\(--color-fold-rule\)/);
  assert.ok(!rule.includes("--color-border"), "the extent rule fell back to the panel border colour");
});

// 摺疊本身的行為由 MarkdownRenderer.fold.test.ts 涵蓋；這裡只確認降級沒有動到分段邊界。
test("demoting the h2 does not move a fold boundary", () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownRenderer, {
      content: DELTA,
      specShaped: true,
      fold: foldOptionsFor("default"),
    })
  );
  // The operation heading stays outside the folds it introduces.
  assert.match(html, /<h2 id="added-requirements"[^>]*>.*?<\/h2>\s*<details/s);
  assert.equal(html.match(/<details/g)?.length, 2, "one requirement plus one scenario");
});
