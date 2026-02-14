## 1. Workflow 建立

- [x] 1.1 建立 `.github/workflows/vscode-publish.yml` workflow 檔案
- [x] 1.2 設定觸發條件：push `v*` tag + workflow_dispatch

## 2. Build Chain

- [x] 2.1 設定 Node.js 20 環境與 npm install
- [x] 2.2 加入 build 步驟：build core → build webview → build extension

## 3. Version Check & Publish

- [x] 3.1 加入 version consistency check（從 tag 提取版號與 package.json 比對）
- [x] 3.2 加入 vsce publish 步驟，使用 `VSCE_PAT` secret

## 4. Version 同步

- [x] 4.1 Root package.json 版號同步為 `0.2.0`
- [x] 4.2 加入 `version` lifecycle script，`npm version` 時自動同步版號到 `packages/vscode/package.json` 並 stage
- [x] 4.3 建立 `/release` skill 自動化發佈流程（CHANGELOG 更新 → npm version → push tag）
