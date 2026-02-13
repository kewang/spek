## Why

spek 目前是獨立的 Web 應用，使用者需要在終端執行 `npm run dev` 再開啟瀏覽器。對於日常在 VS Code 中工作的開發者而言，切換到瀏覽器查看 OpenSpec 內容會中斷工作流。將 spek 包裝為 VS Code Extension，讓使用者在編輯器內直接瀏覽 specs 和 changes，是最自然的整合方式。

## What Changes

- 新增 VS Code Extension，使用 Webview Panel 嵌入現有 React UI
- 將 `server/lib/` 的核心邏輯（scanner、tasks parser）抽成獨立的 `packages/core/` 共用模組
- 重構為 monorepo 結構（`packages/core`、`packages/web`、`packages/vscode`）
- React 前端新增 API adapter 抽象層，支援 fetch（web）與 postMessage（vscode）兩種通訊模式
- Extension 自動偵測 workspace 中的 `openspec/` 目錄，不需手動選路徑
- 新增 VS Code commands（開啟 spek 面板、搜尋 OpenSpec 內容）
- 現有 Web 版本維持不變，仍可獨立使用

## Capabilities

### New Capabilities

- `vscode-extension-host`: Extension 生命週期管理（activate/deactivate）、Webview Panel 建立與通訊、VS Code commands 註冊
- `webview-integration`: React SPA 在 VS Code Webview 中的載入、CSP 設定、資源路徑轉換、message-based API 通訊
- `core-module`: 從 server/lib/ 抽出的共用核心邏輯模組（scanner、tasks parser、型別定義），可被 web server 和 extension host 共用
- `api-adapter`: 前端 API 通訊抽象層，統一 fetch 與 postMessage 兩種模式的介面

### Modified Capabilities

- `openspec-scanner`: 核心掃描邏輯需從 Express route 解耦，移至 core module 成為純函式
- `task-parser`: 核心解析邏輯需從 Express route 解耦，移至 core module 成為純函式

## Impact

- **專案結構**：從單一 package 重構為 monorepo（packages/core、packages/web、packages/vscode）
- **依賴**：新增 `@types/vscode`、`@vscode/vsce`（打包工具）
- **Build pipeline**：需要新增 extension bundling（esbuild/webpack）、Webview asset build
- **現有 Web 版**：搬到 `packages/web/`，import 路徑從 `server/lib/` 改為 `@spek/core`，功能不變
- **發布**：Web 版照舊 `npm run dev`；Extension 可透過 `vsce package` 打包為 `.vsix`
