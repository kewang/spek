## Why

目前發佈 VS Code extension 需要多步手動操作（build core → build webview → build extension → cd packages/vscode → vsce publish），無法從 repo root 一行完成，容易遺漏步驟或 build 順序錯誤。設定 CI/CD 讓 push tag 時自動完成整個 build + publish 流程。

## What Changes

- 新增 GitHub Actions workflow，於 push `v*` tag 時觸發
- Workflow 自動執行完整 build chain（core → webview → extension）並發佈到 VS Code Marketplace
- 需要在 GitHub repo 設定 `VSCE_PAT` secret（Personal Access Token）

## Capabilities

### New Capabilities

- `vscode-cicd`: GitHub Actions workflow 定義，包含 tag 觸發條件、build 步驟、marketplace 發佈

### Modified Capabilities

（無既有 spec 需修改）

## Impact

- 新增 `.github/workflows/` 目錄及 workflow YAML 檔
- 不影響現有程式碼或 runtime 行為
- 需要 repo maintainer 在 GitHub Settings → Secrets 設定 `VSCE_PAT`
