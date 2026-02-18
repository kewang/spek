## Overview

透過檔案監聽 + 事件推送實現即時更新。整體架構分三層：

1. **檔案監聽層**：偵測 `openspec/` 目錄下的檔案變更
2. **事件傳輸層**：將變更事件推送給前端（SSE / postMessage）
3. **前端觸發層**：接收事件後自動 re-fetch 當前頁面資料

## Architecture

### 前端：RefreshContext + useAsyncData 改造

不修改 `ApiAdapter` 介面。改用獨立的 `RefreshContext` 管理 refresh 狀態：

```
RefreshProvider (維護 refreshKey counter)
  └─ useAsyncData 接受 refreshKey 作為依賴
  └─ useFileWatcher 監聯事件源，bump refreshKey
```

**RefreshContext**：
- 提供 `refreshKey: number` 和 `refresh(): void`
- `useFileWatcher` hook 內部訂閱事件源，收到事件時呼叫 `refresh()`
- 所有 `useAsyncData` 呼叫自動包含 `refreshKey` 作為 deps 的一部分

**useAsyncData 改造**：
- 從 context 取得 `refreshKey`，加入 deps 陣列
- 當 `refreshKey` 變化時觸發 re-fetch
- 加入 debounce（300ms）：檔案變更常連續觸發（例如寫多個檔案），debounce 避免短時間內大量 re-fetch

### Web 版：SSE + chokidar

**Server 端**：
- 新增 `GET /api/openspec/watch?dir=...` SSE endpoint
- 用 `chokidar` 監聽 `{dir}/openspec/` 目錄（recursive）
- 檔案類型過濾：只監聽 `.md` 和 `.yaml` 檔案
- 變更事件 debounce（500ms）後發送 SSE event：`data: { "type": "changed" }`
- client 斷線時自動清理 watcher
- 用 Map 管理 watcher instances，相同 dir 共用同一個 watcher

**Client 端**（`useFileWatcher` in FetchAdapter 環境）：
- 用 `EventSource` 連接 SSE endpoint
- 收到事件時呼叫 `RefreshContext.refresh()`
- 元件 unmount 時關閉 EventSource
- EventSource 自帶斷線重連機制

### VS Code 版：FileSystemWatcher + postMessage

**Extension host**（`SpekPanel`）：
- 用 `vscode.workspace.createFileSystemWatcher` 監聽 `**/openspec/**/*.{md,yaml}`
- 檔案變更事件 debounce（500ms）後發送 `{ type: "fileChanged" }` 到 webview
- watcher 加入 `disposables` 陣列，panel 關閉時自動清理

**Webview 端**（`useFileWatcher` in MessageAdapter 環境）：
- 監聽 `message` 事件，過濾 `type === "fileChanged"`
- 收到時呼叫 `RefreshContext.refresh()`

### Demo 版

不需要 file watching。`useFileWatcher` 在 StaticAdapter 環境下為 no-op。

## Data Flow

```
檔案變更
  │
  ├─ Web: chokidar → SSE endpoint → EventSource → useFileWatcher
  └─ VSCode: FileSystemWatcher → postMessage → useFileWatcher
                                                      │
                                                      ▼
                                            RefreshContext.refresh()
                                                      │
                                                      ▼
                                              refreshKey++
                                                      │
                                                      ▼
                                          useAsyncData re-fetch (debounced)
```

## Key Decisions

### 為何用 RefreshContext 而非修改 ApiAdapter？

ApiAdapter 是純資料抓取介面。檔案監聽是環境層級的 concern，不應耦合到每個 adapter method。用獨立 context 可以：
- 不更動 ApiAdapter 介面，避免 breaking change
- 所有 hooks 自動受益，不需逐一修改
- 容易控制 debounce、pause/resume 等行為

### 為何用 SSE 而非 WebSocket？

- SSE 是單向推送，正好符合 server→client 的需求
- 瀏覽器原生支援 `EventSource`，自帶斷線重連
- 不需額外依賴（ws library），Express 原生支援

### Debounce 策略

兩階段 debounce：
1. **Server 端 500ms**：chokidar 檔案事件 debounce，減少 SSE 發送頻率
2. **Client 端 300ms**：`useAsyncData` re-fetch debounce，避免同時多個 hook 重複請求

## File Changes

| 檔案 | 變更 |
|------|------|
| `packages/web/server/index.ts` | 新增 SSE watch endpoint |
| `packages/web/src/contexts/RefreshContext.tsx` | 新增 RefreshContext + RefreshProvider |
| `packages/web/src/hooks/useFileWatcher.ts` | 新增 useFileWatcher hook（SSE / postMessage / no-op） |
| `packages/web/src/hooks/useOpenSpec.ts` | useAsyncData 加入 refreshKey + debounce |
| `packages/web/src/App.tsx` | 包裹 RefreshProvider |
| `packages/web/src/WebviewApp.tsx` | 包裹 RefreshProvider |
| `packages/web/src/main.demo.tsx` | 包裹 RefreshProvider（如有需要） |
| `packages/vscode/src/panel.ts` | 新增 FileSystemWatcher + postMessage |
| `packages/web/package.json` | 新增 chokidar 依賴 |
