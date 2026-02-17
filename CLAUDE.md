# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

spek 是一個 OpenSpec 內容檢視器，提供三種使用方式：
1. **Web 版**：本地唯讀 Web 應用（Express + React SPA），使用者啟動後在 UI 中選擇 repo 路徑瀏覽
2. **VS Code Extension**：直接在 VS Code 中開啟 Webview Panel 瀏覽當前 workspace 的 OpenSpec 內容
3. **Demo**：獨立靜態 HTML（`docs/demo.html`），內嵌 spek 自身的 openspec 資料，可部署至 GitHub Pages

## Tech Stack

- **Core**: `@spek/core` — 共用邏輯（scanner、tasks parser、型別定義），純 Node.js
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **Backend**: Express.js (Node.js) — 讀取本地檔案系統提供 REST API
- **VS Code Extension**: Webview Panel + esbuild bundling
- **Markdown**: react-markdown + remark-gfm（含 BDD 語法高亮）
- **Search**: Server-side 全文搜尋 + Fuse.js
- **Routing**: React Router v7（Web: BrowserRouter, Webview: MemoryRouter）

## Project Structure (Monorepo)

```
packages/
├── core/       # @spek/core — 純邏輯，無框架依賴
│   └── src/    # scanner.ts, tasks.ts, git-cache.ts, types.ts
├── web/        # @spek/web — Express + React 應用
│   ├── server/ # Express API server
│   └── src/    # React SPA + API adapters
└── vscode/     # spek-vscode — VS Code Extension
    ├── src/    # extension.ts, panel.ts, handler.ts
    └── webview/ # Vite build output（由 web build:webview 產出）
scripts/        # Build 工具（build-demo.ts）
docs/           # 靜態產出（demo.html，GitHub Pages 部署）
.agents/
└── skills/     # Claude Code skills（原始檔）
    └── frontend-design/  # 前端設計指引 skill
.claude/
└── skills/     # Symlinks → .agents/skills/（Claude Code 自動偵測）
```

## Development Commands

```bash
npm install              # 安裝所有 workspace 依賴
npm run dev              # 啟動 Web 版：Vite (5173) + Express (3001)
npm run build            # Build core + web
npm run build:core       # Build @spek/core
npm run build:web        # Build @spek/web（web 版 production build）
npm run build:webview    # Build webview assets（給 VS Code extension 用）
npm run build:vscode     # Build VS Code extension
npm run build:demo       # Build 獨立 demo HTML（docs/demo.html）
npm run type-check       # TypeScript type check
```

**Web 開發**：`npm run dev` 後存取 http://localhost:5173

**Extension 打包**：
```bash
npm run build -w @spek/core && npm run build:webview -w @spek/web && npm run build -w spek-vscode
cd packages/vscode && npx vsce package --no-dependencies
```

## Architecture

### Core Module (`@spek/core`)
純函式 + 型別定義，可被 web server 和 extension host 共用：
- `scanOpenSpec(basePath)` — 掃描 OpenSpec 目錄結構
- `readSpec(basePath, topic)` — 讀取單一 spec（含歷史）
- `readChange(basePath, slug)` — 讀取單一 change
- `readSpecAtChange(basePath, topic, slug)` — 讀取特定 change 中的 spec 歷史版本
- `parseTasks(content)` — 解析 tasks.md checkbox
- 共用型別：`OverviewData`, `SpecInfo`, `ChangeInfo`, `ChangeDetail` 等

### API Adapter Pattern
前端透過 `ApiAdapter` 介面抽象通訊層：
- `FetchAdapter` — Web 版，呼叫 Express REST API
- `MessageAdapter` — VS Code Webview 版，透過 `postMessage` 與 extension host 通訊
- `StaticAdapter` — Demo 版，從 build time 內嵌的 `window.__DEMO_DATA__` 讀取靜態資料
- 透過 `ApiAdapterContext` (React Context) 注入

### API endpoints（Web 版，所有 openspec routes 接受 `dir` query param）
```
GET /api/fs/browse?path=...              # 目錄瀏覽
GET /api/fs/detect?path=...              # 偵測 openspec/ 存在
GET /api/openspec/overview?dir=...       # 總覽統計
GET /api/openspec/specs?dir=...          # Spec 列表
GET /api/openspec/specs/:topic?dir=...   # 單一 spec 內容
GET /api/openspec/specs/:topic/at/:slug?dir=...  # Spec 歷史版本內容（diff 用）
GET /api/openspec/changes?dir=...        # Changes 列表
GET /api/openspec/changes/:slug?dir=...  # 單一 change 內容
GET /api/openspec/search?dir=...&q=...   # 全文搜尋
```

### VS Code Extension
- `spek.open` / `spek.search` commands
- `workspaceContains:openspec/config.yaml` activation
- Webview Panel 載入 IIFE-bundled React app
- extension host 直接呼叫 `@spek/core` 處理 API requests

**Frontend routes**: `/` (SelectRepo, web only) → `/dashboard` → `/specs` → `/specs/:topic` → `/changes` → `/changes/:slug`

## Key Design Decisions

- **安全**：Express 僅讀取 `openspec/` 子目錄內的 `.md`、`.yaml` 檔案，不暴露任意檔案
- **TypeScript**：前端 ESNext + JSX，後端 + core 用獨立 tsconfig
- **BDD 高亮**：WHEN/GIVEN (藍)、THEN (綠)、AND (灰)、MUST/SHALL (紅)、ADDED/MODIFIED (橘/藍 badge)
- **深色主題**：背景 #0a0c0f 系列，accent 琥珀色 #f59e0b，文字 #e2e8f0
- **tasks.md 解析**：`- [x]`/`- [ ]` checkbox + `##` section 分組，回傳 `{ total, completed, sections }`
- **Webview CSP**：IIFE 格式 + nonce script + unsafe-inline styles（Tailwind 需要）
- **acquireVsCodeApi**：只呼叫一次存到 `window.__vscodeApi`，MessageAdapter 從全域取得

## Conventions

- 程式碼用英文撰寫
- 註解與文件使用繁體中文（台灣用語）
- OpenSpec 資料結構詳見 `docs/prd.md` 第 3 節
- **CHANGELOG 同步**：root `CHANGELOG.md` 與 `packages/vscode/CHANGELOG.md` 內容必須保持一致，更新時兩邊同步修改

## Workflow

- **所有變更都必須使用 OpenSpec 工作流程**：每個功能、修復或修改都要先建立 OpenSpec change，經過 proposal → design → tasks 流程後再實作
- 使用 `/openspec-new-change` 建立新的 change
- 實作完成後使用 `/openspec-verify-change` 驗證，再用 `/openspec-archive-change` 封存
- **Archive 時必須**：更新相關文件（CLAUDE.md、README 等若有影響），並建立 git commit
