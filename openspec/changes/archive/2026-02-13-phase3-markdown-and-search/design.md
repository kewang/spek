## Context

Phase 2 完成了核心 UI 頁面，但所有 Markdown 內容以 `<pre>` 顯示原始文字。搜尋按鈕為 disabled placeholder。後端搜尋 API（`/api/openspec/search`，使用 Fuse.js）已在 Phase 1 實作完成。

目前前端尚未安裝 `react-markdown` 或 `remark-gfm`，需新增這兩個依賴。

## Goals / Non-Goals

**Goals:**
- 以 react-markdown 渲染所有 Markdown 內容，支援 GFM（表格、checkbox、strikethrough）
- 實作 BDD 語法高亮，讓 WHEN/THEN/MUST 等關鍵字在視覺上突出
- 提供 SearchDialog 搜尋對話框，支援 Cmd+K / Ctrl+K 快捷鍵
- 搜尋結果按類型分組（spec / change），點擊可導覽至對應頁面

**Non-Goals:**
- 不做 Markdown 編輯功能
- 不修改後端搜尋 API 邏輯
- 不做搜尋結果的 client-side re-ranking（直接使用後端排序）
- 不做搜尋歷史記錄

## Decisions

### D1: BDD 高亮實作方式 — react-markdown custom components

使用 react-markdown 的 `components` prop 自訂渲染。在段落（`p`）和列表項（`li`）元件中，對文字節點進行正規表達式匹配，將 BDD 關鍵字包裹在 `<span>` 中套用對應樣式。

**替代方案**：remark plugin 做 AST 轉換 — 較複雜且不易維護，BDD 高亮本質是視覺層處理，不需要改動 AST。

**關鍵字與樣式對應**：
- `WHEN`、`GIVEN` → 藍色背景標籤 (`bg-blue-500/20 text-blue-400`)
- `THEN` → 綠色背景標籤 (`bg-green-500/20 text-green-400`)
- `AND` → 灰色背景標籤 (`bg-gray-500/20 text-gray-400`)
- `MUST`、`SHALL` → 紅色粗體 (`text-red-400 font-bold`)
- `ADDED`、`MODIFIED` → 橘/藍 badge (`bg-orange-500/20` / `bg-blue-500/20`)

匹配規則：僅在單字邊界（word boundary）匹配，且關鍵字為全大寫時才觸發，避免誤匹配一般英文文字。

### D2: SearchDialog 設計 — Modal overlay + 即時搜尋

採用 modal overlay 模式，按 `Cmd+K` / `Ctrl+K` 開啟，按 `Escape` 關閉。輸入文字時 debounce 300ms 後呼叫後端搜尋 API。

結果按 type 分組顯示（Specs / Changes），每筆結果顯示名稱和上下文預覽片段。點擊結果使用 React Router `navigate()` 跳轉到對應頁面。

支援鍵盤導覽：上下箭頭選取結果、Enter 確認跳轉。

### D3: MarkdownRenderer 整合點

MarkdownRenderer 作為純展示元件，接受 `content: string` prop。在以下位置使用：
- `SpecDetail.tsx` — 替換 `<pre>{data.content}</pre>`
- `ChangeDetail.tsx` — 替換 proposal、design、specs tab 的 `<pre>` 區塊
- Tasks tab 保持現有的結構化顯示（checkbox + progress），不使用 MarkdownRenderer

## Risks / Trade-offs

- **[效能] 大型 Markdown 檔案渲染延遲** → react-markdown 已有虛擬化機制，且 OpenSpec 檔案通常不超過數百行，風險低
- **[誤匹配] BDD 關鍵字出現在程式碼區塊中** → 僅在非 code 元素中執行高亮，`code` 和 `pre` 元件不做處理
- **[搜尋延遲] 每次輸入都打 API** → debounce 300ms 減少請求頻率；後端為本地檔案讀取，延遲可忽略
