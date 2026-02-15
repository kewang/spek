## Why

spek 專案需要一個專門的前端設計 skill，讓 Claude Code 在建立網頁元件、頁面或應用程式時，能產出具有高設計品質的前端介面，避免千篇一律的 AI 生成風格。此 skill 已以 `.agents/skills/frontend-design/` 的形式加入專案，需正式納入 OpenSpec 記錄。

## What Changes

- 新增 `.agents/skills/frontend-design/` 目錄，包含 `SKILL.md`（skill 定義與設計指引）和 `LICENSE.txt`
- 新增 `.claude/skills/frontend-design` symlink 指向 `.agents/skills/frontend-design`，讓 Claude Code 自動偵測並載入
- Skill 觸發條件：使用者要求建立網頁元件、頁面、landing page、dashboard、React components、HTML/CSS layouts 或美化 web UI 時
- Skill 內容涵蓋設計思維流程、前端美學指引（typography、color、motion、spatial composition、backgrounds）、避免 generic AI 風格的規範

## Capabilities

### New Capabilities

- `frontend-design-skill`: Claude Code skill 的結構定義與設計指引，涵蓋 skill 目錄結構、symlink 設定、觸發條件、美學規範

### Modified Capabilities

（無）

## Impact

- 新增檔案：`.agents/skills/frontend-design/SKILL.md`、`.agents/skills/frontend-design/LICENSE.txt`
- 新增 symlink：`.claude/skills/frontend-design`
- 不影響 spek 核心程式碼、API 或 build 流程
