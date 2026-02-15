## 1. P0: StaticAdapter 搜尋修正

- [x] 1.1 除錯 `StaticAdapter.search()` — 確認 demo build 的 `specDetails` 資料結構中 key 與 content 是否正確填充
- [x] 1.2 修正 `StaticAdapter.search()` — 確保 spec topic name 的 substring matching 正確運作，同時搜尋 `specs` 列表的 topic name
- [x] 1.3 重新 build demo (`npm run build:demo`) 並驗證搜尋 "dashboard" 能找到 "dashboard-view"

## 2. P0: Hamburger 按鈕 Accessibility

- [x] 2.1 在 `Layout.tsx` 的行動版 hamburger `<button>` 加入 `aria-label="Open navigation menu"`

## 3. P1: 進度條完成狀態色彩

- [x] 3.1 修改 `TaskProgress.tsx` — 根據 `completed === total && total > 0` 條件，將進度條 class 從 `bg-accent` 切換為 `bg-green-500`

## 4. P1: Stat Cards 視覺強化

- [x] 4.1 在 `global.css` 新增 `@keyframes fadeInUp` 動畫定義，以及 `prefers-reduced-motion: reduce` 的取消規則
- [x] 4.2 修改 `Dashboard.tsx` — stat card 數字從 `text-2xl` 改為 `text-4xl`，並為每張卡片加入 staggered `animation-delay` 的 fadeInUp 動畫

## 5. P1: 引入特色字體

- [x] 5.1 在 `packages/web/index.html` 加入 Google Fonts `<link>` tag 載入 Plus Jakarta Sans（variable, 400-800）
- [x] 5.2 在 `packages/web/src/styles/global.css` 更新 body `font-family` 為 `"Plus Jakarta Sans", sans-serif`
- [x] 5.3 在 `scripts/build-demo.ts` 確認 demo build 也包含 Google Fonts link，或在 demo HTML template 中加入

## 6. 驗證

- [x] 6.1 執行 `npm run type-check` 確認無型別錯誤
- [x] 6.2 重新 build demo (`npm run build:demo`) 並用瀏覽器驗證所有改動
