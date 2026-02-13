## 1. Fix overview taskStats aggregation

- [x] 1.1 修改 `server/routes/openspec.ts` overview endpoint，將 taskStats 遍歷對象從 `scan.activeChanges` 改為 `[...scan.activeChanges, ...scan.archivedChanges]`
- [x] 1.2 更新 `openspec/specs/openspec-api/spec.md` 的 overview scenario 描述，反映新的聚合邏輯

## 2. Add capability ID linking in MarkdownRenderer

- [x] 2.1 在 `src/components/MarkdownRenderer.tsx` 的 props 新增可選的 `specTopics?: string[]`
- [x] 2.2 修改 inline `code` component，當 specTopics 包含該 code 文字時渲染為 React Router `<Link>` 至 `/specs/:topic`
- [x] 2.3 在 `src/pages/ChangeDetail.tsx` 中取得 spec topics 清單並傳入 MarkdownRenderer

## 3. Verification

- [x] 3.1 啟動 dev server，確認 Dashboard task completion 顯示正確百分比
- [x] 3.2 確認 Change detail Proposal tab 中的 capability ID 可點擊導航至對應 spec 頁面
