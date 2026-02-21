## Why

OpenSpec CLI 不強制要求 `config.yaml` 存在，只要有 `openspec/` 目錄就能正常運作。但 spek 的 detect API 和 VS Code activation 都只檢查 `openspec/config.yaml` 是否存在，導致缺少 `config.yaml` 的有效 OpenSpec repo 無法被偵測到。

## What Changes

- 修正 detect 邏輯：先檢查 `config.yaml`，若不存在則 fallback 檢查 `openspec/specs/` 或 `openspec/changes/` 目錄是否存在
- 有 `config.yaml` 時回傳 schema；fallback 偵測到時 schema 為 `"unknown"`
- Web server 和 VS Code handler 兩邊都要修

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `filesystem-api`: detect endpoint 增加 fallback 偵測邏輯

## Impact

- `packages/web/server/routes/filesystem.ts`：detect route
- `packages/vscode/src/handler.ts`：detect method
