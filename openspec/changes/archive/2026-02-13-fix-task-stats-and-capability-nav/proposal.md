## Why

Dashboard 的 task completion 永遠顯示 0%，因為 overview API 只統計 active changes 的 task stats，但實際上所有 changes 都已 archived。此外，Change detail 頁面的 Proposal tab 中 Capabilities 區塊列出的 capability ID 應該可以點擊導航到對應的 spec 頁面，目前只是純文字無法互動。

## What Changes

- 修正 overview API 的 taskStats 統計邏輯，將 archived changes 的 tasks 納入計算
- 在 Change detail 的 Proposal tab 中，將 capability ID（反引號包裹的 kebab-case 識別碼）渲染為可點擊的連結，導航到對應的 `/specs/:topic` 頁面

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `openspec-api`: overview endpoint 的 taskStats 改為統計所有 changes（含 archived），而非僅 active changes
- `change-browsing`: Proposal tab 中的 capability ID 應渲染為可導航至對應 spec 的連結

## Impact

- **後端**: `server/routes/openspec.ts` — overview endpoint 的 taskStats 聚合邏輯
- **前端**: `src/components/MarkdownRenderer.tsx` 或 `src/pages/ChangeDetail.tsx` — capability ID 連結渲染
- **Spec 更新**: `openspec-api` 與 `change-browsing` 的 spec 需更新以反映新行為
