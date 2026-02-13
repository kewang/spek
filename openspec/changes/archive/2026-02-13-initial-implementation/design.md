## Context

spek 是一個本地唯讀 Web 應用，讓使用者瀏覽任何包含 `openspec/` 目錄的 repo。目前 OpenSpec 內容只能透過檔案系統或文字編輯器閱讀，缺乏結構化瀏覽、搜尋與狀態總覽能力。

本設計涵蓋 spek 從零開始的完整技術架構，包含 Express API server（讀取本地檔案系統）與 React SPA（渲染 UI）。

## Goals / Non-Goals

**Goals:**
- 建立可獨立運行的本地 Web 應用，`npm run dev` 即可啟動
- Express backend 提供 REST API 讀取任意路徑下的 OpenSpec 結構
- React frontend 提供 Dashboard、Specs 瀏覽、Changes 瀏覽、全文搜尋
- 支援 BDD 語法高亮（WHEN/THEN/AND/MUST 等關鍵字）
- 支援 tasks.md checkbox 解析與進度統計
- 深色主題 UI，琥珀色 accent

**Non-Goals:**
- 不做內容編輯（純唯讀）
- 不做使用者認證或權限管理
- 不做 OpenSpec 工作流程管理（建立/封存 change）
- 不做雲端部署版本
- 不做 SSR（純 CSR SPA 即可）

## Decisions

### D1: Monorepo 單一 package，前後端共存

前端（Vite + React）與後端（Express）放在同一個 package 中。開發時用 `concurrently` 同時啟動 Vite dev server（port 5173）與 Express API server（port 3001）。Vite 設定 proxy 將 `/api/*` 轉發到 Express。

**理由**：專案規模小，分成兩個 package 增加複雜度但沒有實質好處。單一 package 簡化安裝與啟動流程。

**替代方案**：monorepo workspace — 對此規模過度工程化。

### D2: Express 讀取檔案系統，前端透過 `dir` query param 指定 repo 路徑

所有 `/api/openspec/*` endpoints 接受 `dir` query parameter，指定要讀取的 repo 根目錄。Express 在該路徑下尋找 `openspec/` 目錄並讀取內容。

**理由**：讓使用者可以在不重啟 server 的情況下切換不同 repo。路徑驗證在 server 端進行（檢查 `openspec/` 目錄存在）。

**安全考量**：僅允許讀取操作，不暴露任意檔案內容（僅讀取 `openspec/` 子目錄內的 `.md`、`.yaml` 檔案）。

### D3: 前端路由結構

使用 React Router v7，路由設計：

- `/` — SelectRepo 頁面（輸入/選擇 repo 路徑）
- `/dashboard` — Dashboard 總覽
- `/specs` — Specs 列表
- `/specs/:topic` — Spec 詳細頁
- `/changes` — Changes 列表
- `/changes/:slug` — Change 詳細頁（含 tab 切換）

repo 路徑存在 React context 中（`RepoContext`），各頁面從 context 讀取後作為 `dir` 參數傳給 API。

### D4: Markdown 渲染 + BDD 語法高亮

使用 `react-markdown` + `remark-gfm` 渲染 Markdown。BDD 語法高亮透過自訂 remark plugin 或 post-processing：

- 在渲染後的文字節點中偵測 BDD 關鍵字（WHEN、GIVEN、THEN、AND、MUST、SHALL、ADDED、MODIFIED）
- 將關鍵字包裝成帶有對應 CSS class 的 `<span>` 標籤
- 各關鍵字顏色依 PRD 定義（藍/綠/灰/紅/橘）

### D5: 搜尋架構 — Server-side 全文搜尋 + Client-side Fuse.js

搜尋 API（`/api/openspec/search`）在 server 端遍歷所有 `.md` 檔案進行全文比對，回傳匹配結果（含檔案路徑、匹配行、上下文）。

前端 SearchDialog 使用 Fuse.js 對搜尋結果做進一步的模糊排序與過濾。`Cmd+K` 快捷鍵開啟對話框。

**理由**：Server 端讀取檔案內容進行搜尋最直接。Fuse.js 在前端做結果排序提供更好的 UX。

### D6: Tailwind CSS v4 + 深色主題

使用 Tailwind CSS v4（`@tailwindcss/vite` plugin）。以深色主題為預設：

- 背景色系：`#0a0c0f` / `#0f1318` / `#1a1f2e`
- Accent：琥珀色 `#f59e0b`
- 文字：`#e2e8f0`（主文字）、`#94a3b8`（次要文字）
- 透過 CSS custom properties 定義色彩變數，為未來淺色主題切換預留

### D7: tasks.md 解析策略

Server 端解析 `tasks.md` 的 checkbox 格式：
- `- [x]` 計為已完成
- `- [ ]` 計為未完成
- 支援巢狀結構（section headers `##` 分組）
- 回傳統計：`{ total, completed, sections: [{ title, total, completed }] }`

## Risks / Trade-offs

**[大型 repo 效能]** → OpenSpec 目錄通常不會太大（數十到數百個檔案），全文搜尋遍歷所有 .md 檔案在本地應可接受。若未來需要優化，可加入 file content cache。

**[路徑安全]** → `dir` 參數允許讀取任意本地路徑。Mitigation：僅讀取 `openspec/` 子目錄內容，不暴露其他檔案。Express 路由中驗證路徑合法性。

**[前後端 port 衝突]** → 開發時使用 5173（Vite）+ 3001（Express）兩個 port。Mitigation：Vite proxy 設定統一入口，使用者只需存取 5173。

**[TypeScript 設定複雜度]** → 前端（ESNext + JSX）與後端（Node.js）需要不同 tsconfig。Mitigation：使用 tsconfig references，server/ 有獨立的 tsconfig.server.json。
