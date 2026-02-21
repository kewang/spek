## Why

ChangeDetail 頁面的 tab 導航（Proposal / Design / Specs / Tasks）和 change 標題在內容較長時會隨頁面捲動消失，使用者必須捲回頂部才能切換 tab，影響瀏覽體驗。

## What Changes

- 將 ChangeDetail 頁面的 change 標題（含返回連結）和 tab 導航列固定在頂部（sticky），捲動時不會消失
- TabView 元件新增 sticky 定位支援，讓 tab bar 區塊可黏在頁面頂部

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `change-browsing`: Change detail 的 tab 導航列和標題在捲動時固定於頂部

## Impact

- `packages/web/src/components/TabView.tsx` — 新增 sticky 定位支援
- `packages/web/src/pages/ChangeDetail.tsx` — 調整結構讓標題和 tab 一起 sticky
- 不影響 API、後端或其他頁面
