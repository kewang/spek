## ADDED Requirements

### Requirement: Marketplace-ready package.json
Extension 的 `package.json` SHALL 包含所有 VS Code Marketplace 發佈所需的欄位。

#### Scenario: Required fields present
- **WHEN** 執行 `vsce package` 打包 extension
- **THEN** package.json 包含以下欄位且無 validation 錯誤：`publisher`、`repository`、`license`、`icon`、`categories`、`keywords`

#### Scenario: Private flag removed
- **WHEN** package.json 被讀取
- **THEN** `"private"` 欄位 SHALL 不存在或為 `false`

#### Scenario: Icon file exists
- **WHEN** package.json 指定 `"icon": "icon.png"`
- **THEN** `packages/vscode/icon.png` 檔案存在且為 128x128 以上的 PNG 圖片

### Requirement: Marketplace README
Extension 目錄下 SHALL 有獨立的 `README.md` 作為 Marketplace 頁面內容。

#### Scenario: README content
- **WHEN** Marketplace 頁面載入
- **THEN** 顯示 extension 的功能說明、安裝方式與使用說明

#### Scenario: README exists in extension directory
- **WHEN** 執行 `vsce package`
- **THEN** `packages/vscode/README.md` 被包含在 `.vsix` 中

### Requirement: CHANGELOG
Extension 目錄下 SHALL 有 `CHANGELOG.md` 記錄版本變更。

#### Scenario: CHANGELOG content
- **WHEN** 使用者在 Marketplace 或 VS Code 中檢視 extension 的 changelog
- **THEN** 顯示按版本分組的變更記錄

### Requirement: vscodeignore configuration
`.vscodeignore` SHALL 排除不需要包含在 `.vsix` 中的檔案，減少套件大小。

#### Scenario: Source files excluded
- **WHEN** 執行 `vsce package`
- **THEN** `src/`、`node_modules/`、`tsconfig.json`、`.gitignore` 不被包含在 `.vsix` 中

#### Scenario: Required files included
- **WHEN** 執行 `vsce package`
- **THEN** `dist/`、`webview/`、`icon.png`、`README.md`、`CHANGELOG.md`、`LICENSE` 被包含在 `.vsix` 中

### Requirement: Publish workflow
使用者 SHALL 能透過 `vsce` CLI 將 extension 發佈到 Marketplace。

#### Scenario: First-time publish
- **WHEN** 使用者執行 `vsce login <publisher>` 並輸入有效的 PAT
- **AND** 執行 `vsce publish`
- **THEN** extension 成功發佈到 VS Code Marketplace

#### Scenario: Version update publish
- **WHEN** 使用者更新 package.json 版本號
- **AND** 執行 `vsce publish`
- **THEN** Marketplace 上的 extension 更新到新版本
