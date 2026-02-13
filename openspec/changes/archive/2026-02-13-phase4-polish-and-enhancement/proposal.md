## Why

Phase 1~3 完成了核心功能（API、頁面、Markdown 渲染、搜尋），但 UI 仍為桌面限定、僅深色主題、缺少 spec 演進的歷史脈絡。Phase 4 的目標是提升使用體驗——讓應用在各種裝置上可用、提供淺色主題選項、並讓使用者能追蹤 spec 隨時間演進的歷程。

## What Changes

- 新增響應式佈局：sidebar 可收合、行動裝置漢堡選單、內容區自適應寬度
- 新增深色/淺色主題切換，支援系統偏好偵測與 localStorage 持久化
- 增強 repo 選擇頁的最近路徑體驗：驗證路徑是否仍有效、顯示路徑狀態
- 新增 spec 演進歷史 API 與 UI：顯示哪些 change 影響了特定 spec，含時間線視圖

## Capabilities

### New Capabilities
- `responsive-layout`: 響應式佈局系統，包含 sidebar 收合、漢堡選單、斷點適配
- `theme-toggle`: 深色/淺色主題切換功能，含系統偏好偵測、localStorage 持久化、CSS 變數雙主題定義
- `spec-history`: Spec 演進歷史追蹤，API 回傳每個 spec 被哪些 change 修改及時間線，UI 以時間線呈現

### Modified Capabilities
- `shared-layout`: 加入 sidebar 收合能力與響應式斷點適配
- `repo-selection`: 增強最近路徑清單——非同步驗證路徑有效性、顯示狀態指標（有效/無效/檢查中）

## Impact

- **前端元件**：Layout、Sidebar 需重構支援收合；新增 ThemeProvider context；SpecDetail 加入歷史時間線區塊
- **CSS**：global.css 需定義淺色主題 CSS 變數，切換以 `data-theme` attribute 或 class 控制
- **API**：新增 `GET /api/openspec/specs/:topic/history` endpoint，回傳 change 影響時間線
- **依賴**：無需新增外部依賴
- **Context**：新增 ThemeContext（或擴充既有 context），管理主題狀態
