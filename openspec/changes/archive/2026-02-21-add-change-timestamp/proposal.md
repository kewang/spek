## Why

`ChangeInfo` 目前的 `date` 欄位只有從 slug 解析的 `YYYY-MM-DD`，沒有時間資訊。同一天建立的多個 changes 排序不精確，Dashboard 的「Recently Archived」和 Changes 列表只顯示日期，無法區分先後。`git-timestamp-cache` 已經能取得精確的 git commit timestamp，但目前只用在 spec history，沒有用在 changes 列表。

## What Changes

- `ChangeInfo` type 新增 `timestamp: string | null` 欄位
- `scanOpenSpec()` 改為 async，掃描時透過 `getTimestamps()` 填入每個 change 的 git timestamp
- Changes 排序邏輯改為優先用 timestamp，fallback 回 slug date
- Dashboard「Recently Archived」和 ChangeList 顯示格式化的日期時間（而非只有 YYYY-MM-DD）
- Web server routes 和 VS Code handler 配合 async 調整

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `openspec-scanner`: `scanOpenSpec` 改為 async，`ChangeInfo` 增加 `timestamp` 欄位，排序使用 timestamp
- `dashboard-view`: Recently Archived 區塊顯示精確的日期時間
- `change-browsing`: Change 列表顯示精確的日期時間

## Impact

- `@spek/core`: `types.ts`（ChangeInfo 加欄位）、`scanner.ts`（async + timestamp enrichment）
- `@spek/web`: `server/routes/openspec.ts`（routes 改 async）、`Dashboard.tsx`、`ChangeList.tsx`（日期顯示）
- `spek-vscode`: `handler.ts`（getChanges/getOverview 配合 async）
- Demo: `StaticAdapter` 不受影響（靜態資料無 git）
