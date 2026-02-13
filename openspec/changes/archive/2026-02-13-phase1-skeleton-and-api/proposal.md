## Why

spek 目前只有 PRD 和設計文件，尚無任何可執行的程式碼。需要建立專案骨架（Vite + React + Express）與後端 API server，作為所有後續功能的基礎設施。這是第一個實作階段，沒有骨架就無法進行任何 UI 或功能開發。

## What Changes

- 初始化 Node.js 專案（package.json、TypeScript 設定、Vite 設定）
- 建立 Express API server，提供本地檔案系統讀取能力
- 實作 OpenSpec 目錄掃描器（scanner），解析 specs、changes 結構
- 實作 tasks.md checkbox 解析器，計算任務完成統計
- 建立所有 REST API endpoints（filesystem 瀏覽、openspec 資料讀取、全文搜尋）
- 設定 Vite dev server proxy，將 `/api/*` 轉發到 Express
- 建立最小化的 React 前端入口，確認前後端串接正常

## Capabilities

### New Capabilities

- `filesystem-api`: 目錄瀏覽與 openspec 目錄偵測 API（`/api/fs/*`）
- `openspec-api`: OpenSpec 資料讀取 API — overview、specs 列表與詳情、changes 列表與詳情（`/api/openspec/*`）
- `search-api`: 跨 specs 與 changes 的全文搜尋 API（`/api/openspec/search`）
- `openspec-scanner`: 目錄掃描與 Markdown/YAML 解析邏輯
- `task-parser`: tasks.md checkbox 解析與統計（section 分組、完成率計算）

### Modified Capabilities

（無既有 capabilities）

## Impact

- **新增依賴**：express、cors、glob、gray-matter、fuse.js、concurrently、tsx、typescript、@types/*
- **新增目錄**：`server/`（API server）、`src/`（React 前端入口）
- **設定檔**：package.json、tsconfig.json、tsconfig.server.json、vite.config.ts、tailwind 相關設定
- **開發流程**：`npm run dev` 同時啟動 Vite (5173) + Express (3001)
