### Requirement: Skill 目錄結構

frontend-design skill SHALL 存放於 `.agents/skills/frontend-design/` 目錄下，包含 `SKILL.md` 和 `LICENSE.txt` 兩個檔案。

#### Scenario: Skill 檔案存在

- **WHEN** 檢查 `.agents/skills/frontend-design/` 目錄
- **THEN** 目錄中 SHALL 包含 `SKILL.md` 和 `LICENSE.txt`

### Requirement: Claude Code Skill 註冊

`.claude/skills/frontend-design` SHALL 為一個 symlink，指向 `../../.agents/skills/frontend-design`，使 Claude Code 能自動偵測並載入此 skill。

#### Scenario: Symlink 正確指向

- **WHEN** Claude Code 掃描 `.claude/skills/` 目錄
- **THEN** `frontend-design` symlink SHALL 解析至 `.agents/skills/frontend-design/`

### Requirement: SKILL.md 包含設計指引

`SKILL.md` SHALL 包含 frontmatter（name、description、license）以及設計指引內容，涵蓋 Design Thinking 流程和 Frontend Aesthetics Guidelines。

#### Scenario: Skill 被觸發時提供指引

- **WHEN** 使用者要求建立網頁元件、頁面、dashboard 或美化 web UI
- **THEN** Claude Code SHALL 載入 SKILL.md 中的設計指引，引導產出高品質前端介面
