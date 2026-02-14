## Why

spek 目前缺乏一個可以快速展示產品功能的方式。潛在使用者需要先安裝、設定並啟動服務才能看到效果。一個獨立的靜態 HTML demo 頁面，內嵌 spek 自身的 openspec/ 資料，讓任何人開啟瀏覽器就能直觀體驗 OpenSpec 內容檢視的效果。

## What Changes

- 新增一個 build script，將 spek 的 `openspec/` 目錄掃描結果序列化為 JSON，嵌入到一個自包含的靜態 HTML 檔案中
- HTML 使用內嵌 CSS + JS，不依賴外部資源，單檔可直接用瀏覽器開啟
- 展示 spek 的核心瀏覽體驗：specs 列表、spec 內容（含 BDD 語法高亮）、changes 列表、change 詳情（含 tasks 進度）
- 視覺風格沿用 spek 深色主題（#0a0c0f 背景 + 琥珀色 accent）

## Capabilities

### New Capabilities
- `demo-page`: 獨立靜態 HTML demo 頁面，內嵌 openspec 資料，展示 spek 的核心瀏覽功能

### Modified Capabilities
（無）

## Impact

- 新增 build script（`scripts/build-demo.ts` 或類似）用於產生 demo HTML
- 新增 `demo/` 或 `docs/` 目錄存放產出的 HTML
- 新增 npm script（如 `npm run build:demo`）
- 不影響現有 web 版或 VS Code extension 功能
- 可搭配 GitHub Pages 部署
