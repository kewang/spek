## 1. Favicon 替換

- [x] 1.1 將 `logo/favicon.svg` 內容複製到 `packages/web/public/favicon.svg`
- [x] 1.2 將 `logo/favicon.svg` 內容複製到 `packages/vscode/webview/favicon.svg`

## 2. Header Logomark

- [x] 2.1 在 `Layout.tsx` header 的 brand 區域加入 inline SVG logomark（S 曲線 + 菱形光點，使用 `currentColor`），放在 "spek" 文字左側
- [x] 2.2 確認深色與淺色主題下 logo 顏色正確跟隨 accent 色

## 3. 清理

- [x] 3.1 移除根目錄 `public/favicon.svg` 和 `dist/favicon.svg` 舊檔案（若為過時副本）
