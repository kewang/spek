## Context

spek 的 spec detail 頁面已有 history timeline，顯示哪些 change 影響了該 spec。歷史版本的 spec 內容實際上已存在於 `openspec/changes/<slug>/specs/<topic>/spec.md`（active 或 archive 目錄下），但目前沒有 API 或 UI 來讀取與比較這些歷史內容。

現有的 `readSpec` 函式回傳當前 spec 內容與 `HistoryEntry[]`，每個 entry 有 slug、date、timestamp、description、status，但不包含歷史版本的實際文字內容。

## Goals / Non-Goals

**Goals:**
- 讓使用者能在 spec detail 頁面比較任意兩個版本的 spec 差異
- 支援 unified diff 檢視模式
- 在所有三種環境（Web、VS Code Webview、Demo）中可用
- 保持架構一致性——遵循既有的 ApiAdapter pattern

**Non-Goals:**
- 不做 inline editing（spek 是唯讀檢視器）
- 不做 side-by-side 模式（未來可擴展，目前先做 unified）
- 不做 word-level diff（以行為單位即可）
- 不做跨 spec 的比較
- 不做 git blame 或 git log 直接整合（依賴 OpenSpec 目錄結構而非 git history）

## Decisions

### 1. 歷史版本讀取方式：從 change 目錄讀取

**選擇**：新增 core 函式 `readSpecAtChange(repoDir, topic, slug)` 直接讀取 `openspec/changes/<slug>/specs/<topic>/spec.md` 或 `openspec/changes/archive/<slug>/specs/<topic>/spec.md`。

**替代方案**：用 `git show <commit>:<path>` 從 git history 讀取。

**理由**：OpenSpec 的設計已將歷史版本存在 change 目錄結構中，不需要額外依賴 git CLI。這讓非 git repo（或尚未 commit 的 change）也能運作。

### 2. Diff 計算位置：前端計算

**選擇**：前端使用 `diff` npm package 計算行級差異。

**替代方案**：後端計算 diff 回傳結構化 diff 結果。

**理由**：
- Spec 文件通常不大（數百行以內），前端計算效能不是問題
- 減少 API 複雜度——後端只需提供原始內容
- `diff` 套件體積小（~10KB gzipped），適合前端引入
- 不同環境（Web/Webview/Demo）都能統一處理

### 3. Diff Library 選擇：`diff` (npm)

**選擇**：使用 `diff` npm package（https://github.com/kpdecker/jsdiff）

**理由**：
- 成熟穩定，GitHub 5k+ stars
- 提供 `diffLines` 等 API，回傳結構化 diff result
- 純 JavaScript，無 native dependency
- 體積小，適合 browser 和 webview 環境

### 4. UI 整合方式：在 SpecDetail 頁面內 inline 顯示

**選擇**：在 spec detail 頁面的 history timeline 區塊增加版本選取 UI，選取後在頁面內顯示 diff 結果，取代原本的 spec content 區域。

**替代方案**：用 modal/dialog 顯示 diff，或開新路由頁面。

**理由**：
- 保持上下文——使用者在看 spec 時可以即時比較
- 不需要額外的路由或 modal 複雜度
- 使用者可以隨時切回原始 content 檢視

### 5. 版本比較基準：current vs. change version

**選擇**：預設比較「目前 spec 內容」與「某個 change 版本」。也支援兩個 change 版本之間的比較。

**理由**：最常見的用例是「這個 change 改了什麼」，比較 current 與 change version 最直覺。

### 6. API 設計：新增 `getSpecAtChange` 方法

新增 endpoint `GET /api/openspec/specs/:topic/at/:slug?dir=...`，回傳 `{ content: string }`。

`ApiAdapter` 介面新增：
```typescript
getSpecAtChange(topic: string, slug: string): Promise<{ content: string }>
```

## Risks / Trade-offs

- **[Risk] Demo 資料膨脹**：StaticAdapter 需要內嵌所有 spec 的歷史版本 → 只嵌入有 delta spec 的版本，資料量可控
- **[Risk] 大量 history entries 時效能**：每次 diff 都需要 API call 取得歷史版本 → spec 文件通常小，可接受。未來如需優化可加 cache
- **[Trade-off] 只做 unified diff**：犧牲 side-by-side 的直覺性 → 減少初版複雜度，unified 在窄螢幕也能用

## Open Questions

- 無（初版範圍已明確）
