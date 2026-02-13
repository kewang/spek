# spek — OpenSpec Viewer PRD

## Context

OpenSpec 是一個 spec-driven 的工作流程管理結構，在實際專案中會累積大量的 specs、changes（含 proposal/design/tasks）。目前這些內容只能透過檔案系統或文字編輯器閱讀，缺乏結構化瀏覽、搜尋、狀態總覽能力。

**目標**：建立一個輕量級的本地 Web 應用程式 `spek`，使用者 clone 後啟動，選擇包含 `openspec/` 的 repo 路徑即可瀏覽內容。

---

## 1. 產品定位

- **專案名稱**：`spek`
- **定位**：OpenSpec 內容的本地唯讀檢視器
- **使用流程**：`git clone` → `npm install` → `npm run dev` → 瀏覽器開啟 → 選擇 repo 路徑 → 瀏覽內容

## 2. 非目標

- 不做內容編輯功能（唯讀）
- 不做使用者認證或權限管理
- 不做 OpenSpec 工作流程管理（建立/封存 change 等操作）
- 不做雲端部署版本（純本地工具）

---

## 3. OpenSpec 資料結構

```
{repo}/openspec/
├── config.yaml                    # schema: spec-driven
├── specs/                         # Spec 主題目錄
│   └── {topic}/spec.md           # BDD 格式規格 (WHEN/THEN/AND)
└── changes/
    ├── archive/                   # 已封存變更
    │   └── {YYYY-MM-DD-desc}/
    │       ├── .openspec.yaml    # schema + created date
    │       ├── proposal.md       # Why / What Changes / Capabilities / Impact
    │       ├── design.md         # Context / Goals / Decisions / Risks
    │       ├── tasks.md          # Checkbox 任務清單
    │       └── specs/            # 該 change 的 delta specs
    └── {active-change}/          # 進行中變更（同結構）
```

**內容特徵**：
- 繁中+英文混排
- BDD 語法：WHEN/THEN/AND/MUST
- 任務用 `- [x]` / `- [ ]` checkbox
- Change 命名：`YYYY-MM-DD-description`

---

## 4. 技術架構

### 4.1 技術選型

| 層面 | 選擇 | 理由 |
|------|------|------|
| **Backend** | Node.js + Express | 讀取本地檔案系統，提供 REST API |
| **Frontend** | React + Vite | 使用者的 Rewire 專案同技術棧，熟悉且輕量 |
| **Markdown 渲染** | react-markdown + remark-gfm | 支援 GFM checkbox、表格等 |
| **搜尋** | Fuse.js (client-side) | 輕量模糊搜尋，無需額外服務 |
| **樣式** | Tailwind CSS v4 | 快速開發，深色主題支援 |
| **語言** | TypeScript | 前後端一致的型別安全 |

### 4.2 專案結構

```
spek/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── server/
│   ├── index.ts               # Express 入口，啟動 API server
│   ├── routes/
│   │   ├── openspec.ts        # /api/openspec/* — 讀取 OpenSpec 資料
│   │   └── filesystem.ts      # /api/fs/* — 目錄瀏覽（選擇 repo 用）
│   └── lib/
│       ├── scanner.ts         # OpenSpec 目錄掃描 + 解析
│       └── tasks.ts           # tasks.md checkbox 解析 + 統計
├── src/
│   ├── main.tsx               # React 入口
│   ├── App.tsx                # 路由設定
│   ├── pages/
│   │   ├── SelectRepo.tsx     # 首頁：選擇/輸入 repo 路徑
│   │   ├── Dashboard.tsx      # 專案總覽 dashboard
│   │   ├── SpecList.tsx       # Specs 列表
│   │   ├── SpecDetail.tsx     # Spec 詳細頁面
│   │   ├── ChangeList.tsx     # Changes 時間線
│   │   └── ChangeDetail.tsx   # Change 詳細（tab: proposal/design/tasks/specs）
│   ├── components/
│   │   ├── Layout.tsx         # 共用佈局（sidebar + header）
│   │   ├── Sidebar.tsx        # 側邊導覽
│   │   ├── MarkdownRenderer.tsx  # Markdown 渲染 + BDD 高亮
│   │   ├── TaskProgress.tsx   # 任務進度條
│   │   ├── SearchDialog.tsx   # 搜尋對話框 (Cmd+K)
│   │   └── TabView.tsx        # Tab 切換元件
│   ├── hooks/
│   │   └── useOpenSpec.ts     # API 呼叫 hooks
│   └── styles/
│       └── global.css         # Tailwind + 自訂樣式
└── public/
    └── favicon.svg
```

### 4.3 API 設計

