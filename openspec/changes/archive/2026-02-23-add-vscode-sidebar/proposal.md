## Why

VS Code Marketplace 的兩位使用者（5 星評論）都反映希望能從 Activity Bar 直接開啟 spek，目前只能透過 Command Palette 或 status bar item 開啟，不夠直覺。新增 Activity Bar sidebar icon 可以讓 spek 更容易被發現和使用。

## What Changes

- 在 VS Code Activity Bar 新增 spek icon（使用 SVG）
- 新增 sidebar ViewContainer + TreeView，顯示 OpenSpec 結構（Specs、Changes）
- 點擊 TreeView item 可直接開啟 spek webview panel 並導航到對應內容
- 保留現有的 Command Palette 和 status bar 進入方式不變

## Capabilities

### New Capabilities
- `vscode-sidebar`: VS Code Activity Bar sidebar，提供 TreeView 瀏覽 OpenSpec 結構（specs 列表、changes 列表），點擊 item 開啟 webview panel 並導航至對應頁面

### Modified Capabilities
- `vscode-extension-host`: 新增 ViewContainer/TreeView 註冊、TreeDataProvider 實作，activation events 不變

## Impact

- `packages/vscode/package.json` — 新增 `viewsContainers`、`views`、`menus` contributes
- `packages/vscode/src/` — 新增 TreeDataProvider 檔案，修改 extension.ts 註冊 TreeView
- `packages/vscode/src/panel.ts` — 新增從 host 端導航 webview 到指定路由的 message
- `@spek/core` — 無需修改，TreeDataProvider 直接呼叫現有 scanner API
- Extension icon — 需要新增 Activity Bar 用的 SVG icon
