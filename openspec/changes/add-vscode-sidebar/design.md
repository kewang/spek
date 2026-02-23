## Context

目前 spek VS Code extension 只提供兩個進入點：Command Palette（`spek.open`、`spek.search`）和 status bar item。使用者必須先知道有這些指令才能使用，可見性低。兩位 Marketplace 評論者（5 星）都建議新增 sidebar icon。

Extension 現有架構：
- 3 個 source files：`extension.ts`（activation + commands）、`panel.ts`（Webview Panel singleton）、`handler.ts`（API dispatch）
- 所有 UI 邏輯在 React webview 中，host 端僅處理 API 請求和生命週期
- `@spek/core` 提供 `scanOpenSpec()` 可直接取得 specs/changes 列表

## Goals / Non-Goals

**Goals:**
- 在 Activity Bar 新增 spek icon，提供 TreeView 瀏覽 OpenSpec 結構
- TreeView 顯示 Specs 和 Changes 兩個分組
- 點擊 TreeView item 開啟 webview panel 並導航到對應頁面
- 偵測到 openspec/ 時自動顯示 sidebar

**Non-Goals:**
- 不在 TreeView 中顯示 spec 內容預覽（內容仍在 webview 中呈現）
- 不支援從 TreeView 編輯 spec/change
- 不取代現有的 Command Palette 和 status bar 進入點

## Decisions

### 1. 使用 VS Code native TreeView（非 Webview sidebar）

**選擇**：使用 `vscode.TreeDataProvider` 實作原生 TreeView

**理由**：原生 TreeView 效能好、風格一致、不需額外 CSP 設定。Webview sidebar 更靈活但增加複雜度且違反 VS Code UX 慣例。

### 2. TreeView 結構：兩個 view（Specs + Changes）

**選擇**：在同一個 ViewContainer 下註冊兩個 TreeView：`spek.specsView` 和 `spek.changesView`

**理由**：分開的 view 讓使用者可以獨立收合，且各自有明確的 welcome message。單一 TreeView 用 group node 也可行，但兩個 view 更符合 VS Code 慣例（如 Explorer 有 OUTLINE、TIMELINE）。

### 3. 導航機制：postMessage navigate command

**選擇**：點擊 TreeView item 時，先 `createOrShow` webview panel，再 `postMessage({ type: 'navigate', path: '/specs/user-auth' })`

**理由**：webview 已有 React Router，直接透過 message 觸發 `navigate()` 最簡單。不需修改 MessageAdapter 或新增 API endpoint。

### 4. Activity Bar icon：自製 SVG

**選擇**：使用與 status bar 和 webview favicon 一致的 spek icon SVG

**理由**：品牌一致性。VS Code Activity Bar icon 需要 24x24 單色 SVG，需要從現有 favicon 調整。

### 5. TreeDataProvider 實作：單一檔案

**選擇**：新增 `packages/vscode/src/tree-provider.ts`，包含 `SpecsTreeProvider` 和 `ChangesTreeProvider` 兩個 class

**理由**：兩個 provider 邏輯相似但資料不同，放同一個檔案保持簡潔。都使用 `scanOpenSpec()` 取得資料。

### 6. 資料更新：利用現有 file watcher

**選擇**：在 `openspec/**` 檔案變更時（現有 file watcher 已偵測），呼叫 TreeDataProvider 的 `refresh()` 方法

**理由**：不需新增 watcher，複用現有機制。TreeDataProvider 透過 `onDidChangeTreeData` event 通知 VS Code 重新渲染。

## Risks / Trade-offs

- **TreeView 資料量** → `scanOpenSpec()` 是同步掃描，大量 spec 時可能短暫阻塞。Mitigation：extension host 已在使用此函式，目前規模不是問題。
- **Icon 設計** → Activity Bar icon 需要 24x24 單色 SVG，與彩色 favicon 不同。Mitigation：製作專用的單色版本。
- **Navigate message** → webview 需要能接收新的 `navigate` message type。Mitigation：在 React app 入口加一個 message listener 即可，改動很小。
