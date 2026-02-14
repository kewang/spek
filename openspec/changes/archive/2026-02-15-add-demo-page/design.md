## Context

spek 已有 ApiAdapter 抽象層（`FetchAdapter` 給 Web 版、`MessageAdapter` 給 VS Code Webview），以及 IIFE 單檔打包的 Webview 先例。要做 demo 頁面，只需新增第三個 adapter 實作 + 對應的 entry point 和 Vite config，完全複用現有 React 元件。

## Goals / Non-Goals

**Goals:**
- 產出單一 `docs/demo.html`，可在 GitHub Pages 直接瀏覽
- UI / 功能與現有 Web 版完全一致（Dashboard、Specs、Changes、Search）
- 複用所有現有 React 元件，不重寫

**Non-Goals:**
- 不需要 Repo 選擇頁（資料已內嵌，固定為 spek 自己的 openspec）
- 不需要 resync / browse / detect 功能（靜態資料）

## Decisions

### 1. 新增 `StaticAdapter` 實作 `ApiAdapter`

複用現有 adapter pattern，新增 `StaticAdapter`，從 build time 注入的全域 `window.__DEMO_DATA__` 讀取預先收集的 JSON 資料。所有方法直接 return Promise.resolve，不發 HTTP 也不 postMessage。search 用簡易字串比對實作。

### 2. 新增 `DemoApp.tsx` + `main.demo.tsx` entry point

仿照 `WebviewApp.tsx` 的結構，使用 `HashRouter`（`file://` 相容）+ `StaticAdapter`。路由與 Webview 版相同（跳過 SelectRepo）。

### 3. 新增 `vite.demo.config.ts` — IIFE 打包

仿照 `vite.webview.config.ts`，打包成 IIFE 格式，產出到暫存目錄。

### 4. Build script 組裝最終 HTML

`scripts/build-demo.ts`：
1. 呼叫 `@spek/core` API 收集所有 openspec 資料
2. 執行 `vite build --config vite.demo.config.ts`
3. 讀取產出的 JS/CSS 檔案，inline 進單一 `docs/demo.html`

### 5. 搜尋用簡易字串比對

不引入 Fuse.js。`StaticAdapter.search()` 對所有 spec/change 的 markdown 內容做 case-insensitive includes 比對，回傳匹配段落作為 context。

## Risks / Trade-offs

- **檔案大小**：React + 所有元件 + 嵌入資料，IIFE 單檔可能 ~300-500KB → 可接受，gzip 後會小很多
- **資料即時性**：build time 快照 → 每次 release 前重新 `npm run build:demo`
