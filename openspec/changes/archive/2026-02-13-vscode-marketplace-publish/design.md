## Context

spek VS Code extension 目前以 `"private": true` 設定，只能手動打包 `.vsix` 安裝。要發佈到 VS Code Marketplace，需要補齊 metadata、建立 publisher 帳號、並準備 Marketplace 頁面所需的內容檔案（README、icon、CHANGELOG）。

現有的 extension 打包流程已可運作（esbuild + vsce package），主要缺少的是發佈配置而非功能變更。

## Goals / Non-Goals

**Goals:**
- 讓 extension 可透過 `vsce publish` 發佈到 VS Code Marketplace
- 提供完整的 Marketplace 頁面（說明、icon、changelog）
- 維持現有打包流程相容

**Non-Goals:**
- 不建立 CI/CD 自動發佈流程（未來再做）
- 不變更 extension 功能或行為
- 不處理 pre-release / insider channel

## Decisions

### 1. Publisher ID 使用 `kewang`

與 GitHub username 一致，方便辨識。使用者需在 marketplace.visualstudio.com/manage 手動建立此 publisher。

### 2. Icon 使用 PNG 格式

Marketplace 要求 128x128 以上的 PNG icon。從現有 `logo/logomark.svg` 轉換為 128x128 PNG，放在 `packages/vscode/icon.png`。

考慮過的替代方案：直接用 SVG — 但 Marketplace 不支援 SVG icon。

### 3. Extension README 獨立於 root README

Marketplace 頁面顯示 extension 目錄下的 README.md，內容應聚焦在 VS Code 使用者的需求（安裝、功能、截圖指引），而非完整的開發文件。

### 4. categories 與 keywords 選擇

- categories: `["Other"]` — OpenSpec 是自訂格式，無更精確的分類
- keywords: `["openspec", "spec", "bdd", "documentation", "viewer"]` — 最多 5 個，涵蓋搜尋意圖

### 5. 手動發佈流程

使用 `vsce login` + `vsce publish` 手動發佈。流程簡單且符合目前需求。

## Risks / Trade-offs

- **[風險] publisher 名稱被佔用** → 如果 `kewang` 已被佔用，需改用其他 ID 並同步更新 package.json
- **[風險] icon 轉換品質** → SVG 轉 PNG 可能失真，需確認轉換後的效果
- **[取捨] 無 CI/CD 自動發佈** → 每次發佈需手動執行，但避免了 GitHub Actions 設定與 secret 管理的複雜度
