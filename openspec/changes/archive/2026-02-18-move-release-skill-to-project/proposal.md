## Why

`/release` skill 目前定義在使用者全域目錄 `~/.claude/skills/release/`，但它是 spek 專案專屬的 skill（內容包含 spek 的 CHANGELOG 路徑、npm version 流程等）。應該放在專案層級，與 `frontend-design` skill 保持一致的管理方式，並納入版本控制。

## What Changes

- 將 `/release` skill 從 `~/.claude/skills/release/` 搬移至專案目錄 `.agents/skills/release/`
- 在 `.claude/skills/release` 建立指向 `../../.agents/skills/release` 的 symlink
- 刪除使用者全域目錄中的原始檔案

## Capabilities

### New Capabilities

（無新增能力）

### Modified Capabilities

（無既有 spec 需要修改，此變更僅涉及檔案位置調整，不影響任何功能行為）

## Impact

- `.agents/skills/release/SKILL.md` — 新增檔案（從使用者全域搬入）
- `.claude/skills/release` — 新增 symlink
- `~/.claude/skills/release/` — 刪除
- 不影響任何程式碼、API 或依賴
