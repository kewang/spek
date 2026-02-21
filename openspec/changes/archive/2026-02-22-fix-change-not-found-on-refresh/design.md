## Context

`useAsyncData` hook 負責所有 API 資料的 fetch 與 refresh。當 file watcher 觸發 `refreshKey` 變更時，hook 會重新 fetch 資料。目前的 catch handler 在 refresh 失敗時保留舊 data 但同時設定 error，而所有頁面元件都先檢查 `error` 再檢查 `data`，導致即使有有效資料仍顯示錯誤。

此外，`FetchAdapter.fetchJson` 在 HTTP 錯誤時只丟出 `HTTP <status>`，未解析 server 回傳的錯誤訊息。

## Goals / Non-Goals

**Goals:**
- Refresh re-fetch 失敗時，若有既存 data 則靜默保留，不顯示錯誤
- Web 版的 API 錯誤訊息應包含 server 回傳的描述性訊息

**Non-Goals:**
- 不改動 `readChange()` 核心邏輯（已正確處理 active/archive 雙路徑查找）
- 不改動 file watcher 機制或 debounce 時間
- 不新增 retry 機制

## Decisions

### Decision 1: 在 useAsyncData catch handler 中條件性設定 error

**選擇**：當 `refreshTriggered && prev.data` 為 true 時，將 error 設為 null

**替代方案**：在每個頁面元件中改為 `if (error && !data)` — 需修改多個檔案，且容易遺漏

**理由**：源頭修正，一處改動解決所有頁面的問題。當 refresh 失敗但有既存資料時，使用者看到稍微過時的資料遠比看到錯誤訊息好。若資料真的被刪除，使用者重新導航（非 refresh 觸發）時會正確顯示錯誤。

### Decision 2: FetchAdapter 解析 error response body

**選擇**：在 `fetchJson` 中，HTTP 錯誤時嘗試解析 JSON body 的 `error` 欄位

**理由**：Server 回傳的錯誤如 `{ error: "Change not found" }` 比 `HTTP 404` 更具可讀性，與 VS Code MessageAdapter 的行為一致。

## Risks / Trade-offs

- [refresh 失敗被靜默] → 使用者可能短暫看到過時資料，但下次成功 refresh 或重新導航會更新。可接受的 trade-off，因為 refresh 是自動觸發而非使用者主動請求。
- [error body 解析失敗] → fallback 到原本的 `HTTP <status>` 訊息，無功能損失。
