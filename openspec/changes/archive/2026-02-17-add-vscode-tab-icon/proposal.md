## Why

VS Code extension 的 webview panel tab 目前只顯示預設圖示，在多個 tab 中缺乏辨識度。既然 extension 已有 `webview/favicon.svg`（琥珀色 S 形 logo），應作為 tab icon 使用，讓使用者快速辨識 spek panel。

## What Changes

- 在 `SpekPanel` 建立 webview panel 後設定 `iconPath`，指向已有的 `webview/favicon.svg`
- 不需要新增任何圖片資源，直接複用現有的 favicon

## Capabilities

### New Capabilities

_無新增 capability — 此變更為現有 webview-integration 的增強。_

### Modified Capabilities

- `webview-integration`: 新增 tab icon 顯示的 requirement

## Impact

- 影響檔案：`packages/vscode/src/panel.ts`（加一行 `iconPath` 設定）
- 無 API 變更、無依賴變更、無 breaking change
