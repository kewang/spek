## Context

專案目前只有本地 git repo，尚未設定 remote。VS Code Extension 已發佈至 Marketplace，但兩份 README（英文、繁中）的安裝說明仍為手動 build `.vsix` 流程。

## Goals / Non-Goals

**Goals:**
- 設定 GitHub remote 並 push `master` 分支
- 更新 README.md 和 README.zh-TW.md 的 VS Code Extension 安裝說明為 Marketplace 連結

**Non-Goals:**
- 不重新命名分支（維持 `master`）
- 不修改程式碼或功能
- 不調整 CI/CD 或 GitHub Actions

## Decisions

### 1. 維持 `master` 分支名稱
直接以 `master` push，不改為 `main`。這是使用者的明確要求。

### 2. README VS Code Extension 區塊改寫方式
- 移除手動 build + `.vsix` 安裝的 code block
- 改為 Marketplace 安裝連結 + 一句說明
- Extension URL: `https://marketplace.visualstudio.com/items?itemName=kewang.spek-vscode`
- 保留 Commands 區塊（`spek: Open spek`、`spek: Search OpenSpec`）不變

## Risks / Trade-offs

- [README 手動 build 說明移除] → 開發者如需自行 build extension，可參考 Development 區塊的 build 指令，不另外保留
