## Context

目前 spec history 排序僅依賴 change slug 中的日期字串（`YYYY-MM-DD`），同一天有多個 changes 時順序不確定。需要引入 git commit 時間戳作為精確排序來源，同時避免每次 API 請求都執行 git 指令。

現有流程：`readSpec()` → `findRelatedChanges()` → `parseSlug()` 取日期 → `localeCompare` 排序。

## Goals / Non-Goals

**Goals:**
- 用 git commit 時間戳精確排序同一天內的 history entries
- 透過 in-memory cache 將 git 操作降為一次性成本
- 提供手動 resync 機制讓使用者在 repo 推進後更新快取
- 無 git 資訊時 graceful fallback 回原有的 slug 日期排序

**Non-Goals:**
- 不做 file watcher 自動偵測 repo 變更
- 不持久化 cache 到磁碟（server 重啟重建即可）
- 不追蹤 git 以外的時間來源

## Decisions

### 1. Git 時間戳取「change 目錄最早 commit 時間」

取最早 commit 代表 change 的建立時間，符合 history 的時序語意（「這個 change 是什麼時候開始的」）。

替代方案：取最晚 commit（最後更新時間）— 但這會讓頻繁修改的舊 change 排到前面，不符合時間線直覺。

### 2. 單一 `git log` 指令批次取得所有 change 時間

執行一次 `git log --format="COMMIT %aI" --name-only -- openspec/changes/`，解析輸出取得每個 slug 對應的最早 commit 時間。

git log 預設最新在前輸出，對同一個 slug 持續覆寫，最後留下的即為最早 commit。

替代方案：每個 slug 各跑一次 `git log --reverse` — 變更數量多時 N 次 fork 效能差。

### 3. In-memory Map 快取，以 repo 路徑為 key

結構：`Map<repoDir, Map<slug, isoTimestamp>>`

spek 是本地開發工具，記憶體用量極低，無需磁碟持久化。Server 重啟時 cache 清空，下次請求 lazy rebuild。

### 4. Lazy build + 手動 resync 雙軌機制

- **Lazy build**：第一次對某 repo 發 API 請求且 cache 不存在時自動建立
- **手動 resync**：`POST /api/openspec/resync?dir=...` 清除該 repo 的 cache 並立即重建

### 5. Resync 按鈕放在 sidebar 底部

使用者隨時可觸發，不限特定頁面。按鈕帶 loading 狀態回饋。

替代方案：放 header — 但 header 空間已用於標題和主題切換，sidebar 底部更適合作為工具類操作。

## Risks / Trade-offs

- **非 git repo 的情況** → 若 `git log` 失敗（目錄非 git repo），cache 回傳空 Map，排序 fallback 回 slug 日期。不影響功能。
- **大型 repo git log 較慢** → 限定 `-- openspec/changes/` 路徑過濾，大幅縮小掃描範圍。一般 OpenSpec 的 commit 數量不會太大。
- **Cache 過期使用者不察覺** → 透過 UI resync 按鈕讓使用者主動控制，不做自動失效避免複雜度。