```
GET  /api/fs/browse?path=...        # 瀏覽目錄（選擇 repo 用）
GET  /api/fs/detect?path=...        # 偵測指定路徑是否有 openspec/

GET  /api/openspec/overview?dir=... # 總覽（specs數量、changes數量、任務統計）
GET  /api/openspec/specs?dir=...    # Spec 主題列表
GET  /api/openspec/specs/:topic?dir=...  # 單一 spec 內容 + 關聯 changes
GET  /api/openspec/changes?dir=...  # Changes 列表（含任務統計）
GET  /api/openspec/changes/:slug?dir=... # 單一 change 完整內容
GET  /api/openspec/search?dir=...&q=...  # 全文搜尋
```

### 4.4 啟動方式

```bash
# Clone 後啟動
git clone <spek-repo>
cd spek
npm install
npm run dev        # 啟動 Vite dev server + Express API server (concurrently)

# 瀏覽器開啟 http://localhost:5173
# 在 UI 中輸入或瀏覽選擇 repo 路徑
```

---

## 5. 功能需求

### FR-1：選擇 Repo

- 首頁顯示路徑輸入框
- 輸入路徑後自動偵測是否有 `openspec/` 目錄
- 記住最近使用的路徑（localStorage）
- 偵測成功後自動跳轉到 Dashboard

### FR-2：Dashboard 總覽

- Specs 數量、Changes 數量（active/archived）、任務完成率
- Active changes 列表（含進度條）
- 最近封存的 changes（最近 10 個）

### FR-3：Specs 瀏覽

- Spec 主題列表（字母排序 + 即時過濾）
- Spec 詳細頁：Markdown 渲染 + BDD 關鍵字高亮
- 關聯 changes 列表（哪些 changes 影響了此 spec）

### FR-4：Changes 瀏覽

- 按日期分組的時間線列表
- 區分 active / archived
- Change 詳細頁：Tab 切換（Proposal / Design / Tasks / Specs）
- Tasks tab 顯示 checkbox 狀態 + 進度統計

### FR-5：全文搜尋

- `Cmd+K` 快捷鍵開啟搜尋對話框
- 跨 specs + changes 搜尋
- 結果分類顯示，附上下文預覽
- 點擊跳轉到對應頁面

### FR-6：BDD 語法高亮

- `WHEN`/`GIVEN`：藍色標籤
- `THEN`：綠色標籤
- `AND`：灰色標籤
- `MUST`/`SHALL`：紅色粗體
- `ADDED`/`MODIFIED`：橘/藍 badge

---

## 6. UI 設計

### 佈局

```
┌──────────────────────────────────────────────┐
│  spek        [搜尋 ⌘K]        [/path/to/repo]│
├─────────┬────────────────────────────────────┤
│ Sidebar │  主要內容區                         │
│         │                                    │
│ Overview│  [根據路由渲染對應頁面]              │
│ Specs   │                                    │
│  ├ ...  │                                    │
│ Changes │                                    │
│  ├ Act  │                                    │
│  └ Arc  │                                    │
└─────────┴────────────────────────────────────┘
```

### 視覺風格

- 深色主題為主（背景 #0a0c0f 系列）
- Accent：琥珀色 #f59e0b
- 中文行高 1.75、段落間距 1.5rem
- 程式碼區塊 JetBrains Mono

---

## 7. 實作計畫

### Phase 1：專案骨架 + API Server
- 初始化 Vite + React + TypeScript 專案
- Express API server 設定（concurrently 同時啟動）
- OpenSpec 目錄掃描器（scanner.ts）
- Tasks 解析器（tasks.ts）
- 基礎 API endpoints（overview、specs、changes）

### Phase 2：核心 UI 頁面
- 選擇 Repo 頁面（路徑輸入 + 偵測）
- 共用 Layout（sidebar + header）
- Dashboard 總覽頁
- Specs 列表 + 詳細頁
- Changes 列表 + 詳細頁（含 Tab 切換）

### Phase 3：Markdown 渲染 + 搜尋
- MarkdownRenderer 元件 + BDD 語法高亮
- 全文搜尋 API + SearchDialog UI
- Cmd+K 快捷鍵

### Phase 4：完善
- 響應式佈局
- 深色/淺色主題切換
- 最近使用路徑記憶
- Spec 演進歷史追蹤

---

## 8. 驗證方式

1. `npm run dev` 啟動後，瀏覽器開啟 localhost
2. 輸入 `/home/kewang/git/rewire` 路徑
3. 確認 Dashboard 顯示正確的 specs/changes 數量
4. 瀏覽幾個 spec（如 simulation-engine）確認 Markdown 渲染正確
5. 瀏覽幾個 change（如 2026-02-10-main-breaker-simulation）確認四個 tab 都正常
6. 搜尋「effectiveCurrent」確認跨文件搜尋正常
7. 確認 BDD 關鍵字（WHEN/THEN/MUST）有視覺高亮
