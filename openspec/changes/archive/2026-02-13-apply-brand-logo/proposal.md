## Why

spek 目前僅使用純文字 "S" 作為 favicon，缺乏品牌識別度。已設計完成一套完整的 SVG logo 系統（logomark、full logo、favicon），需要套用到專案的 favicon 及 UI header 中，建立統一的品牌視覺。

## What Changes

- 替換所有 favicon.svg（web、vscode webview）為新設計的品牌 logo
- 在 Layout header 中加入 SVG logomark，取代純文字 "spek"
- 保留 `logo/` 目錄作為品牌素材來源

## Capabilities

### New Capabilities

（無新 capability）

### Modified Capabilities

- `shared-layout`: Header component 的 brand 區域從純文字改為 SVG logomark + 文字組合

## Impact

- `packages/web/public/favicon.svg` — 替換為新 favicon
- `packages/vscode/webview/favicon.svg` — 同步替換
- `packages/web/src/components/Layout.tsx` — header brand 區域加入 SVG icon
- 無 API 變更、無依賴變更
