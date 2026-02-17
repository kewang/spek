## Why

目前 spek 以列表方式呈現 Specs 和 Changes，使用者需要逐一點進去才能了解它們之間的關聯。當專案規模變大，很難直覺看出「哪些 changes 影響了哪些 specs」、「哪些 specs 經常一起被修改」。需要一個互動式圖表視圖，讓使用者一眼掌握 spec 與 change 的關聯全貌。

## What Changes

- 新增 Graph View 頁面（`/graph` 路由），以 force-directed 圖表呈現 Specs 與 Changes 的關聯
- Spec 節點（圓形）與 Change 節點（方形）透過邊連接，表示「該 change 修改了該 spec」
- 支援互動操作：拖曳節點、hover 高亮相連節點與邊、點擊導航至詳情頁、縮放平移
- 節點大小反映重要性（spec 的 historyCount、change 的 spec 數量）
- Sidebar 新增 Graph 導覽項目
- 新增 API endpoint 提供圖表所需的關聯資料

## Capabilities

### New Capabilities
- `graph-view`: 互動式 force-directed 圖表頁面，視覺化 specs 與 changes 之間的修改關聯

### Modified Capabilities
- `shared-layout`: Sidebar 新增 Graph 導覽連結
- `openspec-api`: 新增 graph data endpoint 回傳節點與邊資料

## Impact

- 前端：新增頁面元件、D3.js 依賴、路由設定
- 後端：新增 `/api/openspec/graph` endpoint
- Core：可能需要新增 graph data 建構函式
- 所有三個 adapter（FetchAdapter、MessageAdapter、StaticAdapter）需支援新 API
- Demo build 需包含 graph 資料
