# spek 功能構想清單

> 產出日期：2026-02-17
> 基於 v0.3.1 現況分析

---

## 高價值功能

### 1. Spec Diff 比較檢視
透過 spec history timeline 已有 git 版本追蹤，可以進一步顯示兩個版本之間的差異——哪些段落被新增、修改、刪除。對於理解 spec 演進非常有用。

- 技術方向：git show 取得歷史版本，前端用 diff library 渲染
- 可讓 spek 從「檢視器」升級為「spec 演進追蹤工具」

### 2. Mermaid 圖表支援
在 markdown 中渲染 mermaid 圖表（架構圖、流程圖、序列圖）。OpenSpec 的 design doc 很適合搭配圖表。

- 技術方向：加 remark plugin 或在 MarkdownRenderer 中偵測 mermaid code block
- 投入產出比高，實作不複雜

### 3. Spec 關聯圖（Graph View）
把 specs 之間的引用關係、以及 changes 影響了哪些 specs，用互動式圖表呈現。類似 Obsidian 的 graph view。

- 技術方向：解析 capability ID 交叉引用，用 D3 或類似 library 繪製
- 可快速看出影響範圍與依賴關係

### 4. 書籤 / 釘選功能
讓使用者釘選常用的 specs 或 changes，存在 localStorage，方便快速存取。

- Dashboard 上可多一個「已釘選」區塊
- 投入產出比高，實作簡單但對使用體驗提升明顯

---

## 實用增強

### 5. 鍵盤快捷鍵面板
按 `?` 顯示所有可用快捷鍵。目前只有 `Cmd+K` 搜尋，可擴展：

- `j/k` 上下導覽清單
- `Enter` 進入詳情
- `Backspace` 返回
- 讓 power user 更高效

### 6. Spec 目錄導覽（Table of Contents）
長 spec 頁面自動產生 TOC 側欄或 sticky headers，點擊可跳轉到對應章節。

- 已在 P3 待辦清單中（ui-design-review-remaining.md）

### 7. 進階搜尋篩選
目前搜尋只分 All/Specs/Changes。可加入：

- 日期範圍篩選
- 只搜特定 section（proposal、design、tasks）
- 標記搜尋語法（如 `status:active`）

### 8. 匯出 / 列印
將 spec 或整個 change 匯出成 PDF 或列印友善格式。

- 適合分享給不使用 spek 的團隊成員
- 技術方向：print CSS media query 或 html-to-pdf

---

## 輕量但有感的改進

### 9. Skeleton Loading
用骨架屏取代 "Loading..." 文字，提升感知速度。

- 已在 P3 待辦清單中（ui-design-review-remaining.md）

### 10. Change 時間軸視覺化
在 Changes 頁面用時間軸（timeline）呈現 changes 的建立與封存時間。

- 直覺看出專案開發節奏

### 11. 多 Repo 切換
Web 版目前一次只看一個 repo，可支援「最近開啟的 repos」快速切換。

- 類似 IDE 的 recent projects
- 目前 SelectRepo 已有 recent paths，可進一步強化為全域切換

### 12. PWA 離線支援
加 service worker 讓 web 版可離線使用上次載入的資料。

- 適合在沒有網路的環境快速查閱

---

## 優先推薦

| 功能 | 投入 | 影響 | 建議 |
|------|------|------|------|
| Mermaid 圖表 | 低 | 中 | 優先做 |
| 書籤功能 | 低 | 中 | 優先做 |
| Spec Diff | 中高 | 高 | 最有深度的升級 |
| 鍵盤快捷鍵 | 低 | 低中 | 提升 power user 體驗 |
| Skeleton Loading | 低 | 低中 | P3 已規劃 |
| TOC 導覽 | 中 | 中 | P3 已規劃 |
