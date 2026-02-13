## Why

Phase 1 完成了後端 API 和專案骨架，但前端目前只有一個 placeholder 頁面。使用者無法實際瀏覽任何 OpenSpec 內容。Phase 2 需要建立所有核心 UI 頁面，讓 spek 成為一個可操作的唯讀瀏覽器。

## What Changes

- 新增 React Router 路由設定，串接所有頁面
- 新增 RepoContext 管理目前選擇的 repo 路徑
- 新增 `useOpenSpec` hooks 封裝所有 API 呼叫
- 新增 SelectRepo 頁面（路徑輸入 + 目錄瀏覽 + 自動偵測 + localStorage 記憶）
- 新增 Layout 共用佈局（Header + Sidebar + 主內容區）
- 新增 Dashboard 總覽頁（統計數據 + active changes + 最近封存）
- 新增 SpecList + SpecDetail 頁面（列表過濾 + 內容顯示 + 關聯 changes）
- 新增 ChangeList + ChangeDetail 頁面（時間線 + Tab 切換 proposal/design/tasks/specs）
- 新增 TaskProgress 進度條元件
- 新增 TabView 頁籤切換元件

## Capabilities

### New Capabilities
- `repo-selection`: 選擇 repo 路徑的 UI 流程，包含目錄瀏覽、openspec 偵測、localStorage 持久化
- `spa-routing`: React Router 路由架構與 RepoContext 狀態管理
- `dashboard-view`: 專案總覽 dashboard，顯示統計與 change 進度
- `spec-browsing`: Spec 列表與詳細頁面，含即時過濾與關聯 changes
- `change-browsing`: Change 列表與詳細頁面，含 Tab 切換與任務進度顯示
- `shared-layout`: 共用佈局元件（Header、Sidebar、TaskProgress、TabView）

### Modified Capabilities
（無既有 spec 需修改，Phase 2 純為前端新增）

## Impact

- **新增檔案**：`src/pages/` 6 個頁面、`src/components/` 4+ 個元件、`src/hooks/useOpenSpec.ts`、`src/contexts/RepoContext.tsx`
- **修改檔案**：`src/App.tsx`（加入路由）、`src/main.tsx`（加入 providers）
- **依賴**：使用已安裝的 react-router-dom v7；Markdown 渲染留待 Phase 3
- **後端**：無變更，完全使用 Phase 1 建立的 API
