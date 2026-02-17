## Context

VS Code 的 `WebviewPanel` 支援 `iconPath` 屬性，可在 tab 上顯示自訂圖示。目前 `SpekPanel` 建立 panel 後未設定此屬性，導致 tab 只顯示預設圖示。

Extension 已有 `webview/favicon.svg`（32x32，深色背景 + 琥珀色 S 形 logo），適合直接作為 tab icon。

## Goals / Non-Goals

**Goals:**
- 讓 spek webview panel 在 VS Code tab bar 上顯示專屬 icon

**Non-Goals:**
- 不區分 light/dark theme 的 icon 版本（現有 SVG 在兩種背景下都可辨識）
- 不新增額外圖片資源

## Decisions

### 直接使用現有 favicon.svg

**選擇**：複用 `webview/favicon.svg` 作為 tab icon

**替代方案**：
- 新建專用的 tab icon 圖片 — 不必要，現有 SVG 品質已足夠
- 分別提供 light/dark 版本 — 現有 SVG 帶深色背景 `#0a0c0f`，在 light/dark theme 都有足夠對比度

**理由**：零額外資源，一行程式碼完成。

### 使用單一 URI 而非 light/dark 物件

**選擇**：`panel.iconPath = vscode.Uri.joinPath(...)` 傳入單一 URI

**替代方案**：傳入 `{ light: Uri, dark: Uri }` 物件分別指定

**理由**：favicon.svg 的深色背景使其在兩種 theme 下都清晰可見，不需分別處理。

## Risks / Trade-offs

- [SVG 相容性] VS Code 的 tab icon 支援 SVG 格式 → 無風險，官方文件明確支援
- [icon 尺寸] tab icon 顯示尺寸較小 → favicon.svg 已針對 32x32 小尺寸優化，無問題
