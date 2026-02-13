## Context

Dashboard 的 task completion 永遠 0%，根因是 `server/routes/openspec.ts` 第 24 行 overview endpoint 只遍歷 `scan.activeChanges`，但目前所有 changes 皆已 archived。另外，Change detail 的 Proposal tab 中 Capabilities 區塊的 capability ID 以反引號包裹但僅渲染為靜態 `<code>`，無法導航至對應的 spec 頁面。

## Goals / Non-Goals

**Goals:**

- Overview endpoint 的 taskStats 統計所有 changes（active + archived）的任務完成度
- Proposal markdown 中以反引號包裹的 capability ID（如 `` `responsive-layout` ``）在列表項中渲染為可點擊的連結，導航至 `/specs/:topic`

**Non-Goals:**

- 不改變 `/api/openspec/changes` 或 `/api/openspec/changes/:slug` 的回傳格式
- 不新增 capability 專屬的 API endpoint
- 不對所有 inline code 都做連結，僅處理 Capabilities 區塊下的列表項

## Decisions

### 1. Overview taskStats 聚合 active + archived

在 `server/routes/openspec.ts` 的 overview handler 中，將遍歷對象從 `scan.activeChanges` 改為 `[...scan.activeChanges, ...scan.archivedChanges]`。

**理由**: 最小改動，一行修正，且語義正確——Dashboard 應反映整個 repo 的任務進度。

### 2. MarkdownRenderer inline code 連結化

在 `src/components/MarkdownRenderer.tsx` 的 `code` component（inline code 分支）中，檢查 code 內容是否為 kebab-case 格式且對應到已知 spec topic。若符合，渲染為 React Router `<Link>` 導航至 `/specs/:topic`。

需要的資訊：spec topics 清單。方案是讓 MarkdownRenderer 接受可選的 `specTopics?: string[]` prop，由 ChangeDetail 頁面傳入（從 `/api/openspec/specs` 取得）。

**理由**:
- 將連結邏輯放在 MarkdownRenderer 而非 ChangeDetail，因為 markdown 內容結構由 renderer 控制
- 使用 prop 傳入 spec topics 而非在 renderer 中呼叫 API，保持元件純粹
- 僅在 specTopics 有傳入且內容匹配時才連結化，避免誤連不存在的 spec

## Risks / Trade-offs

- **[風險] inline code 誤判**: 有些 inline code 可能恰好符合 kebab-case 格式但不是 capability ID → 以 specTopics 白名單比對來避免，只有確實存在的 spec 才會連結化
- **[風險] spec 清單多一次 API 呼叫**: ChangeDetail 頁面需額外 fetch spec 清單 → 此呼叫已在 useOpenSpec hook 中存在（`useSpecs`），可直接複用
