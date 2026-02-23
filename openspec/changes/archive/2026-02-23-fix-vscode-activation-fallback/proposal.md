## Why

VS Code extension 的 `activationEvents` 和 `hasOpenSpecDir()` 都只檢查 `openspec/config.yaml`，但 OpenSpec CLI 不強制要求 `config.yaml` 存在。`fix-detect-fallback` change 已修正 Web server 和 VS Code handler 的 detect 邏輯加入 fallback，但當時明確跳過了 `activationEvents` 和 extension 啟動偵測。現在加了 Activity Bar sidebar 後，extension 不啟動 = sidebar 不出現，這個問題必須修正。

## What Changes

- 擴充 `activationEvents`：加入 `onStartupFinished` 作為 fallback（`workspaceContains` glob 對目錄偵測不可靠）
- 修正 `extension.ts` 的 `hasOpenSpecDir()` 函式：同步 `fix-detect-fallback` 的 fallback 邏輯，無 `config.yaml` 時檢查 `specs/` 或 `changes/` 目錄

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `vscode-extension-host`：activation 偵測邏輯需支援無 `config.yaml` 的 OpenSpec repo

## Impact

- `packages/vscode/package.json`：`activationEvents` 陣列
- `packages/vscode/src/extension.ts`：`hasOpenSpecDir()` 函式
