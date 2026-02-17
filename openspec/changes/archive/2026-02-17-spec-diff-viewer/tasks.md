## 1. Dependencies

- [x] 1.1 安裝 `diff` npm package 至 `@spek/web` workspace

## 2. Core 層

- [x] 2.1 在 `packages/core/src/scanner.ts` 新增 `readSpecAtChange(repoDir, topic, slug)` 函式，從 active 或 archive change 目錄讀取 delta spec 內容
- [x] 2.2 在 `packages/core/src/types.ts` 新增 `SpecVersionContent` 型別（`{ content: string }`）
- [x] 2.3 在 `packages/core/src/index.ts` export 新增的函式與型別

## 3. API 層（Web Server）

- [x] 3.1 在 `packages/web/server/routes/openspec.ts` 新增 `GET /api/openspec/specs/:topic/at/:slug` route

## 4. API Adapter 層

- [x] 4.1 在 `packages/web/src/api/types.ts` 的 `ApiAdapter` 介面新增 `getSpecAtChange(topic: string, slug: string)` 方法
- [x] 4.2 在 `FetchAdapter` 實作 `getSpecAtChange`
- [x] 4.3 在 `MessageAdapter` 實作 `getSpecAtChange`
- [x] 4.4 在 `StaticAdapter` 實作 `getSpecAtChange`，擴展 `DemoData` 型別

## 5. VS Code Extension

- [x] 5.1 在 `packages/vscode/src/handler.ts` 的 `MessageHandler` 新增 `getSpecAtChange` case

## 6. Frontend 元件

- [x] 6.1 建立 `SpecDiffViewer` 元件，使用 `diffLines` 渲染 unified diff
- [x] 6.2 在 `useOpenSpec.ts` 新增 `useSpecAtChange(topic, slug)` hook
- [x] 6.3 修改 `SpecDetail.tsx`，在 history timeline entry 新增「Compare」按鈕
- [x] 6.4 在 `SpecDetail.tsx` 加入 diff 模式狀態管理（選取版本、顯示 diff、退出 diff 模式）

## 7. Demo 支援

- [x] 7.1 修改 `scripts/build-demo.ts`，將 spec 歷史版本內容嵌入 `specVersions` 欄位

## 8. Build 驗證

- [x] 8.1 執行 `npm run build` 確認 core + web build 成功
- [x] 8.2 執行 `npm run build:demo` 確認 demo build 成功
- [x] 8.3 執行 `npm run type-check` 確認型別檢查通過
