## 1. Core Type & Scanner

- [x] 1.1 在 `types.ts` 的 `ChangeInfo` 加入 `timestamp: string | null` 欄位
- [x] 1.2 將 `scanner.ts` 的 `scanOpenSpec()` 改為 async，內部呼叫 `getTimestamps()` 填入每個 ChangeInfo 的 timestamp
- [x] 1.3 更新排序邏輯：優先用 timestamp 降序排列，fallback 回 slug date

## 2. API Layer

- [x] 2.1 更新 `packages/web/server/routes/openspec.ts` 的 `/overview` 和 `/changes` routes 為 async，配合 `await scanOpenSpec()`
- [x] 2.2 更新 `packages/vscode/src/handler.ts` 的 `getOverview()`、`getSpecs()`、`getChanges()` 為 async，配合 `await scanOpenSpec()`

## 3. Frontend UI

- [x] 3.1 建立 `formatRelativeTime(isoString)` utility 函式（回傳如 "3 hours ago"、"2 days ago"）
- [x] 3.2 更新 `Dashboard.tsx` 的 Recently Archived 區塊：有 timestamp 時顯示 relative time（title 顯示完整時間），無 timestamp 時 fallback 顯示 date
- [x] 3.3 更新 `ChangeList.tsx` 的 active 和 archived 區塊：同上格式

## 4. Build & Verify

- [x] 4.1 執行 `npm run type-check` 確認無型別錯誤
- [x] 4.2 執行 `npm run build` 確認 build 成功
