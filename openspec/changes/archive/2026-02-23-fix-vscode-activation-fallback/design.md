## Context

`fix-detect-fallback` change 修正了 Web server 和 VS Code handler 的 detect API，讓缺少 `config.yaml` 但有 `openspec/specs/` 或 `openspec/changes/` 的 repo 也能被偵測到。但當時明確不修改 VS Code `activationEvents`，因為那時 extension 只有 command，手動觸發即可。

`add-vscode-sidebar` change 加入了 Activity Bar sidebar，spec 要求「extension SHALL activate when a workspace containing an `openspec/` directory is opened」，但 `activationEvents` 和 `hasOpenSpecDir()` 仍只檢查 `config.yaml`，導致無 `config.yaml` 的 repo 看不到 sidebar。

## Goals / Non-Goals

**Goals:**
- 無 `config.yaml` 但有 `openspec/specs/` 或 `openspec/changes/` 的 workspace，extension 能自動啟動
- `hasOpenSpecDir()` 同步 detect fallback 邏輯，正確設定 `spek.hasOpenSpec` context key
- 保持有 `config.yaml` 時的行為不變

**Non-Goals:**
- 不改 Web server 或 handler 的 detect 邏輯（已在 `fix-detect-fallback` 修正過）
- 不引入 async 啟動流程（`activate()` 中用 `fs.existsSync` 是同步且安全的）

## Decisions

### activationEvents 策略

**決定**：保留 `workspaceContains:openspec/config.yaml`，加入 `onStartupFinished` 作為 fallback。

**替代方案 1**：`workspaceContains:openspec/specs/**` 和 `workspaceContains:openspec/changes/**`。實測發現 VS Code 的 `workspaceContains` glob 對 `**` pattern 有搜尋深度限制，不可靠。

**替代方案 2**：只用 `onStartupFinished`。可行但會讓有 `config.yaml` 的 repo 延遲啟動（需等 VS Code 完全啟動）。

**理由**：`workspaceContains:openspec/config.yaml` 讓有 config 的 repo 快速啟動；`onStartupFinished` 保底讓所有 workspace 都有機會偵測。成本極低，`activate()` 中只有幾個 `fs.existsSync` 呼叫，無 openspec 目錄時立即 return。

### hasOpenSpecDir() fallback 邏輯

**決定**：先檢查 `config.yaml`，若不存在則依序檢查 `openspec/specs` 和 `openspec/changes` 目錄是否存在，任一存在即回傳 `true`。

**理由**：與 `fix-detect-fallback` 的策略一致，保持整個專案的偵測邏輯統一。

## Risks / Trade-offs

- `onStartupFinished` 會讓 extension 在所有 workspace 都啟動，但 `activate()` 內的偵測邏輯極輕量（幾個同步 fs 呼叫），無 openspec 目錄時不註冊任何 TreeView 或 status bar，overhead 可忽略
- 有 `config.yaml` 的 repo 仍走 `workspaceContains` 快速啟動，不受影響
