## Context

spek 是一個全新專案，目前只有 PRD（`docs/prd.md`）和 OpenSpec 工作流程文件。此 Phase 1 需要從零建立專案骨架，包含前端建置工具、後端 API server、以及核心的 OpenSpec 資料解析邏輯。

PRD 已定義完整的技術選型與 API 設計，本設計文件聚焦在實作層面的決策。

## Goals / Non-Goals

**Goals:**
- 建立可運行的 Vite + React + Express 開發環境
- 實作完整的後端 API endpoints，能正確讀取任意 repo 的 OpenSpec 內容
- 前後端能透過 proxy 正常串接
- `npm run dev` 一鍵啟動

**Non-Goals:**
- UI 頁面的完整實作（Phase 2）
- Markdown 渲染與 BDD 語法高亮（Phase 3）
- 搜尋 UI（Phase 3）；本階段只做搜尋 API
- 響應式佈局、主題切換（Phase 4）

## Decisions

### D1: Express 使用 tsx 執行，不預先編譯

**選擇**：開發時用 `tsx watch server/index.ts` 直接執行 TypeScript
**替代方案**：tsc 編譯後執行 JS、ts-node
**理由**：tsx 基於 esbuild，啟動快、支援 watch mode、不需額外 tsconfig 設定。ts-node 較慢且 ESM 設定複雜。

### D2: 前後端各自 tsconfig

**選擇**：`tsconfig.json`（前端，Vite 用）+ `tsconfig.server.json`（後端）
**理由**：前端需要 JSX、DOM types；後端需要 Node types、不同 module 設定。共用 tsconfig 會造成型別衝突。

### D3: 安全性 — 路徑限制

**選擇**：所有 openspec routes 限制只讀取 `{dir}/openspec/` 下的 `.md` 和 `.yaml` 檔案，filesystem routes 只回傳目錄列表
**理由**：雖然是本地工具，但仍應避免意外暴露敏感檔案。path traversal 攻擊（`../../etc/passwd`）必須防範。

### D4: Scanner 使用同步檔案讀取

**選擇**：scanner 和 tasks parser 使用 `fs.readFileSync` / `fs.readdirSync`
**替代方案**：async fs API
**理由**：OpenSpec 目錄通常很小（數十個檔案），同步讀取程式碼更簡潔。API response 時間不會有感知差異。若未來效能成為問題再改為 async。

### D5: 搜尋用 server-side 遍歷 + Fuse.js 排序

**選擇**：搜尋 API 在 server 端讀取所有 `.md` 內容，用 Fuse.js 做模糊匹配與排序
**替代方案**：純 client-side 搜尋（需先載入所有內容）、SQLite FTS
**理由**：Server-side 讀檔避免一次傳輸大量內容到前端。Fuse.js 輕量且支援模糊搜尋，足以應付 OpenSpec 規模的內容量。

## Risks / Trade-offs

- **同步 I/O 阻塞**：scanner 使用同步讀取，若 repo 極大（數百個 specs）可能短暫阻塞 → 目前 OpenSpec 規模不大，可接受；未來可改 async
- **無快取機制**：每次 API 呼叫重新讀取檔案系統 → 本地 SSD 讀取延遲極低，Phase 1 不需要快取
- **path traversal 風險**：使用者可傳入惡意路徑 → 所有路徑需經過 `path.resolve` + 檢查是否在允許範圍內
