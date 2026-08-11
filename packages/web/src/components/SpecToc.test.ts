import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { SpecToc } from "./SpecToc";
import type { Heading } from "@spekjs/core/headings";

const HEADINGS: Heading[] = [
  { level: 2, text: "ADDED Requirements", slug: "added-requirements" },
  { level: 3, text: "Requirement: Foo", slug: "requirement-foo" },
];

const render = (specShaped?: boolean): string =>
  renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(SpecToc, { headings: HEADINGS, specShaped })),
  );

test("entries drop the format keyword under the declaration", () => {
  const html = render(true);
  assert.match(html, />Foo</);
  assert.ok(!html.includes("Requirement: Foo"), "the keyword survived in a TOC entry");
});

test("entries are verbatim without the declaration", () => {
  // 同一個元件也服務 change 的 proposal / design tab，那些不是 spec。
  assert.match(render(), />Requirement: Foo</);
});

test("the anchor is the slug of the authored text either way", () => {
  for (const html of [render(true), render()]) {
    assert.match(html, /href="#requirement-foo"/);
  }
});

test("headings carrying no keyword are unaffected", () => {
  assert.match(render(true), />ADDED Requirements</);
});
