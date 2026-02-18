## 1. 前端 Refresh 基礎建設

- [x] 1.1 建立 `RefreshContext`（`packages/web/src/contexts/RefreshContext.tsx`）：提供 `refreshKey` 和 `refresh()` 方法
- [x] 1.2 修改 `useAsyncData` hook：從 RefreshContext 取得 `refreshKey` 加入 deps，加入 debounce（300ms），re-fetch 時保留既有 data 不顯示 loading flash
- [x] 1.3 在 `App.tsx`、`WebviewApp.tsx` 包裹 `RefreshProvider`

## 2. Web 版 SSE File Watching

- [x] 2.1 安裝 `chokidar` 依賴
- [x] 2.2 新增 SSE endpoint `GET /api/openspec/watch?dir=...`：用 chokidar 監聯 `openspec/` 目錄下 `.md`/`.yaml` 檔案，debounce 500ms 後發送 SSE event
- [x] 2.3 實作 watcher 共享邏輯：相同 dir 共用 watcher，client 斷線時清理
- [x] 2.4 建立 `useFileWatcher` hook（Web 版）：用 `EventSource` 連接 SSE endpoint，收到事件時呼叫 `refresh()`

## 3. VS Code 版 FileSystemWatcher

- [x] 3.1 在 `SpekPanel` 建立 `vscode.workspace.createFileSystemWatcher('**/openspec/**/*.{md,yaml}')`
- [x] 3.2 監聽 create/change/delete 事件，debounce 500ms 後發送 `{ type: "fileChanged" }` 到 webview
- [x] 3.3 將 watcher 加入 `disposables` 確保 panel 關閉時清理
- [x] 3.4 建立 `useFileWatcher` hook（VS Code 版）：監聽 `fileChanged` message，呼叫 `refresh()`

## 4. 環境整合與測試

- [x] 4.1 `useFileWatcher` 依據環境自動選擇實作（SSE / postMessage / no-op）
- [x] 4.2 手動測試 Web 版：啟動 dev server，修改 openspec 檔案確認畫面自動更新
- [x] 4.3 Type check 通過（`npm run type-check`）
- [x] 4.4 Build 通過（`npm run build`）
