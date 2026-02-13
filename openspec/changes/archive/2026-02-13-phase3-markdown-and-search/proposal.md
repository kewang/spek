## Why

Phase 2 完成了核心 UI 頁面，但 Markdown 內容以 `<pre>` 原始文字顯示，缺乏可讀性和 BDD 語法高亮。搜尋按鈕目前為 disabled 狀態，後端搜尋 API 已就緒但前端尚未串接。本階段將補齊 Markdown 渲染和搜尋 UI，使 spek 成為可實際使用的 OpenSpec 檢視器。

## What Changes

- 新增 `MarkdownRenderer` 元件，使用 `react-markdown` + `remark-gfm` 渲染 Markdown 內容
- 實作 BDD 語法高亮：WHEN/GIVEN（藍）、THEN（綠）、AND（灰）、MUST/SHALL（紅）、ADDED/MODIFIED（橘/藍 badge）
- 新增 `SearchDialog` 元件，支援 `Cmd+K` / `Ctrl+K` 快捷鍵開啟
- 串接後端 `/api/openspec/search` API，搜尋結果含上下文預覽
- 將 SpecDetail、ChangeDetail 頁面的 `<pre>` 替換為 `MarkdownRenderer`
- 將 Layout header 的 disabled search 按鈕替換為可用的搜尋觸發器
- 新增 `react-markdown` 和 `remark-gfm` npm 依賴

## Capabilities

### New Capabilities
- `markdown-renderer`: Markdown 渲染元件，含 GFM 支援與 BDD 語法高亮
- `search-ui`: 全文搜尋對話框 UI，含鍵盤快捷鍵與結果導覽

### Modified Capabilities
（無 spec 層級的需求變更，現有 API 行為不變）

## Impact

- **前端元件**：新增 `MarkdownRenderer.tsx`、`SearchDialog.tsx`；修改 `SpecDetail.tsx`、`ChangeDetail.tsx`、`Layout.tsx`
- **依賴**：新增 `react-markdown`、`remark-gfm` 套件
- **API**：僅串接現有 search API，無後端變更
- **樣式**：新增 BDD 高亮相關 CSS 規則
