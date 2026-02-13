## 1. 專案初始化

- [x] 1.1 建立 package.json（name、scripts、dependencies、devDependencies）
- [x] 1.2 建立 tsconfig.json（前端）與 tsconfig.server.json（後端）
- [x] 1.3 建立 vite.config.ts（含 proxy 設定將 /api 轉發到 port 3001）
- [x] 1.4 設定 Tailwind CSS v4（global.css）
- [x] 1.5 建立 React 入口（src/main.tsx、src/App.tsx）— 最小化版本確認前端可運行
- [x] 1.6 npm install 驗證所有依賴安裝成功

## 2. Express API Server 骨架

- [x] 2.1 建立 server/index.ts — Express 入口，啟動 port 3001，掛載 routes
- [x] 2.2 建立 server/routes/filesystem.ts — `/api/fs/browse` 與 `/api/fs/detect` endpoints
- [x] 2.3 建立 server/routes/openspec.ts — 掛載所有 `/api/openspec/*` routes（先回傳空殼）

## 3. OpenSpec Scanner

- [x] 3.1 建立 server/lib/scanner.ts — 掃描 openspec/ 目錄結構（specs、active changes、archived changes）
- [x] 3.2 實作 readSpec() — 讀取單一 spec 的 Markdown 內容
- [x] 3.3 實作 readChange() — 讀取 change 的所有 artifacts（proposal、design、tasks、delta specs）
- [x] 3.4 實作 findRelatedChanges() — 找出與某 spec topic 相關的 changes

## 4. Task Parser

- [x] 4.1 建立 server/lib/tasks.ts — 解析 tasks.md checkbox 語法
- [x] 4.2 實作 section 分組邏輯（## heading 分組）
- [x] 4.3 實作統計計算（total、completed）

## 5. OpenSpec API Endpoints

- [x] 5.1 實作 GET /api/openspec/overview — 回傳 specsCount、changesCount、taskStats
- [x] 5.2 實作 GET /api/openspec/specs — 回傳 spec topics 列表
- [x] 5.3 實作 GET /api/openspec/specs/:topic — 回傳單一 spec 內容 + relatedChanges
- [x] 5.4 實作 GET /api/openspec/changes — 回傳 active/archived changes 列表
- [x] 5.5 實作 GET /api/openspec/changes/:slug — 回傳單一 change 完整內容
- [x] 5.6 實作 GET /api/openspec/search — 全文搜尋（Fuse.js）

## 6. 驗證

- [x] 6.1 npm run dev 啟動成功（Vite + Express 同時運行）
- [x] 6.2 前端頁面可開啟 http://localhost:5173
- [x] 6.3 API endpoints 可透過 curl 或瀏覽器測試回傳正確資料
