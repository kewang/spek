## Context

`ChangeInfo` 的 `date` 欄位來自 slug 解析（`YYYY-MM-DD`），只有日期沒有時間。`git-timestamp-cache` 模組已能取得每個 change 的 git commit timestamp（ISO 8601），但只用在 `readSpec()` 的 history timeline，未用在 `scanOpenSpec()` 回傳的 changes 列表。

目前 `scanOpenSpec()` 是同步函式，而 `getTimestamps()` 是 async（需要執行 git 指令）。

## Goals / Non-Goals

**Goals:**
- `ChangeInfo` 包含精確的 git timestamp
- Changes 排序用 timestamp 取代純日期
- Dashboard 和 ChangeList UI 顯示含時間的日期

**Non-Goals:**
- 不改變 `buildChangeTimestamps` 的行為（仍取最早 commit）
- 不改變 SpecDetail history 的現有邏輯
- 不改變 slug 命名規則

## Decisions

### 1. `scanOpenSpec` 改為 async

**決定**：將 `scanOpenSpec()` 改為 `async function`，內部呼叫 `getTimestamps()` 後將 timestamp 填入每個 `ChangeInfo`。

**替代方案**：在 API 層做 enrichment（scan 後再另外呼叫 getTimestamps 補資料）。但這樣每個 caller（web routes、VS Code handler）都要重複同樣的 enrichment 邏輯，不如直接在 scanner 層處理。

**影響**：所有呼叫 `scanOpenSpec` 的地方需要加 `await`，包括 web server routes 和 VS Code handler。

### 2. 排序邏輯

**決定**：排序優先用 `timestamp`，無 timestamp 時 fallback 回 `date`，與 `readSpec()` 中 history 的排序邏輯一致。

### 3. UI 日期格式

**決定**：使用 relative time 格式（如「3 hours ago」「2 days ago」），hover 時 title 顯示完整 ISO timestamp。無 timestamp 時 fallback 顯示原始 `YYYY-MM-DD`。

**理由**：relative time 在「Recently Archived」語境下比絕對時間更直覺。格式化邏輯寫成共用的 `formatRelativeTime()` utility。

## Risks / Trade-offs

- **效能**：`getTimestamps()` 有 in-memory cache，首次呼叫需要執行 git log，後續直接從 cache 取。對大型 repo 首次載入可能多幾百 ms，但 cache 機制已足夠。→ 可接受
- **非 git 環境**：非 git repo 時 `getTimestamps()` 回傳空 Map，所有 timestamp 為 null，fallback 回原本的 date 顯示。→ 無退化
