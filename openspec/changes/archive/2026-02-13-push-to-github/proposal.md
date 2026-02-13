## Why

專案已經開發到可公開的狀態，但 repo 尚未 push 到 GitHub remote。同時 VS Code Extension 已發佈至 Marketplace，但 README 仍顯示手動 build `.vsix` 的安裝方式，需更新為 Marketplace 安裝連結。

## What Changes

- 設定 GitHub remote 並將 `master` 分支 push 到 `https://github.com/kewang/spek`
- 更新 `README.md` 的 VS Code Extension 區塊：移除手動 build 指令，改為 Marketplace 安裝連結
- 更新 `README.zh-TW.md` 的 VS Code Extension 區塊：同上

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

（無 spec 層級的需求變更，僅文件與 repo 配置調整）

## Impact

- **文件**：`README.md`、`README.zh-TW.md` 的安裝說明更新
- **Git**：新增 remote origin，push `master` 分支
- **程式碼**：無影響
