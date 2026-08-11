import { test } from "node:test";
import assert from "node:assert/strict";
import { extractHeadings, slugifyHeading, specHeadingLabel } from "./headings.js";

test("slugifyHeading: lowercase and dash", () => {
  assert.equal(
    slugifyHeading("Requirement: Spec list with filtering"),
    "requirement-spec-list-with-filtering",
  );
});

test("slugifyHeading: collapses non-alphanumeric runs", () => {
  assert.equal(slugifyHeading("Hello,  World!! How?"), "hello-world-how");
});

test("slugifyHeading: preserves Unicode word characters", () => {
  assert.equal(slugifyHeading("章節 Foo"), "章節-foo");
});

test("slugifyHeading: empty string returns empty", () => {
  assert.equal(slugifyHeading(""), "");
});

test("extractHeadings: basic h2 and h3 in document order", () => {
  const content = `## Section A\n\n### Sub A1\n\n## Section B\n`;
  assert.deepEqual(extractHeadings(content), [
    { level: 2, text: "Section A", slug: "section-a" },
    { level: 3, text: "Sub A1", slug: "sub-a1" },
    { level: 2, text: "Section B", slug: "section-b" },
  ]);
});

test("extractHeadings: ignores h1 and h4+", () => {
  const content = `# Title\n\n## Section\n\n#### Detail\n\n##### Deeper\n`;
  assert.deepEqual(extractHeadings(content), [
    { level: 2, text: "Section", slug: "section" },
  ]);
});

test("extractHeadings: ignores headings inside fenced code blocks", () => {
  const content = [
    "## Real Section",
    "",
    "```md",
    "## Fake Section",
    "### Fake Sub",
    "```",
    "",
    "## After",
    "",
    "~~~",
    "### Also Fake",
    "~~~",
    "",
    "### Real Sub",
  ].join("\n");
  assert.deepEqual(extractHeadings(content), [
    { level: 2, text: "Real Section", slug: "real-section" },
    { level: 2, text: "After", slug: "after" },
    { level: 3, text: "Real Sub", slug: "real-sub" },
  ]);
});

test("extractHeadings: duplicate headings get numeric suffix", () => {
  const content = `## Scenario: Foo\n\n### Details\n\n## Scenario: Foo\n\n### Details\n`;
  assert.deepEqual(extractHeadings(content), [
    { level: 2, text: "Scenario: Foo", slug: "scenario-foo" },
    { level: 3, text: "Details", slug: "details" },
    { level: 2, text: "Scenario: Foo", slug: "scenario-foo-2" },
    { level: 3, text: "Details", slug: "details-2" },
  ]);
});

test("extractHeadings: Unicode text preserved in slug", () => {
  const content = `## 章節 Foo\n`;
  assert.deepEqual(extractHeadings(content), [
    { level: 2, text: "章節 Foo", slug: "章節-foo" },
  ]);
});

test("extractHeadings: empty content returns empty array", () => {
  assert.deepEqual(extractHeadings(""), []);
});

test("extractHeadings: skips headings whose slug would be empty", () => {
  const content = `## ???\n\n## Real\n`;
  assert.deepEqual(extractHeadings(content), [
    { level: 2, text: "Real", slug: "real" },
  ]);
});

// --- specHeadingLabel ---

test("specHeadingLabel: elides the requirement keyword", () => {
  assert.equal(
    specHeadingLabel("Requirement: Single YAML manifest as source of truth"),
    "Single YAML manifest as source of truth",
  );
});

test("specHeadingLabel: elides the scenario keyword", () => {
  assert.equal(
    specHeadingLabel("Scenario: manifest declares both channels"),
    "manifest declares both channels",
  );
});

test("specHeadingLabel: text carrying no keyword is unchanged", () => {
  assert.equal(specHeadingLabel("ADDED Requirements"), "ADDED Requirements");
  assert.equal(specHeadingLabel("Purpose"), "Purpose");
});

test("specHeadingLabel: a keyword-only heading is unchanged", () => {
  // 剝完沒有別的名字可顯示，寧可留著關鍵字也不要顯示空白。
  assert.equal(specHeadingLabel("Requirement:"), "Requirement:");
  assert.equal(specHeadingLabel("Requirement:   "), "Requirement:   ");
});

test("specHeadingLabel: a case variant is unchanged", () => {
  // OpenSpec 自己的 parser 不接受的寫法，這裡也不該悄悄正規化。
  assert.equal(
    specHeadingLabel("requirement: lowercase keyword"),
    "requirement: lowercase keyword",
  );
});

test("specHeadingLabel: a keyword that is not at the start is unchanged", () => {
  assert.equal(
    specHeadingLabel("Optional Requirement: something"),
    "Optional Requirement: something",
  );
});

test("specHeadingLabel: a name beginning with inline markup still elides", () => {
  // 這一段的第一個純文字節點剛好就是 `Requirement: `。只看那一段會誤判成「剝完就空了」，
  // 於是內文留著關鍵字、而讀整行的 TOC 剝掉 —— 兩個介面對同一個標題講不同的話。
  assert.equal(
    specHeadingLabel("Requirement: `@spekjs/ui` package exports reusable components"),
    "`@spekjs/ui` package exports reusable components",
  );
});

test("specHeadingLabel: trailing whitespace survives", () => {
  // 標題會繼續接到 label 帶不走的 markup 上；這個空格被 trim 掉，code span 就會黏住前一個字。
  assert.equal(specHeadingLabel("Requirement: The "), "The ");
});

test("extractHeadings: text and slug keep the format keyword", () => {
  // 守衛：display label 沒有被接進 extraction。slug 是所有錨點的依據，一旦改掉，既有深連結全數失效。
  assert.deepEqual(extractHeadings("### Requirement: Foo\n"), [
    { level: 3, text: "Requirement: Foo", slug: "requirement-foo" },
  ]);
});
