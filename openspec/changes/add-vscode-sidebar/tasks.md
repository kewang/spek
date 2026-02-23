## 1. Activity Bar Icon & ViewContainer 註冊

- [x] 1.1 建立 24x24 單色 SVG icon 給 Activity Bar 使用（`packages/vscode/media/sidebar-icon.svg`）
- [x] 1.2 在 `packages/vscode/package.json` 新增 `viewsContainers.activitybar` 註冊 spek ViewContainer
- [x] 1.3 在 `packages/vscode/package.json` 新增 `views` 註冊 `spek.specsView` 和 `spek.changesView` 兩個 TreeView
- [x] 1.4 設定 `when` clause 讓 sidebar 只在 workspace 有 openspec/ 時顯示

## 2. TreeDataProvider 實作

- [x] 2.1 新增 `packages/vscode/src/tree-provider.ts`，實作 `SpecsTreeProvider` class（implements `TreeDataProvider`）
- [x] 2.2 實作 `ChangesTreeProvider` class，支援 active/archived 分組顯示
- [x] 2.3 兩個 provider 都使用 `@spek/core` 的 `scanOpenSpec()` 取得資料
- [x] 2.4 實作 `refresh()` 方法透過 `onDidChangeTreeData` event 觸發更新

## 3. Extension 整合

- [x] 3.1 修改 `extension.ts`，在 activate 時註冊兩個 TreeDataProvider
- [x] 3.2 連接現有 file watcher，在 openspec/ 檔案變更時呼叫 TreeProvider 的 `refresh()`
- [x] 3.3 在 `package.json` 新增 `spek.openDashboard` command 並註冊為 SPECS view 的 toolbar action

## 4. Webview 導航

- [x] 4.1 在 `panel.ts` 新增 `navigateTo(path)` 方法，透過 postMessage 發送 `{ type: 'navigate', path }` 給 webview
- [x] 4.2 在 React app 入口加入 `navigate` message listener，收到後呼叫 React Router 的 `navigate()`
- [x] 4.3 TreeView item 的 command 綁定：點擊 spec item 呼叫 `navigateTo('/specs/<topic>')`，點擊 change item 呼叫 `navigateTo('/changes/<slug>')`

## 5. 驗證與清理

- [x] 5.1 執行 `npm run type-check` 確認無型別錯誤
- [x] 5.2 執行 `npm run build:vscode` 確認 extension 可正常 build
- [ ] 5.3 手動測試：打開含 openspec/ 的 workspace，確認 sidebar icon 出現、TreeView 顯示正確、點擊可導航
