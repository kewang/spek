## Context

spek 專案新增 frontend-design skill，讓 Claude Code 在處理前端設計相關任務時自動載入設計指引。檔案已放置於 `.agents/skills/frontend-design/`，並透過 `.claude/skills/frontend-design` symlink 讓 Claude Code 偵測。

## Goals / Non-Goals

**Goals:**
- 將 frontend-design skill 檔案正式納入專案版本控制
- 建立 `.agents/skills/` 作為存放 skill 的標準目錄
- 透過 `.claude/skills/` symlink 機制讓 Claude Code 自動載入

**Non-Goals:**
- 不修改 spek 的核心程式碼或 UI
- 不建立 skill 的自動化測試或 CI 整合
- 不變更現有 build 流程

## Decisions

### 1. Skill 存放於 `.agents/skills/` 而非 `.claude/skills/`

**選擇**：skill 原始檔放在 `.agents/skills/frontend-design/`，`.claude/skills/frontend-design` 為 symlink。

**理由**：`.claude/` 是 Claude Code 的設定目錄，放置 symlink 即可。實際 skill 內容存放在 `.agents/` 下，語意更清晰——`.agents/` 存放 agent 相關資源，`.claude/` 只做引用。

### 2. Skill 內容為純靜態文件

**選擇**：skill 僅包含 `SKILL.md`（指引）和 `LICENSE.txt`（授權），無程式碼。

**理由**：frontend-design skill 是 prompt-level 的設計指引，不需要執行任何程式碼，純文件即可。

## Risks / Trade-offs

- **[Symlink 跨平台]** → Windows 可能需要額外設定才能正確建立 symlink；目前 spek 主要在 Linux/macOS 開發，影響有限
- **[Skill 未自動驗證]** → 沒有機制驗證 SKILL.md 格式是否正確；目前依賴 Claude Code 自身的 skill loading 機制
