## 1. Sidebar 元件改造

- [x] 1.1 為 Sidebar 導覽連結新增 icon（Overview: LayoutDashboard, Specs: FileText, Changes: GitBranch），使用 inline SVG
- [x] 1.2 新增 `collapsed` 和 `onToggle` props 到 Sidebar 元件
- [x] 1.3 實作收合態 UI：56px 寬度、icon-only 導覽、icon-only Resync 按鈕、各項目加 title tooltip
- [x] 1.4 實作 toggle 按鈕：位於 sidebar 底部 Resync 上方，展開時顯示 `«`、收合時顯示 `»`
- [x] 1.5 加入 sidebar 寬度與內容的 CSS transition 動畫（200ms）

## 2. Layout 整合

- [x] 2.1 在 Layout 元件新增 `collapsed` state，Web 版從 localStorage 讀取初始值
- [x] 2.2 傳遞 `collapsed` 和 `onToggle` props 給 Sidebar
- [x] 2.3 主內容區域左邊距隨 collapsed 狀態動態切換（`ml-60` ↔ `ml-14`）
- [x] 2.4 確認行動裝置行為不受影響（overlay sidebar 維持不變）

## 3. 驗證與收尾

- [x] 3.1 Web 版測試：收合/展開動畫、狀態持久化、頁面重新整理後恢復
- [x] 3.2 VS Code webview 測試：收合/展開功能、預設展開狀態
- [x] 3.3 確認 type-check 通過
