## Context

ChangeDetail 頁面使用 `TabView` 元件呈現 Proposal / Design / Specs / Tasks 四個 tab。目前頁面滾動由 window 層級處理（Layout 的 `<main>` 沒有獨立 scroll container），header 是 `fixed top-0 h-14`，main content 以 `pt-18 p-6` 偏移。

當 change 內容較長時，使用者需捲回頂部才能看到 tab 導航列和 change 標題。

## Goals / Non-Goals

**Goals:**
- 讓 change 標題（含返回連結）和 tab 導航列在捲動時 sticky 固定於 header 下方
- 對現有 TabView 做最小幅度修改，保持元件通用性

**Non-Goals:**
- 不改其他頁面的捲動行為
- 不改 Layout header 或 Sidebar 結構

## Decisions

### 1. 在 TabView 加入 `header` 和 `sticky` props

**選擇**：擴充 TabView 接受可選的 `header` ReactNode 和 `sticky` boolean prop。sticky 為 true 時，header + tab bar 一起包在 `sticky top-14` 容器中。

**理由**：TabView 目前只被 ChangeDetail 使用，但保持 props 可選讓元件仍可在無 sticky 的情境通用。比起在 ChangeDetail 中手動管理 tab state，此方式不重複邏輯。

**替代方案**：在 ChangeDetail 中自行管理 activeTab state 並手動 render tab buttons + content — 但會重複 TabView 已有的邏輯。

### 2. 使用 CSS `sticky` 而非 `fixed`

**選擇**：使用 `position: sticky; top: 3.5rem`（`top-14`，緊貼 Layout header 下方）。

**理由**：sticky 自然跟隨文件流，不需手動計算寬度或 offset，也不影響 content 排版。因為頁面用 window scroll 而非 overflow container，sticky 在 `<main>` 內可正確運作。

### 3. Sticky 容器負 margin + padding 拉寬至 main 邊界

**選擇**：sticky 容器用 `-mx-6 px-6` 讓背景色延伸至 main 的 padding 邊界，避免左右露出底部內容。

**理由**：main 有 `p-6`，若 sticky 容器不補齊，捲動時兩側會透出下方內容，視覺不佳。

## Risks / Trade-offs

- **z-index 衝突**：sticky 容器需要 z-index 高於 content 但低於 header（z-10）和 sidebar（z-30）。使用 `z-[5]` 可滿足此需求。
- **背景色遮蓋**：sticky 容器必須有 `bg-bg-primary` 背景才能遮住下方捲動的內容。
