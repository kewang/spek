## Why

目前 spec history 的排序只依賴 change slug 中的日期字串（精度到天），同一天內的多個 changes 無法區分先後順序。需要引入 git commit 時間戳作為精確排序依據，並透過 in-memory cache 機制避免每次 API 請求都執行 git 指令。同時，因為 repo 會持續推進，使用者需要手動 resync 的能力來更新快取。

## What Changes

- 新增 git timestamp cache 模組：啟動時或首次請求時執行單一 `git log` 指令，解析每個 change 目錄的最早 commit 時間，建立 in-memory Map 快取
- 修改 spec history 排序邏輯：從純日期字串排序改為使用 git commit timestamp 排序，無 timestamp 時 fallback 回 slug 日期
- 新增 resync API endpoint：`POST /api/openspec/resync`，強制重建指定 repo 的 timestamp cache
- 新增 UI resync 按鈕：在畫面上提供手動重新同步的操作，讓使用者在 repo 推進後能更新快取
- 擴充 HistoryEntry 資料結構：新增 `timestamp` 欄位（ISO 8601 格式）

## Capabilities

### New Capabilities
- `git-timestamp-cache`: Git commit 時間戳快取模組，負責解析 git log、建立 in-memory cache、提供 resync 機制

### Modified Capabilities
- `spec-history`: history 排序改用 git commit timestamp，HistoryEntry 新增 timestamp 欄位
- `openspec-api`: 新增 `POST /api/openspec/resync` endpoint

## Impact

- **後端新增檔案**：`server/lib/git-cache.ts`
- **後端修改**：`server/lib/scanner.ts`（readSpec 排序邏輯）、`server/routes/openspec.ts`（新增 resync route）
- **前端修改**：`src/hooks/useOpenSpec.ts`（resync hook）、`src/components/Layout.tsx` 或相關元件（resync 按鈕）、`src/pages/SpecDetail.tsx`（可選：顯示精確時間）
- **新增依賴**：無，使用 Node.js 內建 `child_process` 執行 git
- **效能考量**：git log 只在 cache miss 或手動 resync 時執行一次，日常 API 請求零 git 開銷
