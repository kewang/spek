## 1. Monorepo 結構建立

- [x] 1.1 初始化 npm workspaces：在根目錄 package.json 加入 `workspaces` 設定，建立 `packages/core`、`packages/web`、`packages/vscode` 目錄
- [x] 1.2 建立 `packages/core/package.json`（名稱 `@spek/core`），設定 TypeScript 編譯配置
- [x] 1.3 搬移現有 `server/` 和 `src/` 到 `packages/web/`，更新 import 路徑和 build 設定
- [x] 1.4 驗證 `packages/web` 的 `npm run dev` 仍可正常啟動

## 2. Core Module 抽取

- [x] 2.1 將 `server/lib/scanner.ts` 的核心邏輯搬到 `packages/core/src/scanner.ts`，移除 Express 依賴，改為接受 `basePath` 參數的純函式
- [x] 2.2 將 `server/lib/tasks.ts` 搬到 `packages/core/src/tasks.ts`，確保只接受 content string 參數
- [x] 2.3 在 `packages/core/src/types.ts` 集中定義所有共用型別（OverviewData、SpecInfo、ChangeInfo 等）
- [x] 2.4 建立 `packages/core/src/index.ts` 匯出所有公開 API
- [x] 2.5 更新 `packages/web/server/routes/` 改為 import `@spek/core` 的函式

## 3. API Adapter 抽象層

- [x] 3.1 在 `packages/web/src/` 建立 `ApiAdapter` 介面定義（getOverview、getSpecs、getSpec、getChanges、getChange、search、browse、detect）
- [x] 3.2 實作 `FetchAdapter`：將現有 `useOpenSpec.ts` 的 fetch 邏輯抽為 adapter 方法
- [x] 3.3 實作 `MessageAdapter`：透過 `postMessage` 發送請求，用 Promise + unique id 等待回應
- [x] 3.4 建立 `ApiAdapterContext` 和 `ApiAdapterProvider`，透過 React Context 注入 adapter
- [x] 3.5 重構 `useOpenSpec.ts` 的 hooks 改為從 context 取得 adapter 呼叫 API
- [x] 3.6 在 web 版的 `main.tsx` 用 `FetchAdapter` 包裝 app

## 4. VS Code Extension 骨架

- [x] 4.1 建立 `packages/vscode/package.json`，設定 `engines.vscode`、`activationEvents`、`contributes.commands`
- [x] 4.2 設定 extension bundling（esbuild config），產出單一 extension.js
- [x] 4.3 實作 `extension.ts`：activate 函式註冊 commands、掃描 workspace 偵測 openspec/、建立 status bar item
- [x] 4.4 實作 `deactivate` 函式清理 Webview Panel 和 listeners

## 5. Webview Panel 整合

- [x] 5.1 實作 Webview HTML 產生器：讀取 web build output，替換 asset 路徑為 `webview.asWebviewUri()`，注入 CSP meta tag with nonce
- [x] 5.2 設定 Vite build 配置產出適合 Webview 載入的 bundle（固定檔名、相對路徑）
- [x] 5.3 實作 message handler：接收 Webview 的 API requests，呼叫 `@spek/core` 函式，回傳 response
- [x] 5.4 實作 ready handshake：收到 Webview 的 `ready` 訊息後發送 `init` 訊息含 workspace path
- [x] 5.5 實作 theme 同步：監聯 VS Code theme 變更事件，發送 theme 訊息到 Webview

## 6. Webview 前端適配

- [x] 6.1 建立 Webview 專用 entry point，使用 `MessageAdapter` 初始化 app
- [x] 6.2 處理 `init` 訊息：收到 workspace path 後自動設定 RepoContext 並跳轉到 Dashboard
- [x] 6.3 處理 theme 訊息：根據 VS Code theme 切換 spek 的深色/淺色主題
- [x] 6.4 隱藏 web 版專有的 UI 元素（SelectRepo 頁面、repo 路徑輸入框）

## 7. Build 與打包

- [x] 7.1 在根目錄 package.json 新增 scripts：`build:core`、`build:web`、`build:vscode`、`build:all`
- [x] 7.2 設定 `packages/vscode` 的 build pipeline：先 build core → build web (webview assets) → bundle extension
- [x] 7.3 驗證 `vsce package` 可成功產出 `.vsix` 檔案
- [x] 7.4 驗證 `.vsix` 安裝到 VS Code 後可正常使用（開啟 panel、瀏覽 specs/changes、搜尋）
