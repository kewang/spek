## 1. Web Server

- [x] 1.1 修正 `packages/web/server/routes/filesystem.ts` 的 detect route：先檢查 config.yaml，不存在時 fallback 檢查 specs/ 或 changes/ 目錄

## 2. VS Code Handler

- [x] 2.1 修正 `packages/vscode/src/handler.ts` 的 detect method：同上 fallback 邏輯

## 3. Verify

- [x] 3.1 執行 `npm run type-check` 確認無型別錯誤
- [x] 3.2 執行 `npm run build` 確認 build 成功
- [x] 3.3 用瀏覽器測試：輸入缺少 config.yaml 的 repo 路徑（/home/kewang/git/ha-claude-assistant），確認能偵測到並進入 dashboard
