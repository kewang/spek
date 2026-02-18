## Why

在使用 OpenSpec 工作流時（如執行 `/openspec-new-change`、`/opsx:apply` 等），spek 的畫面不會自動反映磁碟上的檔案變更。使用者必須切到其他頁面再切回來才能看到最新內容，這打斷了工作流程。需要讓 spek 在檔案變更時自動更新畫面。

## What Changes

- 新增檔案監聽機制：Web 版使用 `chokidar` 監聽 `openspec/` 目錄變更，透過 SSE (Server-Sent Events) 推送通知給前端
- VS Code 版使用 `vscode.workspace.createFileSystemWatcher` 監聽檔案變更，透過 `postMessage` 通知 webview
- 前端新增 `useFileWatcher` hook，接收檔案變更事件並自動觸發當前頁面資料重新載入
- `useAsyncData` 新增 `refreshKey` 依賴機制，外部可觸發 re-fetch
- Demo 版（StaticAdapter）不受影響，資料為靜態內嵌

## Capabilities

### New Capabilities
- `live-reload`: 檔案變更時自動重新載入頁面資料的機制，涵蓋 Web SSE 通道、VS Code FileSystemWatcher 通道、以及前端 refresh 觸發邏輯

### Modified Capabilities
- `api-adapter`: ApiAdapter 介面新增 `onFileChange` 訂閱方法，讓前端可監聽檔案變更事件
- `webview-integration`: Webview 新增接收 `fileChanged` 訊息類型的能力

## Impact

- **後端** (`packages/web/server/`): 新增 SSE endpoint 和 chokidar 檔案監聽
- **前端** (`packages/web/src/`): 新增 `useFileWatcher` hook，修改 `useAsyncData` 支援外部 refresh 觸發
- **VS Code Extension** (`packages/vscode/src/`): `SpekPanel` 新增 FileSystemWatcher
- **ApiAdapter 介面**: 新增 `onFileChange` 方法，FetchAdapter / MessageAdapter / StaticAdapter 各自實作
- **新增依賴**: `chokidar`（Web server file watching）
- **不影響**: Demo 版、核心模組 (`@spek/core`)
