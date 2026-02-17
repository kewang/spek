## 1. 搬移 Skill 檔案

- [x] 1.1 建立 `.agents/skills/release/` 目錄
- [x] 1.2 將 `~/.claude/skills/release/SKILL.md` 複製至 `.agents/skills/release/SKILL.md`
- [x] 1.3 在 `.claude/skills/` 建立 `release` symlink 指向 `../../.agents/skills/release`
- [x] 1.4 刪除使用者全域目錄 `~/.claude/skills/release/`

## 2. 驗證

- [x] 2.1 確認 `.claude/skills/release` symlink 正確指向 `.agents/skills/release`
- [x] 2.2 確認 `/release` skill 可正常載入（顯示在可用 skills 列表中）
