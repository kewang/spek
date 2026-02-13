## Context

Phase 1 完成了 Express API server 和專案骨架。後端提供完整的 OpenSpec 資料讀取 API，前端目前僅有 placeholder。Phase 2 要建立完整的前端頁面系統，使 spek 成為可操作的瀏覽器。

現有基礎設施：
- Vite + React 19 + TypeScript + Tailwind CSS v4 已設定完成
- 深色主題色系已定義（`global.css` @theme）
- react-router-dom v7 已安裝但未使用
- API proxy 已設定（`/api` → localhost:3001）

## Goals / Non-Goals

**Goals:**
- 建立 6 個核心頁面，串接所有後端 API
- 建立可重用的 Layout、Sidebar、TaskProgress、TabView 元件
- 實作 RepoContext 管理全域 repo 路徑狀態
- 提供流暢的導覽體驗（路由、sidebar、breadcrumb）

**Non-Goals:**
- Markdown 渲染與 BDD 語法高亮（Phase 3）
- 全文搜尋 UI / SearchDialog（Phase 3）
- 響應式佈局（Phase 4）
- 深色/淺色主題切換（Phase 4）

## Decisions

### 1. 路由架構：React Router v7 data router

使用 `createBrowserRouter` + `RouterProvider`。路由結構：

```
/                    → SelectRepo（無 Layout）
/dashboard           → Layout > Dashboard
/specs               → Layout > SpecList
/specs/:topic        → Layout > SpecDetail
/changes             → Layout > ChangeList
/changes/:slug       → Layout > ChangeDetail
```

所有 `/dashboard` 以下路由共用 Layout wrapper，SelectRepo 獨立。`dir` query param 在 RepoContext 中管理，各 hook 自動附加。

**替代方案**：用 `<BrowserRouter>` + `<Routes>` 聲明式路由 — 但 data router 支援 loader/action，未來擴充性較好。

### 2. 狀態管理：React Context + URL query param

- `RepoContext` 提供 `repoPath` 和 `setRepoPath`
- `repoPath` 同步到 URL `?dir=` query param（single source of truth）
- localStorage 記憶最近使用的路徑列表（最多 5 個）
- 未選擇 repo 時，自動導向 `/`

**替代方案**：Zustand / Redux — 過度工程，Context 足以應付唯讀場景。

### 3. API hooks：自訂 hooks + fetch

`src/hooks/useOpenSpec.ts` 提供：
- `useOverview()` → overview 統計
- `useSpecs()` → spec 列表
- `useSpec(topic)` → 單一 spec
- `useChanges()` → change 列表
- `useChange(slug)` → 單一 change
- `useBrowse(path)` → 目錄瀏覽
- `useDetect(path)` → openspec 偵測

每個 hook 回傳 `{ data, loading, error }`，內部使用 `fetch` + `useEffect`。`dir` 從 RepoContext 取得。

**替代方案**：TanStack Query — 功能強大但此場景不需要 cache invalidation、mutation 等功能。

### 4. Markdown 內容顯示：Phase 2 用純文字預覽

Phase 2 先用 `<pre>` 顯示 raw markdown 內容，Phase 3 再替換為 react-markdown + BDD 高亮。這樣可以先驗證資料流是否正確。

### 5. Layout 結構

```
┌─ Header ──────────────────────────────────┐
│  spek logo     [搜尋預留]    repo path     │
├─ Sidebar ─┬─ Main ────────────────────────┤
│ 240px     │  padding 24px                 │
│ fixed     │  max-width 容器               │
│           │                               │
└───────────┴───────────────────────────────┘
```

- Header 高度 56px，bg-secondary，border-bottom
- Sidebar 寬度 240px，bg-secondary，fixed left
- Main 區域 `ml-60` offset

### 6. 頁面資料流

每個頁面在 mount 時透過 hook 取得資料。Loading 狀態顯示 skeleton/spinner，error 狀態顯示錯誤訊息。不做 prefetch。

## Risks / Trade-offs

- **無 Markdown 渲染**：Phase 2 顯示原始文字，使用者體驗有限。→ Phase 3 會補上，Phase 2 先確保資料流正確。
- **無搜尋功能**：Header 搜尋按鈕為 placeholder。→ Phase 3 實作 SearchDialog。
- **單一 Context**：如果 repo 路徑頻繁變更可能造成全部重新渲染。→ 實際使用場景中 repo 路徑很少變更，不是問題。
- **無 loading skeleton**：先用簡單 spinner，不做精緻的 skeleton screen。→ 未來可改善但非 Phase 2 優先。
