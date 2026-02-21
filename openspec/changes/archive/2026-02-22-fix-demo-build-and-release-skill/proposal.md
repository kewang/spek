## Why

`build-demo.ts` 在 `scanOpenSpec` 改為 async 後漏加 `await`，導致 demo build 失敗。自 v0.4.0 起 `docs/demo.html` 就沒有更新過。同時 release skill 未包含 demo rebuild 步驟，即使 bug 修復後仍會在每次 release 時遺漏 demo 更新。

## What Changes

- 修復 `scripts/build-demo.ts` 中 `scanOpenSpec()` 呼叫缺少 `await` 的 bug
- 在 release skill（`.agents/skills/release/SKILL.md`）中新增 demo rebuild 步驟，確保每次 release 都會更新 `docs/demo.html`
- 重新 build `docs/demo.html` 使其反映最新版本

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

（無 — 此修改僅涉及 build script bug fix 和 skill 文件調整，不影響任何 spec-level 行為）

## Impact

- `scripts/build-demo.ts` — 加入 `await`
- `.agents/skills/release/SKILL.md` — 新增步驟 5（rebuild demo）、步驟編號順延
- `docs/demo.html` — 重新產生，檔案內容會大幅變動（反映 v0.4.0 ~ v0.6.4 的所有功能）
