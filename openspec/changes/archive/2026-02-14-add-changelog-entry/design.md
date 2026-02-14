## Context

VS Code extension 目前版本為 `0.1.0`，CHANGELOG 只記錄初始發佈。自 0.1.0 之後新增了 sidebar collapse/expand toggle 功能，需要記錄到 CHANGELOG 並 bump 版號。

## Goals / Non-Goals

**Goals:**
- 新增 `0.2.0` CHANGELOG entry，記錄 sidebar toggle 功能
- Bump package.json version 到 `0.2.0`

**Non-Goals:**
- 不回溯補齊 0.1.0 以來的所有中間變更（README screenshots 等非功能性變更不需記錄在 extension CHANGELOG）
- 不處理發佈流程（由 `vscode-cicd-publish` change 處理）

## Decisions

### 1. 版號策略

**選擇**: `0.2.0`（minor bump）
**原因**: 新增了使用者可見的功能（sidebar toggle），符合 semver minor 語意。

### 2. CHANGELOG 格式

**選擇**: 沿用現有格式（`## version` + bullet list）
**原因**: 保持一致性，簡潔明瞭。

## Risks / Trade-offs

- 無顯著風險，純文件變更
