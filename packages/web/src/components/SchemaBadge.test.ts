import { test } from "node:test";
import assert from "node:assert/strict";
import { SchemaBadge } from "./SchemaBadge";

// 直接以函式呼叫 component 檢查其 render 決策（隱藏 → null、顯示 → 一個 pill span），
// 不需 DOM，對齊 repo 既有的純邏輯測試風格。
test("SchemaBadge: renders nothing when schema is falsy", () => {
  assert.equal(SchemaBadge({ schema: null, defaultSchema: "spec-driven" }), null);
  assert.equal(SchemaBadge({ schema: undefined, defaultSchema: "spec-driven" }), null);
  assert.equal(SchemaBadge({ schema: "", defaultSchema: "spec-driven" }), null);
});

test("SchemaBadge: renders nothing when schema equals the repo default", () => {
  assert.equal(SchemaBadge({ schema: "spec-driven", defaultSchema: "spec-driven" }), null);
  assert.equal(SchemaBadge({ schema: "agent-driven", defaultSchema: "agent-driven" }), null);
});

test("SchemaBadge: renders the schema name when it differs from the repo default", () => {
  const el = SchemaBadge({ schema: "superpowers-bridge", defaultSchema: "spec-driven" });
  assert.ok(el, "expected a pill element");
  assert.equal(el.props.children, "superpowers-bridge");
  // The tooltip says what the badge does now that it is a link, not just what it names.
  assert.equal(el.props.title, "Schema: superpowers-bridge — open its workflow");
});

test("SchemaBadge: renders a non-default schema even when the repo default is not spec-driven", () => {
  const el = SchemaBadge({ schema: "spec-driven", defaultSchema: "agent-driven" });
  assert.ok(el, "expected a pill element");
  assert.equal(el.props.children, "spec-driven");
});

test("SchemaBadge: renders when no repo default is known but the change has a schema", () => {
  const el = SchemaBadge({ schema: "spec-driven", defaultSchema: null });
  assert.ok(el, "expected a pill element");
  assert.equal(el.props.children, "spec-driven");
});
