## 1. activationEvents 擴充

- [x] 1.1 在 `packages/vscode/package.json` 的 `activationEvents` 加入 `onStartupFinished` 作為 fallback

## 2. hasOpenSpecDir fallback 邏輯

- [x] 2.1 修改 `packages/vscode/src/extension.ts` 的 `hasOpenSpecDir()` 函式，先檢查 `config.yaml`，不存在時 fallback 檢查 `openspec/specs` 或 `openspec/changes` 目錄是否存在

## 3. Build 驗證

- [x] 3.1 執行 `npm run build -w spek-vscode` 確認編譯成功
- [x] 3.2 執行 `npm run type-check` 確認無型別錯誤
