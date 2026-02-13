# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

spek 是一個本地唯讀 Web 應用，用於瀏覽包含 `openspec/` 目錄的 repo 內容。使用者啟動後在 UI 中選擇 repo 路徑即可結構化瀏覽 specs、changes、任務進度等 OpenSpec 內容。

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **Backend**: Express.js (Node.js) — 讀取本地檔案系統提供 REST API
- **Markdown**: react-markdown + remark-gfm（含 BDD 語法高亮）
- **Search**: Server-side 全文搜尋 + Fuse.js client-side 排序
- **Routing**: React Router v7

## Development Commands

```bash
npm install              # 安裝依賴
npm run dev              # 啟動 Vite (5173) + Express (3001)，使用 concurrently
npm run build            # tsc && vite build
npm run type-check       # tsc --noEmit
npm run lint             # eslint src server --ext .ts,.tsx
npm run format           # prettier --write src server
```

開發時只需存取 http://localhost:5173，Vite proxy 會將 `/api/*` 轉發到 Express (3001)。

## Architecture

**Monorepo 單一 package**，前後端共存：

- `server/` — Express API server
  - `server/index.ts` — 入口，啟動 port 3001
  - `server/routes/openspec.ts` — `/api/openspec/*` routes（specs、changes、搜尋）
  - `server/routes/filesystem.ts` — `/api/fs/*` routes（目錄瀏覽、偵測 openspec/）
  - `server/lib/scanner.ts` — OpenSpec 目錄掃描與解析
  - `server/lib/tasks.ts` — tasks.md checkbox 解析與統計
- `src/` — React SPA
  - `src/pages/` — 頁面元件（SelectRepo、Dashboard、SpecList、SpecDetail、ChangeList、ChangeDetail）
  - `src/components/` — 共用元件（Layout、Sidebar、MarkdownRenderer、TaskProgress、SearchDialog、TabView）
  - `src/hooks/useOpenSpec.ts` — API 呼叫 hooks
  - RepoContext 儲存目前選擇的 repo 路徑，各頁面以 `dir` query param 傳給 API

**API endpoints**（所有 openspec routes 接受 `dir` query param 指定 repo 路徑）：
```
GET /api/fs/browse?path=...              # 目錄瀏覽
GET /api/fs/detect?path=...              # 偵測 openspec/ 存在
GET /api/openspec/overview?dir=...       # 總覽統計
GET /api/openspec/specs?dir=...          # Spec 列表
GET /api/openspec/specs/:topic?dir=...   # 單一 spec 內容
GET /api/openspec/changes?dir=...        # Changes 列表
GET /api/openspec/changes/:slug?dir=...  # 單一 change 內容
GET /api/openspec/search?dir=...&q=...   # 全文搜尋
```

**Frontend routes**: `/` (SelectRepo) → `/dashboard` → `/specs` → `/specs/:topic` → `/changes` → `/changes/:slug`

## Key Design Decisions

- **安全**：Express 僅讀取 `openspec/` 子目錄內的 `.md`、`.yaml` 檔案，不暴露任意檔案
- **TypeScript**：前端 ESNext + JSX，後端用獨立 `tsconfig.server.json`
- **BDD 高亮**：WHEN/GIVEN (藍)、THEN (綠)、AND (灰)、MUST/SHALL (紅)、ADDED/MODIFIED (橘/藍 badge)
- **深色主題**：背景 #0a0c0f 系列，accent 琥珀色 #f59e0b，文字 #e2e8f0
- **tasks.md 解析**：`- [x]`/`- [ ]` checkbox + `##` section 分組，回傳 `{ total, completed, sections }`

## Conventions

- 程式碼用英文撰寫
- 註解與文件使用繁體中文（台灣用語）
- OpenSpec 資料結構詳見 `docs/prd.md` 第 3 節

## Workflow

- **所有變更都必須使用 OpenSpec 工作流程**：每個功能、修復或修改都要先建立 OpenSpec change，經過 proposal → design → tasks 流程後再實作
- 使用 `/openspec-new-change` 建立新的 change
- 實作完成後使用 `/openspec-verify-change` 驗證，再用 `/openspec-archive-change` 封存
- **Archive 時必須**：更新相關文件（CLAUDE.md、README 等若有影響），並建立 git commit
