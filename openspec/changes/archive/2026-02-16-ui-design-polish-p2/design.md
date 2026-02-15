## Context

P0+P1 修正（commit 91bc191）完成了關鍵 bug 修復與基礎視覺改善。目前殘餘的 P2 問題影響日常瀏覽體驗：h1 緊貼 navbar、tab 順序與工作流程不符、返回連結不夠顯眼、tab 切換生硬、列表信息密度低、搜尋缺乏高亮與 filter、changes 列表視覺單調、tasks checkbox 使用原生樣式。

現有元件結構：
- `Layout.tsx` — 主內容區 `<main>` 使用 `pt-14 p-6`（pt-14 = 56px 對應 header 高度，p-6 = 24px 全方位 padding）
- `TabView.tsx` — 通用 tab 元件，無動畫
- `ChangeDetail.tsx` — tab 順序為 Proposal → Design → Tasks → Specs；返回連結 `text-sm`
- `SpecDetail.tsx` — 返回連結 `text-sm`
- `SpecList.tsx` / `ChangeList.tsx` — 只顯示名稱，無摘要
- `SearchDialog.tsx` — 無匹配高亮、無分類 filter

## Goals / Non-Goals

**Goals:**
- 增加頁面標題與 navbar 之間的視覺間距
- 修正 tab 順序符合 OpenSpec 工作流程（Proposal → Design → Specs → Tasks）
- 放大返回連結字體提升可見性
- Tab 切換加入 fade 過渡動畫
- 列表頁增加信息密度（摘要/統計）
- 搜尋結果高亮匹配文字、加入分類 filter
- Active/Archived changes 視覺區隔更明顯
- Tasks checkbox 自訂樣式

**Non-Goals:**
- Breadcrumb 導航（會增加複雜度且目前頁面層級只有 2 層，返回連結足夠）
- Grid/list 雙模式切換（P3 再考慮）
- 最近搜尋紀錄（P3）
- Skeleton loading（P3）

## Decisions

### 1. H1 頂部間距：在 `<main>` 增加 padding-top

**方案**：將 `pt-14` 改為 `pt-20`（從 56px → 80px），增加 24px 呼吸空間。

**理由**：直接在 Layout 層修改最簡單，所有頁面統一受益，不需逐頁調整。相比在每個頁面 h1 加 `mt-*`，這個方案更一致。

### 2. Tab 順序修正：調整 ChangeDetail tabs 陣列

**方案**：將 `tabs` 陣列中 `tasks` 和 `specs` 互換位置，變為 Proposal → Design → Specs → Tasks。

**理由**：符合 OpenSpec 工作流程（先寫 spec 才能產生 tasks）。改動極小，只調換陣列元素順序。

### 3. 返回連結字體：從 `text-sm` 改為 `text-base`

**方案**：SpecDetail 和 ChangeDetail 的返回連結從 `text-sm`（14px）改為 `text-base`（16px），並加入 `font-medium`。

**理由**：`text-base` 提升可讀性但不會過大搶走標題視覺權重。加入 `font-medium` 增加存在感。

### 4. Tab 切換動畫：CSS transition + key-based re-render

**方案**：在 TabView 的內容區域加入 CSS `transition` + `opacity` fade 效果。使用 `key={activeId}` 觸發 re-mount 搭配 CSS `@keyframes fadeIn` 動畫。

**理由**：純 CSS 方案最輕量。不需引入 animation library（如 framer-motion）。fade-in 效果簡潔且不影響效能。

### 5. 列表摘要：Specs 顯示歷史數、Changes 顯示 proposal 摘要

**方案**：
- SpecList：在每個 spec 卡片加入歷史 change 數量（需 API 支援，但目前 `SpecInfo` 已有 `historyCount`）
- ChangeList：Active changes 已有 TaskProgress；Archived changes 顯示描述即可（目前已有）

**理由**：利用現有資料結構，不需新增 API。SpecInfo 中的 `historyCount` 可直接使用。

### 6. 搜尋高亮：在 ResultItem 中 highlight 匹配片段

**方案**：建立 `highlightMatch(text, query)` 工具函式，將匹配部分用 `<mark>` 標籤包裹（背景色 accent/20）。同時加入 type filter toggle（All / Specs / Changes）。

**理由**：純前端實現，不需改 API。`<mark>` 語義正確且容易 style。

### 7. Changes 視覺區隔：Active 加左側 accent 色條

**方案**：Active changes 卡片加入左側 4px accent 色條（`border-l-4 border-accent`），Archived 保持現狀。

**理由**：最小改動達到最大視覺區隔效果。左側色條是常見的狀態標示模式。

### 8. Tasks checkbox 自訂樣式：CSS 自訂 checkbox 圖示

**方案**：用 SVG icon 取代文字 `[x]`/`[ ]`，已完成項加入 `opacity-60` 淡化。使用 inline SVG checkmark（✓）和 empty circle。

**理由**：比原生 checkbox 更一致的外觀。`opacity-60` 搭配既有的 `line-through` 讓已完成項視覺降級更自然。

## Risks / Trade-offs

- **[風險] `pt-20` 在 mobile 可能過大** → 可使用 responsive class `pt-16 md:pt-20`，但 mobile 的 pt-14 已經包含 header 高度，改為 pt-16 仍會有改善。使用 `pt-18`（72px）作為折衷。
- **[風險] fade 動畫與快速連點 tab 衝突** → 動畫時間設短（150ms），即使快速切換也不會感覺遲鈍。
- **[風險] 搜尋高亮在特殊字元 query 可能出錯** → 對 query 進行 regex escape 處理。
- **[取捨] 不做 breadcrumb** → 目前頁面層級淺（最多 2 層），返回連結字體放大後已足夠。未來若加入更深層級再考慮。
