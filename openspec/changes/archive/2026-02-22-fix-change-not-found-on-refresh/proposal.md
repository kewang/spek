## Why

使用者在 spek 中開啟一個 active change 頁面後，當該 change 被 archive（檔案從 `openspec/changes/<slug>/` 搬移到 `openspec/changes/archive/<slug>/`），file watcher 觸發 refresh re-fetch。若在搬移過程中發生短暫的競態條件導致 re-fetch 失敗，`useAsyncData` 保留了舊 data 但同時也設了 error，而頁面元件的 `if (error)` 檢查在 `if (!data)` 之前，導致即使有有效資料仍顯示 "Change not found" 錯誤。此外，Web 版的 `FetchAdapter` 丟出的錯誤訊息只有 "HTTP 404"，未解析 server 回應的描述性錯誤訊息。

## What Changes

- 修正 `useAsyncData` hook：當 refresh 觸發的 re-fetch 失敗且有既存 data 時，不設定 error（靜默保留舊資料）
- 改善 `FetchAdapter` 的 `fetchJson`：解析 server 回應的 error body，顯示更具描述性的錯誤訊息

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `live-reload`：新增 refresh re-fetch 失敗時的行為規範 — 若有既存資料應靜默保留，不顯示錯誤

## Impact

- `packages/web/src/hooks/useOpenSpec.ts` — `useAsyncData` catch handler
- `packages/web/src/api/FetchAdapter.ts` — `fetchJson` 錯誤處理
