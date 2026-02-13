## Context

spek 目前是一個單體 Web 應用（Express + React SPA），使用者需要 `npm run dev` 啟動後在瀏覽器中操作。核心邏輯（OpenSpec 目錄掃描、tasks 解析）與 Express HTTP 層緊耦合在 `server/routes/` 中。

目標是新增 VS Code Extension 版本，將 React UI 嵌入 Webview Panel，同時保持現有 Web 版本正常運作。

## Goals / Non-Goals

**Goals:**
- 將 spek 重構為 monorepo，抽出共用核心邏輯
- 建立 VS Code Extension，使用 Webview Panel 呈現 React UI
- Extension 自動偵測 workspace 的 openspec/ 目錄
- 前端透過 API adapter 抽象層支援 fetch 和 postMessage 兩種通訊模式
- 現有 Web 版本功能不變，仍可獨立使用

**Non-Goals:**
- 不做 VS Code TreeView 原生 sidebar（保持 React UI 一致性）
- 不做 Extension marketplace 發布（先本地 .vsix 安裝）
- 不做 VS Code 原生 Markdown preview 整合
- 不做 multi-root workspace 支援（只取第一個 workspace folder）

## Decisions

### D1: Monorepo 結構 — npm workspaces

使用 npm workspaces 管理三個 package：

```
packages/
├── core/       # @spek/core — 純邏輯，無框架依賴
├── web/        # @spek/web — 現有 Express + React 應用
└── vscode/     # spek-vscode — VS Code Extension
```

**Why npm workspaces over turborepo/nx**: 專案規模小，不需要額外的 build orchestration 工具。npm workspaces 原生支援，零配置。

### D2: Core module 設計 — 純函式 + 型別定義

從 `server/lib/scanner.ts` 和 `server/lib/tasks.ts` 抽出核心邏輯，成為接受 `basePath: string` 參數的純函式。所有 TypeScript 型別定義也集中在 core。

```typescript
// packages/core/src/scanner.ts
export function scanOpenSpec(basePath: string): Promise<OpenSpecStructure>
export function readSpec(basePath: string, topic: string): Promise<SpecDetail>
export function readChange(basePath: string, slug: string): Promise<ChangeDetail>
export function searchContent(basePath: string, query: string): Promise<SearchResult[]>

// packages/core/src/tasks.ts
export function parseTasks(content: string): ParsedTasks
```

Core 直接使用 Node.js `fs/promises`，不依賴 Express 或 VS Code API。Web server 和 Extension host 都直接呼叫這些函式。

**Why 不用依賴注入 fs**: scanner 和 tasks parser 只需要讀取本地檔案，Node.js fs 在 Express 和 VS Code extension host 中都可用，不需要額外抽象。

### D3: Webview 通訊 — postMessage + request/response 模式

Extension host 和 Webview 之間使用 `postMessage` 通訊，模擬 HTTP request/response 模式：

```typescript
// Webview → Extension Host
{ type: 'request', id: 'req-1', method: 'getOverview' }

// Extension Host → Webview
{ type: 'response', id: 'req-1', data: { specsCount: 5, ... } }
```

每個 request 帶唯一 id，response 回傳相同 id，前端用 Promise 包裝等待對應回覆。

### D4: API Adapter — 策略模式

前端新增 `ApiAdapter` 介面，hooks 透過 adapter 呼叫 API：

```typescript
interface ApiAdapter {
  getOverview(): Promise<OverviewData>;
  getSpecs(): Promise<SpecInfo[]>;
  getSpec(topic: string): Promise<SpecDetail>;
  getChanges(): Promise<ChangesData>;
  getChange(slug: string): Promise<ChangeDetail>;
  search(query: string): Promise<SearchResult[]>;
  browse(path: string): Promise<BrowseData>;
  detect(path: string): Promise<DetectData>;
}
```

- `FetchAdapter`: 呼叫 `fetch('/api/...')`，用於 Web 版
- `MessageAdapter`: 透過 `postMessage` 傳送請求，用於 Webview 版

Adapter 透過 React Context 注入，hooks 從 context 取得 adapter 實例。

**Why 不用 service worker**: postMessage 更直接，service worker 在 Webview 中支援不穩定。

### D5: Vite build for Webview — 單一 HTML bundle

Webview 需要載入的 assets 路徑必須透過 `webview.asWebviewUri()` 轉換。Vite build 設定：

- 產出單一 `index.html` + JS/CSS 各一檔
- Extension 啟動時讀取 build output 的 HTML，替換 asset 路徑為 webview URI
- Tailwind CSS 透過 build 產出，不需 inline style（避免 CSP 問題）

### D6: Extension 生命週期

- `activate`: 掃描 workspace folders 尋找 openspec/ 目錄，若找到則在 status bar 顯示 icon
- Command `spek.open`: 建立或聚焦 Webview Panel
- Command `spek.search`: 開啟 Webview 並觸發搜尋對話框
- `deactivate`: 清理 Webview Panel

### D7: Repo 路徑處理

- VS Code Extension：自動使用 `vscode.workspace.workspaceFolders[0]`，不需要 SelectRepo 頁面和 filesystem API
- Web 版：維持現有的 SelectRepo 頁面 + filesystem API 行為
- React 端透過 `RepoContext` 初始值區分：Webview 版在 mount 時就注入 workspace path

## Risks / Trade-offs

- **[Webview CSP 限制]** → 使用 nonce-based CSP，Vite build 時避免 inline script/style。Tailwind v4 需確認 build output 不含 inline style。
- **[Monorepo 遷移破壞現有功能]** → 分階段進行：先抽 core，確認 web 版正常後再建 extension。
- **[Webview 冷啟動效能]** → React bundle 需要在 Webview 中載入。可考慮 lazy loading 非首頁 route，但初始版本先不優化。
- **[VS Code API 版本相容性]** → 設定 `engines.vscode` 為 `^1.85.0`（2024 年初版本），Webview API 穩定。
- **[npm workspaces 路徑解析]** → 開發時需確認 TypeScript path resolution 和 Vite alias 正確指向 core package。
