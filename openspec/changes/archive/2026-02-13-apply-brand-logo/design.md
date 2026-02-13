## Context

spek 目前使用純文字 "S" 作為 favicon（`<text>` 元素），header 中也僅顯示純文字 "spek"。已設計好一套 SVG logo 系統放在 `logo/` 目錄，包含 logomark、full logo、favicon，需要整合到專案中。

現有 favicon 位置：
- `packages/web/public/favicon.svg`（Web 版）
- `packages/vscode/webview/favicon.svg`（VS Code Webview）
- `public/favicon.svg`、`dist/favicon.svg`（舊檔案，可能未使用）

Header brand 區域在 `packages/web/src/components/Layout.tsx` 第 63 行：
```tsx
<span className="text-accent font-bold text-lg">spek</span>
```

## Goals / Non-Goals

**Goals:**
- 將新設計的 favicon SVG 替換所有既有 favicon
- 在 header brand 區域加入 inline SVG logomark（S 曲線 + 菱形光點）
- 保持深色/淺色主題相容性

**Non-Goals:**
- 不修改 SelectRepo 頁面的大標題（那邊維持純文字即可）
- 不新增 PNG/ICO 等其他格式
- 不修改 VS Code extension 的 icon（那是 marketplace 用的，與 webview favicon 不同）

## Decisions

### 1. Favicon 直接使用 `logo/favicon.svg` 內容覆蓋

直接將 `logo/favicon.svg` 的內容複製到各個 `favicon.svg` 位置，而非用 symlink 或 build step 引用。原因：webview 打包時需要實際檔案，symlink 在某些環境不可靠。

### 2. Header logomark 使用 inline SVG 而非 `<img>`

在 Layout.tsx 中直接內嵌 SVG 路徑（S 曲線 + 菱形），而非引用外部 SVG 檔案。原因：
- 避免額外 HTTP 請求
- 可直接使用 CSS 變數（`currentColor`）配合主題切換
- Logo 很小（幾行 path），不會膨脹 bundle

### 3. Header logo 使用 `currentColor` 搭配 accent 色

不硬編碼 `#f59e0b`，而是使用 Tailwind 的 `text-accent` class 讓 SVG 的 `currentColor` 自動跟隨主題。這樣深色/淺色主題切換時 logo 顏色會自動調整。

## Risks / Trade-offs

- **[Risk]** Favicon 在某些瀏覽器快取後不更新 → 使用者清除快取即可，非阻塞問題
- **[Trade-off]** Inline SVG vs 外部檔案：稍增 JSX 行數，但省去載入延遲和額外請求
