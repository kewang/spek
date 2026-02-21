## 1. Fix useAsyncData refresh error handling

- [x] 1.1 修改 `packages/web/src/hooks/useOpenSpec.ts` 的 `useAsyncData` catch handler：當 `refreshTriggered && prev.data` 為 true 時，設 error 為 null

## 2. Improve FetchAdapter error messages

- [x] 2.1 修改 `packages/web/src/api/FetchAdapter.ts` 的 `fetchJson`：HTTP 錯誤時解析 response body 的 `error` 欄位，fallback 到 `HTTP <status>`

## 3. Verification

- [x] 3.1 執行 `npm run type-check` 確認無 TypeScript 錯誤
- [x] 3.2 執行 `npm run build` 確認建置成功
