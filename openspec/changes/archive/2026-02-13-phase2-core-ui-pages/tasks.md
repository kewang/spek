## 1. 基礎建設：路由與狀態管理

- [x] 1.0 建立 `.nvmrc` — 指定 Node 22
- [x] 1.1 建立 `src/contexts/RepoContext.tsx` — 提供 repoPath / setRepoPath，從 localStorage 初始化
- [x] 1.2 建立 `src/hooks/useOpenSpec.ts` — 封裝所有 API hooks（useOverview, useSpecs, useSpec, useChanges, useChange, useBrowse, useDetect），每個回傳 { data, loading, error }
- [x] 1.3 改寫 `src/App.tsx` — 使用 createBrowserRouter 設定路由表，包裹 RepoContext Provider
- [x] 1.4 更新 `src/main.tsx` — 渲染 RouterProvider

## 2. 共用元件

- [x] 2.1 建立 `src/components/Layout.tsx` — Header (56px) + Sidebar (240px) + Main 區域，使用 Outlet 渲染子路由
- [x] 2.2 建立 `src/components/Sidebar.tsx` — Overview / Specs / Changes 導覽連結，當前路由高亮
- [x] 2.3 建立 `src/components/TaskProgress.tsx` — 進度條元件，接收 completed / total props
- [x] 2.4 建立 `src/components/TabView.tsx` — 通用 Tab 切換元件，接收 tabs 配置

## 3. SelectRepo 頁面

- [x] 3.1 建立 `src/pages/SelectRepo.tsx` — 路徑輸入框 + 偵測結果顯示 + 開啟按鈕
- [x] 3.2 實作目錄瀏覽功能 — 呼叫 browse API 顯示目錄列表，點擊導覽
- [x] 3.3 實作最近路徑列表 — 從 localStorage 讀取，點擊快速選擇
- [x] 3.4 實作自動導向 — 選擇有效 repo 後設定 RepoContext 並導向 /dashboard

## 4. Dashboard 頁面

- [x] 4.1 建立 `src/pages/Dashboard.tsx` — 呼叫 useOverview 顯示統計卡片（specs 數量、active/archived changes 數量、任務完成率）
- [x] 4.2 實作 active changes 列表區塊 — 顯示名稱 + TaskProgress 進度條
- [x] 4.3 實作最近封存 changes 區塊 — 最近 10 個 archived changes
- [x] 4.4 實作導覽卡片 — 連結到 /specs 和 /changes

## 5. Spec 頁面

- [x] 5.1 建立 `src/pages/SpecList.tsx` — 呼叫 useSpecs 顯示字母排序列表 + 即時過濾輸入
- [x] 5.2 建立 `src/pages/SpecDetail.tsx` — 呼叫 useSpec(topic) 顯示標題 + raw markdown 內容 + 關聯 changes 列表

## 6. Change 頁面

- [x] 6.1 建立 `src/pages/ChangeList.tsx` — 呼叫 useChanges 分 Active / Archived 區塊顯示，Archived 按日期排序
- [x] 6.2 建立 `src/pages/ChangeDetail.tsx` — 呼叫 useChange(slug)，使用 TabView 切換 Proposal / Design / Tasks / Specs 四個 tab
- [x] 6.3 實作 Tasks tab — 顯示 TaskProgress 進度條 + raw tasks 內容
- [x] 6.4 實作 Specs tab — 列出 delta specs 並顯示內容

## 7. 保護性路由與收尾

- [x] 7.1 實作未選擇 repo 時重導向 `/` 的邏輯（在 Layout 或路由 loader 中）
- [x] 7.2 驗證所有頁面的 loading / error 狀態顯示
- [x] 7.3 確認 `npm run type-check` 通過
- [x] 7.4 確認 `npm run build` 成功
