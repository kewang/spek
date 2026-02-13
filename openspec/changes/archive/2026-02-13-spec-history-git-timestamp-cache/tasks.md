## 1. Git Timestamp Cache 模組

- [x] 1.1 建立 `server/lib/git-cache.ts`，實作 `buildChangeTimestamps(repoDir)` 函式：執行 `git log --format="COMMIT %aI" --name-only -- openspec/changes/` 並解析輸出為 `Map<slug, isoTimestamp>`
- [x] 1.2 實作 in-memory cache (`Map<repoDir, Map<slug, timestamp>>`)，含 `getTimestamps(repoDir)` (lazy build) 和 `resyncTimestamps(repoDir)` (清除並重建)
- [x] 1.3 處理非 git repo 的 fallback：git 指令失敗時回傳空 Map

## 2. 後端整合

- [x] 2.1 修改 `server/lib/scanner.ts` 的 `readSpec()`：HistoryEntry 新增 `timestamp` 欄位，排序改用 timestamp 降序（無 timestamp 時 fallback 回 date）
- [x] 2.2 在 `server/routes/openspec.ts` 新增 `POST /api/openspec/resync` endpoint，呼叫 `resyncTimestamps()`

## 3. 前端整合

- [x] 3.1 修改 `src/hooks/useOpenSpec.ts`：SpecHistoryEntry 新增 `timestamp` 欄位，新增 `useResync()` hook
- [x] 3.2 在 sidebar（`src/components/Layout.tsx` 或相關元件）加入 resync 按鈕，含 loading 狀態，未選 repo 時隱藏/disabled
- [x] 3.3 修改 `src/pages/SpecDetail.tsx`：history timeline 可顯示精確時間（當 timestamp 存在時）
