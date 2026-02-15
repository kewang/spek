## Why

經過前端設計審查，發現 spek 有數項影響功能正確性與使用體驗的問題：Demo 版搜尋功能無法正確搜尋（P0 bug）、行動版漢堡按鈕缺少 accessibility label（P0 a11y）、進度條未反映完成語意（P1）、Dashboard 統計數字視覺權重不足且缺少入場動畫（P1）、以及全站使用系統字體堆疊缺乏品牌識別（P1）。

## What Changes

- 修正 StaticAdapter 的 `search()` 實作，使其能正確搜尋 spec/change 的 title 和內容
- 為行動版 hamburger 按鈕加入 `aria-label` 屬性
- TaskProgress 進度條在全部完成時（100%）從琥珀色變為綠色
- Dashboard stat cards 數字放大並加入 staggered fade-in 入場動畫
- 引入特色字體（Google Fonts）取代系統字體堆疊，建立品牌識別

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `api-adapter`：新增 StaticAdapter 的 search 行為規格（目前 spec 未涵蓋 StaticAdapter）
- `shared-layout`：hamburger 按鈕的 accessibility 需求、全站字體變更
- `dashboard-view`：stat cards 數字樣式放大與入場動畫、進度條完成狀態色彩語意

## Impact

- **前端元件**：`StaticAdapter.ts`、`Layout.tsx`（header hamburger）、`Dashboard.tsx`（stat cards）、`TaskProgress.tsx`（進度條）、`global.css`（字體）
- **依賴**：新增 Google Fonts CDN 引用（或 self-hosted）
- **Demo**：修正後需重新 build demo.html
- **VS Code Extension**：webview 字體同步變更，需確認 CSP 允許字體載入
