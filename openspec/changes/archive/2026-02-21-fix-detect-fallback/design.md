## Context

目前 detect 邏輯只檢查 `openspec/config.yaml` 是否存在。OpenSpec CLI 不強制要求此檔案，許多 repo 只有 `openspec/specs/` 和 `openspec/changes/` 而無 `config.yaml`。

Web server (`filesystem.ts`) 和 VS Code handler (`handler.ts`) 各有一份 detect 實作，邏輯相同。

## Goals / Non-Goals

**Goals:**
- 有 `config.yaml` 時行為不變（回傳 schema）
- 無 `config.yaml` 但有 `openspec/specs/` 或 `openspec/changes/` 時，回傳 `hasOpenSpec: true, schema: "unknown"`
- Web 和 VS Code 兩邊同步修正

**Non-Goals:**
- 不修改 VS Code `activationEvents`（`workspaceContains:openspec/config.yaml`），那是 VS Code 的限制，不影響功能
- 不將 detect 邏輯抽到 `@spek/core`（scope 太小，兩邊各幾行即可）

## Decisions

### Fallback 偵測策略

**決定**：檢查 `openspec/specs/` 或 `openspec/changes/` 目錄是否存在，任一存在即視為有效。

**理由**：這兩個目錄是 OpenSpec 的核心結構。只有空的 `openspec/` 目錄（無 specs/ 也無 changes/）不視為有效。

## Risks / Trade-offs

- 誤判風險極低：一般專案不會恰好有 `openspec/specs/` 或 `openspec/changes/` 目錄
- fallback 偵測到的 repo schema 為 `"unknown"`，不影響瀏覽功能（scanner 不依賴 schema）
