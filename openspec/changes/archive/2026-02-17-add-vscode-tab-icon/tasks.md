## 1. Implementation

- [x] 1.1 在 `packages/vscode/src/panel.ts` 的 `createWebviewPanel` 後加上 `this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "webview", "favicon.svg")`

## 2. Verification

- [x] 2.1 Build extension 並確認 tab icon 正確顯示
