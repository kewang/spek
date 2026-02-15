## Context

spek 前端經過設計審查後，發現 P0（功能/a11y bug）和 P1（視覺體驗）的改進項目。目前前端使用 React 19 + Tailwind CSS v4 + Vite，所有元件用 Tailwind utility class 做樣式。

## Goals / Non-Goals

**Goals:**
- 修正 Demo 版 StaticAdapter 搜尋 bug（搜尋 "dashboard" 應找到 "dashboard-view"）
- 為行動版 hamburger 按鈕加入 aria-label
- TaskProgress 進度條在 100% 完成時顯示綠色
- Dashboard stat cards 數字放大（text-4xl）並加入 staggered fade-in 動畫
- 引入 Google Fonts 特色字體取代系統字體堆疊

**Non-Goals:**
- 不重新設計整體 layout 或色彩系統
- 不新增 Specs 列表摘要預覽（P2）
- 不做 Tab 切換動畫或 skeleton loading（P2/P3）
- 不處理 VS Code extension 的字體 CSP 問題（另案處理）

## Decisions

### 1. StaticAdapter 搜尋修正策略

**問題**：搜尋 "dashboard" 找不到 "dashboard-view" spec。原始碼中 `search()` 方法邏輯正確（`topic.toLowerCase().includes(q)` 應該匹配），但 `detail.content` 是 markdown 原始內容。經檢查，問題出在 `specDetails` 的 key 是 topic name（如 `dashboard-view`），`topic.toLowerCase().includes("dashboard")` 理論上為 true。

需進一步除錯確認是否為 demo build 時 `specDetails` 資料結構問題，或是 `SpecDetail` 的 `content` 欄位為空。

**決策**：在 search 中加入 spec title（即 topic name）的匹配作為第一優先，同時也搜尋 `specs` 列表（不只 `specDetails`）。改用 Fuse.js 做 fuzzy matching 會過重，改為加強 substring matching 的覆蓋範圍即可。

### 2. 進度條完成狀態色彩

**決策**：在 `TaskProgress` 元件中，根據 `completed === total` 條件動態切換進度條顏色 class。
- 未完成：維持 `bg-accent`（琥珀色）
- 已完成：切換為 `bg-green-500`（綠色）

選擇 Tailwind 內建的 `green-500` 而非自訂色，因為只有這一個語意用途，不需要擴充 theme。

### 3. Stat Cards 動畫方案

**決策**：使用純 CSS `@keyframes` + `animation-delay` 做 staggered fade-in，不引入 Motion library。理由：
- 僅 Dashboard 頁面需要，不需要整個動畫框架
- 4 張卡片的 stagger 效果用 CSS 即可實現
- 在 `global.css` 中定義 `@keyframes fadeInUp`，Dashboard 中透過 inline style 設定不同的 `animation-delay`

數字大小從 `text-2xl` 改為 `text-4xl`，增加視覺衝擊。

### 4. 字體選擇

**決策**：選用 **Plus Jakarta Sans** 作為主字體。理由：
- 幾何風格、現代感，適合開發工具
- 有 Variable Font 版本，檔案小效率高
- 支援 400-800 字重，涵蓋 body 和 heading
- 免費開源（OFL），可透過 Google Fonts CDN 載入

**載入方式**：在 `index.html` 和 demo 的 HTML 中加入 Google Fonts `<link>` tag，再更新 `global.css` 的 `font-family`。不使用 self-hosted 方式以減少 build 複雜度。

程式碼字體維持 JetBrains Mono 不變。

### 5. Hamburger aria-label

**決策**：在 `Layout.tsx` 的行動版 hamburger `<button>` 加入 `aria-label="Open navigation menu"`（英文，因為是 HTML 屬性非使用者可見文字）。

## Risks / Trade-offs

- **Google Fonts CDN 依賴**：離線環境（如部分企業內網）可能無法載入字體，需確保 fallback 字體堆疊仍可用 → 加入 `sans-serif` fallback
- **CSS 動畫 prefers-reduced-motion**：部分使用者偏好減少動畫 → 加入 `@media (prefers-reduced-motion: reduce)` 取消動畫
- **VS Code Webview 字體載入**：Webview CSP 預設不允許外部資源 → 此次不處理 VS Code 的字體，維持系統字體 fallback（已列為 Non-Goal）
