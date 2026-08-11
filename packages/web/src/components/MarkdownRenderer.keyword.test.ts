import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MarkdownRenderer } from "./MarkdownRenderer";

const SPEC = `## ADDED Requirements

### Requirement: Foo

The system SHALL do the thing.

#### Scenario: bar happens

- **WHEN** a thing happens
- **THEN** another thing happens
`;

const render = (content: string, specShaped?: boolean): string =>
  renderToStaticMarkup(createElement(MarkdownRenderer, { content, specShaped }));

test("spec-shaped headings render without the format keyword", () => {
  const html = render(SPEC, true);
  assert.match(html, /<h3[^>]*>Foo<\/h3>/);
  assert.match(html, /<h4[^>]*>bar happens<\/h4>/);
});

test("the id is still built from the authored text", () => {
  // 這條是整個 change 唯一會無聲壞掉的地方：關鍵字若在 id 指派之前就剝掉，每個 requirement 的 id
  // 都會變，而走 extractHeadings 的 TOC 與側欄仍產出原本的 slug —— 畫面照常，連結全數失效。
  const html = render(SPEC, true);
  assert.match(html, /<h3 id="requirement-foo"/);
  assert.equal(
    /<h3 id="([^"]*)"/.exec(html)?.[1],
    /<h3 id="([^"]*)"/.exec(render(SPEC))?.[1],
    "the id changed when the keyword was elided",
  );
});

test("a name beginning with a code span keeps the span and the space before it", () => {
  // 本 repo 的 ui-package spec 就是這個形狀。第一個純文字節點恰好是 `Requirement: `。
  const html = render(
    "### Requirement: `@spekjs/ui` package exports reusable components\n",
    true,
  );
  assert.match(html, /<h3[^>]*><code[^>]*>@spekjs\/ui<\/code> package exports reusable components<\/h3>/);
  assert.ok(!html.includes("Requirement:"), "the keyword survived on a code-span heading");
});

test("a heading opening with markup is left alone rather than half-elided", () => {
  // 關鍵字沒有完整落在第一個純文字節點裡；跨 markup 去剝等於刪掉作者寫的結構。
  const html = render("### **Requirement:** Foo\n", true);
  assert.match(html, /Requirement:/);
});

test("without the declaration nothing is elided", () => {
  const html = render(SPEC);
  assert.match(html, /<h3[^>]*>Requirement: Foo<\/h3>/);
  assert.match(html, /<h4[^>]*>Scenario: bar happens<\/h4>/);
});

test("structural headings are untouched in both renderings", () => {
  for (const html of [render(SPEC, true), render(SPEC)]) {
    assert.match(html, /ADDED Requirements/);
  }
  assert.match(render("## Purpose\n\nProse.\n", true), /Purpose/);
});

test("a heading at another level is elided on the same terms", () => {
  // 層級不是判準：`extractHeadings` 只回 h2/h3，內文全部顯示，按層級 gate 兩邊就會不一致。
  assert.match(render("## Requirement: Foo\n", true), /<h2[^>]*>Foo<\/h2>/);
});

// --- 摺疊區塊的範圍線：CSS 規則形狀的守衛（jsdom 量不到版面） ---

const css = (): string =>
  readFileSync(fileURLToPath(new URL("../styles/global.css", import.meta.url)), "utf8");

test("a nested open section draws no mark of its own", () => {
  const rule = /details\[data-spek-fold\]\[open\] details\[data-spek-fold\]\[open\]\s*\{([^}]*)\}/.exec(css())?.[1];
  assert.ok(rule, "expected a rule silencing the nested extent mark");
  assert.match(rule, /border-left-color:\s*transparent/);
});

test("the summary offset cancels the inset exactly", () => {
  // 標題要留在區塊外緣，靠的是負 margin 與 padding 相等。改一邊沒改另一邊，標題就會相對於區塊外的
  // 內容漂掉 —— 而縮排寬度是會被調整的東西（0.75rem → 1rem 就發生過一次）。
  const text = css();
  const pad = /\.markdown-body details\[data-spek-fold\]\[open\]\s*\{[^}]*padding-left:\s*([\d.]+)rem/.exec(text)?.[1];
  const offset = /\.markdown-body details\[data-spek-fold\]\[open\]\s*>\s*summary\s*\{[^}]*margin-left:\s*-([\d.]+)rem/.exec(text)?.[1];
  assert.ok(pad && offset, "expected both the inset and the summary offset in rem");
  assert.equal(offset, pad, "the summary offset no longer cancels the inset");
});

test("the disclosure marker clears the mark in both open states", () => {
  // 位移若只給展開的區塊，收合中的標題就會差一格 —— 預設模式正是 requirement 展開、scenario 收合。
  const rule = /\.markdown-body details\[data-spek-fold\] > summary\s*\{([^}]*)\}/.exec(css())?.[1];
  assert.ok(rule, "expected an unscoped rule offsetting the summary content");
  assert.match(rule, /padding-left:/);
});

test("sibling sections are separated, and the separation does not depend on open state", () => {
  // `[open]` 一旦混進來，展開／收合就會改變區塊之間的距離，讀者切一個 scenario 整頁就會跳。
  const rule = /\.markdown-body details\[data-spek-fold\]\s*\{([^}]*)\}/.exec(css())?.[1];
  assert.ok(rule, "expected an unscoped rule spacing the sections");
  assert.match(rule, /margin-bottom:/);
  assert.match(rule, /display:\s*flow-root/, "without a BFC the gap follows the last child's margin");
});
