## Context

目前 VS Code extension 發佈需要手動在本機執行多步驟：build core → build webview → build extension → cd packages/vscode → vsce publish。這個流程容易遺漏步驟，且無法從 repo root 一行完成。專案目前沒有任何 GitHub Actions workflow。

## Goals / Non-Goals

**Goals:**
- Push `v*` tag 時自動觸發 CI/CD pipeline
- 自動完成完整 build chain 並發佈到 VS Code Marketplace
- 支援手動觸發（workflow_dispatch）方便除錯

**Non-Goals:**
- 不處理 Web 版的 CI/CD（僅限 VS Code extension）
- 不自動建立 GitHub Release
- 不自動 bump version（version 由開發者手動更新 package.json 後 push tag）

## Decisions

### 1. Tag 命名採用 `v*` 格式

**選擇**: 使用 `v*`（例如 `v0.2.0`）
**原因**: 專案功能統一，Web 版與 VS Code extension 共用同一版號，不需要 prefix 區分。

### 2. 使用 `VSCE_PAT` secret 認證

**選擇**: Personal Access Token via GitHub Secret
**原因**: 這是 `vsce publish` 的標準認證方式，簡單直接。替代方案如 Azure DevOps service connection 過於複雜。

### 3. 單一 workflow 檔案，不拆分 build/publish jobs

**選擇**: 單一 job 完成 build + publish
**原因**: 步驟間有嚴格依賴關係（core → webview → extension → publish），拆分 jobs 需要 artifact 傳遞，增加複雜度但無實質好處。

### 4. Node.js 版本策略

**選擇**: 使用 Node.js 20（LTS）
**原因**: 對齊本地開發環境，且 GitHub Actions runner 預裝此版本。

## Risks / Trade-offs

- **[PAT 過期]** → VSCE_PAT 過期時 publish 會失敗。Mitigation: 使用長效 token 並設 calendar reminder 更新。
- **[Marketplace 發佈失敗]** → 網路問題或 Marketplace 暫時不可用。Mitigation: 可手動重新 trigger workflow。
- **[Version 衝突]** → 忘記更新 version 就 push tag，Marketplace 會拒絕。Mitigation: Workflow 中加入 version check 步驟，從 tag 提取版號與 package.json 比對。
