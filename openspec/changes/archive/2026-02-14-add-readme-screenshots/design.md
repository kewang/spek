## Context

README.md 與 README.zh-TW.md 目前僅有文字描述，缺乏產品截圖。需要截取應用程式各主要頁面的畫面，並嵌入 README 中，讓使用者在 GitHub 上就能預覽 spek 的介面。

## Goals / Non-Goals

**Goals:**
- 截取 6 張深色主題截圖，涵蓋所有主要頁面
- 在兩個 README 中新增截圖區塊，位於 Features 與 Quick Start 之間
- 截圖使用合理的 viewport 尺寸（1280x800）

**Non-Goals:**
- 不截取淺色主題的截圖
- 不建立自動化截圖流程
- 不修改任何程式碼

## Decisions

1. **截圖存放位置**：使用 `screenshots/` 目錄於專案根目錄，以相對路徑引用。GitHub README 可直接渲染相對路徑的圖片。
2. **深色主題為主**：spek 預設為深色主題，截圖使用深色主題更能代表產品的視覺風格。
3. **截圖內容**：涵蓋 6 個關鍵頁面 — Dashboard、Specs 列表、Spec 詳細（含 BDD 高亮）、Changes 列表、Change 詳細（含分頁）、搜尋功能。
4. **README 插入位置**：放在 Features 與 Quick Start 之間，讓使用者先了解功能，再看到實際畫面，接著是如何開始使用。

## Risks / Trade-offs

- [截圖過時] → 當 UI 有重大變更時需手動重新截圖。目前不建立自動化，因為 UI 變更頻率低。
- [圖片大小] → 6 張 PNG 總計約 900KB，對 git repo 影響可接受。
