## Why

來自 VS Code Marketplace 使用者回饋（Joshua Reed, 5 星）：「This is a very simple but useful extension. It would be even better if a sidebar toggle could be added.」目前 web 版與 VS Code webview 中的 sidebar 導覽列在桌面裝置永遠顯示（240px 寬），無法收合，佔用內容閱讀空間。需要新增 sidebar toggle 功能讓使用者可以折疊 sidebar 以獲得更大的內容區域。

## What Changes

- 在 Layout 的 sidebar 區域新增收合/展開 toggle 按鈕
- 收合狀態下 sidebar 縮為窄條（僅顯示導覽 icon），hover 或點擊 icon 可直接導覽
- 展開狀態維持現有完整導覽列
- 主內容區域隨 sidebar 狀態動態調整左邊距
- Web 版將收合狀態記憶到 localStorage，下次開啟時保持上次狀態
- VS Code webview 版同樣支援收合/展開，狀態隨 webview 生命週期
- 共用同一套 Layout 元件邏輯，Web 與 Webview 行為一致

## Capabilities

### New Capabilities

- `sidebar-toggle`: Sidebar 收合/展開功能，包含 toggle 按鈕、收合態 icon-only UI、狀態持久化、與主內容區域自適應佈局

### Modified Capabilities

- `shared-layout`: Layout 元件需支援 sidebar collapsed/expanded 狀態，調整主內容區域的左邊距與 sidebar 寬度

## Impact

- `packages/web/src/components/Layout.tsx`：新增 sidebar toggle 狀態管理與收合態樣式
- `packages/web/src/components/Sidebar.tsx`：支援收合模式（icon-only 顯示）
- 可能新增 sidebar toggle 相關的 icon 或 SVG 元件
- 不影響後端、API、core module 或 VS Code extension host
