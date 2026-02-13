## Context

Phase 1~3 已完成核心功能。目前 UI 為桌面固定 240px sidebar + 固定 header，僅深色主題，spec 詳細頁僅顯示 related changes 的 slug 清單但缺乏時間脈絡。SelectRepo 已有最近路徑清單，但不驗證路徑是否仍存在。

技術現狀：
- Tailwind CSS v4 + CSS custom properties（`@theme` 區塊定義色彩）
- 固定佈局：header 56px、sidebar 240px、`ml-60 pt-14` 主內容區
- RepoContext 管理 repo 路徑 + localStorage 最近路徑
- `findRelatedChanges()` 已能查找哪些 change 含有特定 spec 的 delta spec

## Goals / Non-Goals

**Goals:**
- 讓應用在 768px 以下螢幕可用（sidebar 收合為漢堡選單）
- 提供淺色主題切換，支援 system preference 自動偵測
- 增強最近路徑的可用性（顯示路徑狀態）
- 以時間線呈現 spec 被哪些 change 修改的歷史

**Non-Goals:**
- 完整的 PWA 或離線支援
- 自訂主題色彩（僅深色/淺色兩套）
- Spec 內容 diff 比對（僅顯示哪些 change 影響了 spec，不比對內容差異）
- 拖放或觸控手勢操作

## Decisions

### D1: 響應式斷點策略

**選擇**：單一斷點 768px，使用 Tailwind `md:` prefix

- < 768px：sidebar 隱藏，header 顯示漢堡按鈕，點擊彈出 overlay sidebar
- ≥ 768px：sidebar 固定顯示（目前行為），可選收合為 icon-only 模式

**替代方案**：多斷點（sm/md/lg/xl）→ 過度工程，本應用內容結構單純，一個斷點足夠

**實作方式**：
- Layout.tsx 加入 `sidebarOpen` state，桌面預設 open，行動版預設 closed
- Sidebar 行動版為 fixed overlay + backdrop，桌面版為 fixed sidebar
- 使用 `window.matchMedia('(min-width: 768px)')` 監聽斷點變化
- Dashboard grid: `grid-cols-2 md:grid-cols-4`

### D2: 主題切換機制

**選擇**：`<html data-theme="dark|light">` + CSS custom properties 雙套定義

- `global.css` 定義兩套 `@theme` 變數（dark 為預設，light 在 `[data-theme="light"]` selector 下覆寫）
- ThemeContext 管理狀態，localStorage key `spek:theme`
- 初始化順序：localStorage → `prefers-color-scheme` → 預設 dark
- Header 右側加入主題切換按鈕（太陽/月亮 icon）

**替代方案**：
- Tailwind `dark:` class → 需要每個元件都寫兩套 class，改動量大
- CSS-only media query → 無法手動切換

**注意**：Tailwind CSS v4 的 `@theme` 是全域的，不支援 selector-scoped override。淺色主題需用普通 CSS 變數 override 搭配 `[data-theme="light"]` selector。

### D3: Spec 歷史 API

**選擇**：擴充現有 `GET /api/openspec/specs/:topic` 回傳，加入 `history` 欄位

- `history` 陣列包含每個 related change 的 `{ slug, date, description, status }` 資訊
- 不新增獨立 endpoint，因為 `readSpec()` 已呼叫 `findRelatedChanges()`，只需擴充回傳資料
- 前端 SpecDetail 新增「History」區塊，以時間線呈現

**替代方案**：新增 `/api/openspec/specs/:topic/history` 獨立 endpoint → 多一次 API call，且資料來源相同，不划算

### D4: 最近路徑驗證

**選擇**：SelectRepo 載入時，對每個最近路徑呼叫 detect API 進行非同步驗證

- 顯示三種狀態：檢查中（spinner）、有效（綠色）、無效（紅色 + 刪除按鈕）
- 驗證在背景進行，不阻擋 UI 互動
- 使用者可刪除無效路徑

**替代方案**：只在點擊時驗證 → 使用者看到的路徑可能已不存在，體驗不佳

## Risks / Trade-offs

- **Tailwind v4 @theme 限制** → CSS custom property override 不在 `@theme` 區塊內，而是用普通 CSS `[data-theme="light"]` selector。需確認所有元件使用 `bg-bg-primary` 等 semantic token 而非直接硬編碼色值。
  - 緩解：全域搜尋硬編碼色值，統一改用 CSS 變數
- **Sidebar overlay 觸控** → 行動版 sidebar overlay 需處理 backdrop 點擊關閉。
  - 緩解：使用 fixed backdrop div + onClick handler
- **路徑驗證延遲** → 多個路徑同時驗證可能造成短暫 loading 狀態。
  - 緩解：並行發送所有 detect 請求，各自獨立更新狀態
