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
  const rule = /details\[data-spek-fold\]\[open\] details\[data-spek-fold\]\[open\]::before\s*\{([^}]*)\}/.exec(css())?.[1];
  assert.ok(rule, "expected a rule silencing the nested extent mark");
  assert.match(rule, /content:\s*none/);
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

test("the fold lead still restates the heading margins it replaced", () => {
  // 摺疊標題自己的 `mt-*` 被歸零，那段留白改由區塊的 `--color-fold-lead` 提供 —— 於是同一個距離寫在兩
  // 個地方，而 CSS 讀不到元件的 class，沒有機制能像線的起點那樣把它收成一個來源。把 h3 改成 `mt-6`，
  // 未摺疊的內容會動、摺疊的規格不會，而且不會有任何東西失敗。這條測試就是那個會失敗的東西。
  const tsx = readFileSync(
    fileURLToPath(new URL("./MarkdownRenderer.tsx", import.meta.url)),
    "utf8"
  );
  // Tailwind 的間距刻度是 0.25rem 一格。
  const headingLead = (tag: string): number | undefined => {
    const cls = new RegExp(`<${tag}\\b[^>]*className="([^"]*)"`).exec(tsx)?.[1];
    const step = cls && /\bmt-(\d+)\b/.exec(cls)?.[1];
    return step ? Number(step) * 0.25 : undefined;
  };
  const declared = (selector: RegExp): number | undefined => {
    const rem = selector.exec(css())?.[1];
    return rem ? Number(rem) : undefined;
  };

  assert.equal(
    declared(/\.markdown-body details\[data-spek-fold\]\s*\{[^}]*--color-fold-lead:\s*([\d.]+)rem/),
    headingLead("h3"),
    "the section's leading space no longer matches the requirement heading's own margin"
  );
  assert.equal(
    declared(/details\[data-spek-fold\] details\[data-spek-fold\]\s*\{[^}]*--color-fold-lead:\s*([\d.]+)rem/),
    headingLead("h4"),
    "the nested leading space no longer matches the scenario heading's own margin"
  );
});

test("the fold trail still restates the content margin it clears", () => {
  // 線的底端讓開的是內文最後一段的下邊距。它跟 lead 一樣是「寫在兩個地方的同一個距離」—— 段落的
  // `mb-4` 改了而這裡沒改，線就會重新長出那一截，或反過來短一截，兩種都沒有東西會失敗。
  const tsx = readFileSync(
    fileURLToPath(new URL("./MarkdownRenderer.tsx", import.meta.url)),
    "utf8"
  );
  const trailing = (tag: string): number | undefined => {
    const cls = new RegExp(`<${tag}\\b[^>]*className="([^"]*)"`).exec(tsx)?.[1];
    const step = cls && /\bmb-(\d+)\b/.exec(cls)?.[1];
    return step ? Number(step) * 0.25 : undefined;
  };
  const declared = /--color-fold-trail:\s*([\d.]+)rem/.exec(css())?.[1];
  assert.ok(declared, "expected the trailing space the mark clears to be declared");
  assert.equal(Number(declared), trailing("p"), "the mark's end no longer clears a paragraph's trailing margin");
  // 段落與清單刻意同值；不同的話「內文結尾」就不是一個距離，這條規則本身要重想。
  assert.equal(trailing("ul"), trailing("p"), "list and paragraph trailing margins have diverged");
});

test("the mark starts where the leading space ends", () => {
  // 線的起點與它必須讓開的那段留白是同一個值的兩次使用。這裡不比對兩個數字，而是要求兩邊讀同一個自訂
  // 屬性 —— 數字相等只是當下成立，共用一個來源才是改不到一半。
  const text = css();
  const lead = /\.markdown-body details\[data-spek-fold\]\s*\{[^}]*padding-top:\s*var\((--[\w-]+)\)/.exec(text)?.[1];
  const start = /\.markdown-body details\[data-spek-fold\]\[open\]::before\s*\{[^}]*top:\s*var\((--[\w-]+)\)/.exec(text)?.[1];
  assert.ok(lead && start, "expected both the leading space and the mark's start to read a custom property");
  assert.equal(start, lead, "the mark's start no longer reads the property that holds the leading space");
});

test("the leading space is not scoped to open state", () => {
  // 收合的區塊沒有範圍可標，但一樣有標題。只有展開才留這段空間的話，讀者一開合，標題自己就會上下跳
  // —— 預設模式（requirement 展開、scenario 收合）第一眼就看得到。
  const rule = /\.markdown-body details\[data-spek-fold\]\s*\{([^}]*)\}/.exec(css())?.[1];
  assert.ok(rule, "expected an unscoped rule holding the leading space");
  assert.match(rule, /padding-top:/);
});

test("sibling sections are separated, and the separation does not depend on open state", () => {
  // `[open]` 一旦混進來，展開／收合就會改變區塊之間的距離，讀者切一個 scenario 整頁就會跳。
  const rule = /\.markdown-body details\[data-spek-fold\]\s*\{([^}]*)\}/.exec(css())?.[1];
  assert.ok(rule, "expected an unscoped rule spacing the sections");
  assert.match(rule, /margin-bottom:/);
  assert.match(rule, /display:\s*flow-root/, "without a BFC the gap follows the last child's margin");
});
