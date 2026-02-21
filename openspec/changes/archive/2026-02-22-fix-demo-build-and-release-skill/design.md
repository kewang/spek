## Context

`scanOpenSpec` 在 v0.5.0 加入 git timestamp cache 時從同步改為 async，但 `scripts/build-demo.ts` 的呼叫端沒有跟著加 `await`，導致拿到 Promise 物件而非 ScanResult。自 v0.4.0 以來 demo build 都會失敗。

Release skill（`.agents/skills/release/SKILL.md`）流程中沒有 demo rebuild 步驟，即使 bug 修復後 release 時仍不會自動更新 demo page。

## Goals / Non-Goals

**Goals:**
- 修復 `build-demo.ts` 使 `npm run build:demo` 正常運作
- 在 release skill 流程中加入 demo rebuild，確保每次 release 都更新 GitHub Pages demo
- 重新產生 `docs/demo.html` 反映當前版本

**Non-Goals:**
- 不建立 CI/CD workflow 自動部署 demo（透過 release skill 手動觸發即可）
- 不改變 demo build 架構或輸出格式

## Decisions

1. **修復方式：加 `await`** — `build-demo.ts` 第 25 行 `scanOpenSpec(ROOT)` 前加 `await`。這是唯一需要的程式碼修改。

2. **Release skill 步驟位置：changelog commit 之後、npm version 之前** — 在步驟 4（commit changelog）與原步驟 5（npm version）之間插入 demo rebuild。這樣 demo 的 commit 會在 version tag 之前，確保 tag 指向的 commit 包含最新 demo。

## Risks / Trade-offs

- demo.html 檔案較大（~1.1 MB），每次 release 都會產生大 diff — 可接受，因為是 build artifact
- Release 時間會略增（demo build 約 3 秒）— 影響極小
