## 1. Icon 準備

- [x] 1.1 將 `logo/logomark.svg` 轉換為 128x128 PNG，輸出到 `packages/vscode/icon.png`

## 2. package.json 更新

- [x] 2.1 移除 `"private": true`
- [x] 2.2 更新 `publisher` 為 `"kewang"`
- [x] 2.3 新增 `"repository"` 欄位（指向 GitHub repo）
- [x] 2.4 新增 `"license": "MIT"`
- [x] 2.5 新增 `"icon": "icon.png"`
- [x] 2.6 新增 `"homepage"` 與 `"bugs"` 欄位
- [x] 2.7 更新 `"categories"` 為 `["Other"]`
- [x] 2.8 新增 `"keywords": ["openspec", "spec", "bdd", "documentation", "viewer"]`

## 3. Extension README

- [x] 3.1 建立 `packages/vscode/README.md`，包含功能說明、安裝方式、使用方法

## 4. CHANGELOG

- [x] 4.1 建立 `packages/vscode/CHANGELOG.md`，包含 v0.1.0 初始版本記錄

## 5. vscodeignore 更新

- [x] 5.1 更新 `packages/vscode/.vscodeignore`，確保排除 src/、node_modules/ 等，保留 dist/、webview/、icon.png、README.md、CHANGELOG.md

## 6. 驗證打包

- [x] 6.1 執行 `vsce package --no-dependencies` 確認打包成功無錯誤
- [x] 6.2 檢查 `.vsix` 檔案大小與內容合理
