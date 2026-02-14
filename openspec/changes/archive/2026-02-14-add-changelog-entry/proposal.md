## Why

VS Code extension CHANGELOG 停留在 `0.1.0` 初始版本，但之後已新增 sidebar 收合/展開功能（來自使用者回饋）。使用者在 Marketplace 或 VS Code 的 extension 頁面看不到最新功能異動，不知道有新增什麼。需要更新 CHANGELOG 並 bump version 以反映新功能。

## What Changes

- 更新 `packages/vscode/CHANGELOG.md`，新增 `0.2.0` 版本紀錄，涵蓋 sidebar toggle 功能
- Bump `packages/vscode/package.json` version 從 `0.1.0` 到 `0.2.0`

## Capabilities

### New Capabilities

（無新 capability，僅更新文件與版號）

### Modified Capabilities

- `vscode-marketplace-metadata`: 更新 version 欄位與 CHANGELOG 內容

## Impact

- `packages/vscode/CHANGELOG.md`：新增版本紀錄
- `packages/vscode/package.json`：version bump
- 不影響任何程式碼邏輯或 runtime 行為
