## Context

目前 Layout 元件在桌面模式下固定渲染 240px 寬的 sidebar（`w-60`），主內容區域用 `ml-60` 左移。行動裝置則用 overlay 模式。使用者反饋希望能折疊 sidebar 以獲得更多閱讀空間。

現有 Sidebar 元件已接受 `open`、`isMobile`、`onClose` props，桌面模式下不使用 `open` 狀態。

## Goals / Non-Goals

**Goals:**
- 桌面模式下可收合/展開 sidebar
- 收合態顯示 icon-only 窄條，仍可導覽
- 收合狀態持久化（Web 用 localStorage）
- 動畫過渡流暢
- 行動裝置行為不變

**Non-Goals:**
- 不做拖曳調整 sidebar 寬度
- 不做 hover 自動展開（僅點擊 toggle）
- 不改變行動版 overlay sidebar 行為

## Decisions

### 1. 收合態寬度與 icon 設計

收合態 sidebar 寬度為 56px（`w-14`），僅顯示導覽項目的 icon。每個導覽連結需新增對應 icon：
- Overview → LayoutDashboard icon（田字格）
- Specs → FileText icon（文件）
- Changes → GitBranch icon（分支）

**理由**：56px 與 header 高度一致，視覺對齊；icon-only 模式保留導覽功能同時大幅節省空間。

### 2. Toggle 按鈕位置

在 sidebar 底部、Resync 按鈕上方放置 toggle 按鈕，使用左右箭頭 chevron icon 指示方向（展開時向左 `«`，收合時向右 `»`）。

**理由**：底部位置不干擾導覽操作，chevron 方向直覺提示操作結果。

### 3. 狀態管理

- Layout 元件新增 `collapsed` state
- Web 版透過 localStorage key `spek-sidebar-collapsed` 持久化
- Webview 版不做持久化（隨 webview 生命週期）
- 傳遞 `collapsed` 和 `onToggle` props 給 Sidebar 元件

**理由**：狀態提升到 Layout 層級讓主內容區域能同步調整邊距。localStorage 與現有 theme 儲存方式一致。

### 4. CSS 過渡動畫

使用 `transition-all duration-200` 讓 sidebar 寬度和主內容區域邊距平滑過渡。

**理由**：200ms 是常見的 UI 過渡時間，不會讓人感覺拖沓。

## Risks / Trade-offs

- [收合態 icon 辨識度] → 使用 tooltip（title 屬性）顯示完整名稱
- [Resync 按鈕在收合態] → 收合態只顯示 resync icon，不顯示文字
- [VS Code webview 空間較小] → 收合態在小 viewport 下更有用，不需特殊處理
