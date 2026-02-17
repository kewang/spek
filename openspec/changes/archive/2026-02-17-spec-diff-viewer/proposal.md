## Why

spek 目前的 spec 頁面透過 history timeline 呈現 spec 的演進記錄，但使用者只能看到「哪些 change 影響了這個 spec」，卻無法比較不同版本之間的具體文字差異。加入 diff 檢視功能，讓使用者可以直觀看到每次變更新增、修改、刪除了哪些需求，將 spek 從「靜態檢視器」升級為「spec 演進追蹤工具」。

## What Changes

- 新增 core 函式 `readSpecAtChange`，讀取特定 change 中的 spec 歷史版本內容
- 新增 API endpoint `GET /api/openspec/specs/:topic/at/:slug`，回傳某個 change 對 spec 的 delta 內容
- 擴展 `ApiAdapter` 介面，增加 `getSpecAtChange` 方法（FetchAdapter、MessageAdapter、StaticAdapter 同步實作）
- 在 SpecDetail 頁面新增 diff 檢視 UI，使用者可選取兩個版本進行比較
- 引入前端 diff library，以 side-by-side 或 unified 模式渲染文字差異

## Capabilities

### New Capabilities
- `spec-diff`: Spec 版本差異比較功能——包含 core 層讀取歷史版本、API 層端點、前端 diff 檢視元件

### Modified Capabilities
- `spec-history`: 在現有 history timeline 上新增「比較」互動，讓使用者可從 timeline 觸發 diff 檢視
- `api-adapter`: 擴展 ApiAdapter 介面，新增 `getSpecAtChange` 方法

## Impact

- **Core**: `packages/core/src/scanner.ts` 新增 `readSpecAtChange` 函式，`types.ts` 新增回傳型別
- **Web Server**: `packages/web/server/routes/openspec.ts` 新增 route
- **Frontend**: `packages/web/src/api/` 下所有 adapter 新增方法，`SpecDetail.tsx` 新增 diff UI，新增 `SpecDiffViewer` 元件
- **VS Code Extension**: `packages/vscode/src/handler.ts` 新增 message handler
- **Dependencies**: 新增 diff 計算 library（如 `diff` npm package）
- **Demo**: `StaticAdapter` 與 `build-demo.ts` 需支援歷史版本資料內嵌
