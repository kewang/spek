## Context

spek 專案的 Claude Code skills 遵循統一的管理慣例：原始檔放在 `.agents/skills/<name>/`，再從 `.claude/skills/<name>` 建立 symlink。目前 `frontend-design` 已採用此模式，但 `release` skill 遺留在使用者全域 `~/.claude/skills/release/`，未納入版本控制。

## Goals / Non-Goals

**Goals:**
- 將 `release` skill 納入專案版本控制
- 與 `frontend-design` skill 保持一致的目錄結構

**Non-Goals:**
- 不修改 `release` skill 的內容
- 不變更 skill 的功能行為

## Decisions

1. **沿用既有的 symlink 模式**：原始檔放 `.agents/skills/release/SKILL.md`，`.claude/skills/release` 為 symlink。與 `frontend-design` 一致，無需引入新模式。

## Risks / Trade-offs

- [風險] 刪除使用者全域的 `~/.claude/skills/release/` 後，在其他專案中無法使用 `/release` → 此 skill 本就是 spek 專屬，不影響其他專案。
