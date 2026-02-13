## Why

目前 spek VS Code extension 只能透過手動打包 `.vsix` 安裝，使用門檻高且無法自動更新。發佈到 VS Code Marketplace 讓使用者能直接搜尋安裝，並享有版本更新通知。

## What Changes

- 移除 `package.json` 的 `"private": true` 限制
- 新增 Marketplace 必要欄位：`repository`、`license`、`icon`、`homepage`、`bugs`
- 建立 extension 專屬 `README.md`（Marketplace 頁面內容）
- 建立 `CHANGELOG.md`
- 產生 128x128 PNG icon（從現有 SVG logomark 轉換）
- 更新 `.vscodeignore` 排除不需要的檔案
- 補充 `categories`、`keywords` 提升 Marketplace 搜尋能見度

## Capabilities

### New Capabilities

- `vscode-marketplace-metadata`: 定義 VS Code extension 發佈到 Marketplace 所需的 metadata 配置、檔案結構與發佈流程

### Modified Capabilities

（無既有 spec 的需求層級變更，此次僅新增發佈配置）

## Impact

- **packages/vscode/package.json**：新增多個 Marketplace 必要欄位
- **packages/vscode/README.md**：新建，作為 Marketplace 頁面內容
- **packages/vscode/CHANGELOG.md**：新建
- **packages/vscode/.vscodeignore**：更新排除規則
- **packages/vscode/icon.png**：新建（從 SVG 轉換）
- **發佈流程**：需要 publisher 帳號與 Azure DevOps PAT
