<p align="center">
  <img src="logo/full-logo.svg" alt="spek" width="480" />
</p>

<p align="center">
  輕量級的 <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> 內容檢視器 — 結構化瀏覽 specs、changes 與 tasks。
</p>

<p align="center">
  <img alt="Specs" src="https://spekhq.github.io/spek/badges/specs.svg" />
  <img alt="Open Changes" src="https://spekhq.github.io/spek/badges/open_changes.svg" />
  <img alt="Tasks" src="https://spekhq.github.io/spek/badges/tasks.svg" />
</p>

**[English](README.md)**

---

## spek 是什麼？

**spek** 把你本機的 OpenSpec 目錄變成可瀏覽、可搜尋的介面。不用再打開一堆 Markdown 檔案逐一閱讀，spek 提供結構化的瀏覽體驗，包含 BDD 語法高亮、任務進度追蹤和全文搜尋。

**[線上 Demo](https://spekhq.github.io/spek/demo.html)** — 直接在瀏覽器體驗，免安裝。

提供三種使用方式：

- **Web 版** — 本地 Express + React 應用，瀏覽器即可使用
- **VS Code Extension** — 直接在 VS Code 內開啟 Webview Panel 瀏覽
- **IntelliJ Plugin** — 在 IntelliJ IDEA 系列 IDE 中透過 JCEF Tool Window 瀏覽

三者皆為**唯讀**且**純本地**運作。不需要部署伺服器、不需要登入、資料不會離開你的電腦。

## 功能特色

- **Dashboard 總覽** — Specs 數量、Changes 數量、任務完成率一覽，加上生命週期統計（已封存 change 平均週期、超過 30 天未封存的 stale active）
- **Specs 瀏覽** — 依字母排序的主題列表，含詳細內容與修訂歷史；requirement 與 scenario 就地摺疊，一份 spec 打開時是一張仍帶著規範句的大綱
- **Changes 瀏覽** — 進行中與已封存的 changes，分頁顯示 Proposal / Design / Tasks / Specs；每筆 row 顯示建立日期、封存日期與生命週期天數
- **Schemas 瀏覽** — 列出該 repo 可用的每個 workflow schema，含來源與它定義了哪些 artifact；詳情頁把一份 schema 畫成可讀的流程 —— artifact 依相依順序排列，各自標明產生哪個檔案、動工前需要什麼，以及完整的 instruction 內文。repo 的預設 schema 會被標示，每個 schema 也能點進正在使用它的 change
- **Worktree 聚合** — 自動探索 repo 的所有 git worktree，把各 worktree 進行中的 change 去重後合併到單一畫面 —— 為 AI agent 平行開發時代而生；也以實驗性選項支援 Jujutsu（jj）workspace
- **Timeline 時間軸** — 用水平 Gantt 風格圖呈現所有 change 的生命週期，可依 spec topic 分群、依狀態過濾，時間軸刻度依跨度自動切換
- **BDD 語法高亮** — WHEN/GIVEN（藍）、THEN（綠）、AND（灰）、MUST/SHALL（紅）關鍵字上色，四種 delta operation（ADDED / MODIFIED / REMOVED / RENAMED）各有專屬 badge
- **任務進度** — 解析 checkbox，依章節分組顯示進度條
- **全文搜尋** — `Cmd+K` / `Ctrl+K` 跨 specs 與 changes 搜尋
- **深色 / 淺色主題** — 可切換，預設深色主題
- **Spec 歷史追蹤** — 基於 Git 的時間戳記追蹤 spec 修訂紀錄
- **響應式版面** — 適應不同螢幕尺寸
- **VS Code 側邊欄** — Activity Bar icon + TreeView，直接從側邊欄瀏覽 specs 與 changes

## Worktree 聚合

在 AI agent 開發的時代，同一個 repo 經常**同時開著多份工作副本** —— 每個 agent、或每個平行任務，各自在自己的 worktree、自己的分支上進行。這些工作的 OpenSpec change 會散落在各副本裡，把檢視工具指向單一目錄，只看得到其中一部分。

spek 會探索 repo 的每一個 worktree（透過 `git worktree list`），把**各 worktree 進行中的 change 聚合到同一個畫面**。指向任一 worktree、或主 repo，都能看到全貌：

- **所有 worktree 的 active changes**，每筆標示來源分支；來自主 worktree 的 change 不加標籤，讓 feature worktree 的工作一眼凸顯
- **同一個 change 只佔一列** —— 被多個 worktree 繼承的 change 只顯示一次，勝出的副本以 git 歷史（哪個 worktree 真的把它推進到 main 之前）決定，而不是檔案時間戳（fresh checkout 會把時間戳整個重寫）
- **archived changes** 跨 worktree 合併、依 slug 去重
- **App header 的聚合範圍控制項** —— `Current dir` / `Worktrees` / `Worktrees + jj`，只在有多份工作副本可聚合時出現；選擇會保存下來（Web 存瀏覽器、VS Code 存 `spek.aggregateWorktrees` 設定）
- **Web 版**與 **VS Code extension**（panel + 側邊欄）皆支援，任一 worktree 的 `openspec/` 變動都會即時刷新

![Worktree 聚合](screenshots/worktree-aggregation.png)

### Jujutsu（jj）workspace —— 實驗性

從 1.9.0 起，聚合不再侷限於 git。在 git 與 jj 共置（colocated）的 repo 中，jj workspace 對 `git worktree list` 是隱形的，在裡面撰寫的 change 因此會被默默漏掉。在 header 控制項選擇 `Worktrees + jj`，spek 就會一併掃描每個 jj workspace，合併進同一個畫面。

- **預設關閉、需自行開啟** —— header 控制項的 `Worktrees + jj` 選項（Web）或 `spek.aggregateJjWorkspaces` 設定（VS Code）。只有真的偵測到 jj workspace 時才會出現這個選項
- **以內容去重，而非 git 歷史** —— jj workspace 共用同一份 commit graph，每個 workspace 都會實體化整個 trunk，因此共用的 change 原本會每個 workspace 各出現一次。內容相同的副本會收斂成一筆；在某個 workspace 已經分歧的副本則保留自己的項目，標示 `conflicts with <base>`，若正是 `@` 所編輯的還會標示 `editing`
- **絕不強制安裝 `jj`** —— 沒裝 jj、repo 不是 jj repo、或選項關閉時，行為與先前完全相同。git worktree 的邏輯不受影響：jj 副本永遠不會進入 git 的分歧選舉，因為 jj 的 working-copy commit 並不是 git ref
- 支援 **Web 版**與 **VS Code extension**；IntelliJ plugin 有自己的掃描實作，目前尚未支援聚合

## 快速開始

### Web 版

```bash
git clone https://github.com/spekhq/spek.git
cd spek
npm install
npm run dev
```

開啟 http://localhost:5173，輸入包含 `openspec/` 目錄的 repo 路徑，即可開始瀏覽。

> `npm install` 會編譯共用的 `@spekjs/core` 套件，`npm run dev` 啟動前也會重新 build，因此 fresh clone 不需額外手動 build 即可啟動。

### VS Code Extension

從 [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=kewang.spek-vscode) 安裝。當 workspace 包含 `openspec/config.yaml` 時，Extension 會自動啟動。

啟動後，點擊 Activity Bar 上的 **spek icon** 即可從側邊欄瀏覽 specs 與 changes。點擊任一項目會開啟完整的檢視器面板。

**指令：**
- `spek: Open spek` — 開啟檢視器面板
- `spek: Search OpenSpec` — 開啟搜尋對話框
- `spek: Open Dashboard` — 從側邊欄開啟 Dashboard

**設定：**

| 設定 | 說明 | 預設值 |
|------|------|--------|
| `spek.aggregateWorktrees` | 跨 repo 所有 git worktree 聚合 changes | `true` |
| `spek.aggregateJjWorkspaces` | **實驗性** —— 一併聚合 jj（Jujutsu）workspace | `false` |

這兩個設定就是 panel header 聚合範圍控制項所寫入的對象，因此切換控制項會直接改寫 workspace 的 `settings.json`，反過來手動改設定也會同步更新控制項。

### IntelliJ Plugin

從 [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/30600-spek--openspec-viewer) 安裝 — 在 **Settings > Plugins > Marketplace** 搜尋 **「spek」** 即可。

當專案包含 `openspec/` 目錄時，Plugin 會自動啟用。點擊右側 sidebar 的 **spek** 圖示即可開啟檢視器。

**指令：**
- **Tools > Open spek** — 開啟檢視器面板

## 截圖

### Dashboard 總覽
Specs 數量、Changes 數量、任務完成率一覽。

![Dashboard](screenshots/dashboard.png)

### Specs 瀏覽
依字母排序的主題列表，支援篩選。

![Specs 列表](screenshots/specs-list.png)

### Spec 詳細內容
一份 spec 打開時是一張大綱：每條 requirement 顯示它所規範的那句話，scenario 的細節則收著等你要求。BDD
關鍵字上色 —— WHEN/GIVEN（藍）、THEN（綠）、AND（灰）、MUST/SHALL（紅）。

![Spec 詳細](screenshots/spec-detail.png)

### Changes 瀏覽
進行中與已封存的 changes 依時間排列，每筆 row 顯示生命週期天數。

![Changes 列表](screenshots/changes-list.png)

### Schemas 工作流程
一個 change 要經過的流程 —— artifact 依相依順序排列，點選任一步驟即可讀到它完整的 instruction 內文。

![Schemas](screenshots/schemas.png)

### Timeline 時間軸
水平 Gantt 風格呈現所有 change 的生命週期 — active 的 bar 延伸到今天，archived 為固定區段。

![Timeline](screenshots/timeline.png)

### Change 詳細內容
每個 artifact 一個分頁。預設 `spec-driven` schema 為 Proposal、Design、Specs、Tasks；變更採用的 schema 會以 badge 顯示。

![Change 詳細](screenshots/change-detail.png)

### 自訂 Schema
spek 會顯示變更實際包含的所有 artifact，因此以自訂 OpenSpec schema 撰寫的變更（例如 `superpowers-bridge` 的 `brainstorm` / `plan` / `verify` / `retrospective`）每個 artifact 都會有自己的分頁。分頁預設以**最後修改時間**排序，讓正在編輯的 artifact 浮到最前；並提供排序控制可切換為 **Schema order** 或 **A–Z**。Schema order 來自 OpenSpec 權威（`openspec` CLI），而非 spek 自行解析 schema 格式，因此對任何 schema 都正確；CLI 不可用（或變更已封存）時，該模式會退回預設排序並說明原因。

![自訂 Schema](screenshots/custom-schema.png)

### 全文搜尋
`Cmd+K` / `Ctrl+K` 跨 specs 與 changes 搜尋。

![搜尋](screenshots/search.png)

## GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-spek-blue?logo=github)](https://github.com/marketplace/actions/spek-openspec-static-site)

使用 spek GitHub Action 在 CI 中自動建置 OpenSpec 靜態網站。

### 基本用法

```yaml
- uses: actions/checkout@v7
  with:
    fetch-depth: 0  # 建議取得完整 git history 以取得正確的 change timestamps

- uses: spekhq/spek@v1
  with:
    title: "My Project - OpenSpec"
```

### 部署到 GitHub Pages

```yaml
name: Build OpenSpec Site
on:
  push:
    branches: [main]
    paths: ["openspec/**"]

permissions:
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: spekhq/spek@v1
        with:
          title: "My Project - OpenSpec"

      - uses: actions/upload-pages-artifact@v5
        with:
          path: spek-output

      - name: Deploy to GitHub Pages
        id: deploy
        uses: actions/deploy-pages@v5
```

### Inputs

| Input | 說明 | 預設值 |
|-------|------|--------|
| `repo-path` | 包含 `openspec/` 目錄的 repo 路徑 | `.` |
| `output-path` | 輸出 HTML 檔案路徑 | `spek-output/spek.html` |
| `title` | 頁面標題 | `OpenSpec Viewer` |
| `spek-version` | spek 版本（tag、branch 或 SHA） | `master` |
| `generate-badges` | 產生 SVG badge 檔案 | `false` |

### Outputs

| Output | 說明 |
|--------|------|
| `html-path` | 產出 HTML 檔案的絕對路徑 |
| `badges-path` | 產出 badge 目錄的絕對路徑 |

### Badges

啟用 `generate-badges` 可在建置靜態網站時一併產生 SVG 狀態徽章（specs 數量、open changes 數量、tasks 完成率）。部署到 GitHub Pages 後即可在 README 中引用：

```yaml
- uses: spekhq/spek@v1
  with:
    title: "My Project - OpenSpec"
    generate-badges: true
```

在 README 中引用：

```markdown
![Specs](https://your-user.github.io/your-repo/badges/specs.svg)
![Open Changes](https://your-user.github.io/your-repo/badges/open_changes.svg)
![Tasks](https://your-user.github.io/your-repo/badges/tasks.svg)
```

> **注意：** 建議在 checkout 步驟使用 `fetch-depth: 0` 以取得正確的 change timestamps。若無完整 git history，timestamps 將不可用（build 仍會成功）。

## OpenSpec 目錄結構

spek 預期你的 repo 底下有以下結構：

```
{repo}/openspec/
├── config.yaml
├── specs/
│   └── {topic}/
│       └── spec.md              # BDD 格式的規格文件
└── changes/
    ├── {active-change}/         # 進行中的變更
    │   ├── .openspec.yaml
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/               # 該變更的 delta specs
    └── archive/
        └── {YYYY-MM-DD-desc}/   # 已封存的變更（同樣結構）
```

## 架構

### Monorepo 結構

```
packages/
├── core/       # @spekjs/core — 純邏輯（掃描器、解析器、型別定義）        [發佈到 npm]
├── ui/         # @spekjs/ui   — 可重用視覺化元件（graph、timeline）      [發佈到 npm]
├── web/        # @spekjs/web  — Express API + React SPA
├── vscode/     # spek-vscode  — VS Code Extension
└── intellij/   # spek-intellij — IntelliJ Platform Plugin（Kotlin）
```

### 發佈的套件

有兩個套件發佈到 npm，讓 monorepo 以外的宿主也能重用：

- **[`@spekjs/core`](https://www.npmjs.com/package/@spekjs/core)** —— 引擎：掃描器、tasks 解析、
  worktree 聚合、共用型別。純 Node.js，不綁任何框架。
- **[`@spekjs/ui`](https://www.npmjs.com/package/@spekjs/ui)** —— 兩個視覺化元件：`<SpecGraph>`
  （force-directed 的 spec ↔ change 關聯圖）與 `<ChangeTimeline>`（Gantt 風格的 change 生命週期）。
  **純呈現層** —— 沒有 router、沒有資料層、沒有 CSS 框架。顏色是八個 CSS custom property 組成的
  明確契約，宿主覆寫這些變數即可換膚。

在這個 monorepo 內部，兩者透過 npm workspaces 解析，因此開發不受它們的發版節奏牽制。兩者都是手動發版，版本線與 root 各自獨立。

### API Adapter 模式

前端透過 `ApiAdapter` 介面與後端溝通，有兩種實作：

- **FetchAdapter** — Web 版 + IntelliJ 版，透過 HTTP 呼叫 REST API（支援自訂 base URL）
- **MessageAdapter** — VS Code 版，透過 `postMessage` 與 Extension Host 通訊

同一套 React UI 不需改動程式碼就能在三種環境運作。

注意 `@spekjs/ui` **不**依賴 `ApiAdapter`：它的元件用 props 收資料，取資料是宿主的責任 —— 在這裡是 HTTP，在 Electron 宿主裡就會是 IPC。

### 技術棧

| 層面 | 技術 |
|------|------|
| Core | TypeScript, Node.js |
| UI 套件 | React 19（peer）, d3（force、zoom、drag、selection、transition）, 手寫 CSS |
| 前端 | React 19, Vite 6, Tailwind CSS v4, React Router v7 |
| 後端 | Express 4 |
| Markdown 渲染 | react-markdown, remark-gfm |
| 搜尋 | Fuse.js |
| VS Code Extension | VS Code Webview API, esbuild |
| IntelliJ Plugin | Kotlin, JCEF, IntelliJ Platform SDK |

## 開發

```bash
npm install              # 安裝所有 workspace 依賴
npm run dev              # 啟動 Vite (5173) + Express (3001)
npm run build            # Build core + ui + web
npm run build:core       # 僅 Build @spekjs/core
npm run build:ui         # 僅 Build @spekjs/ui
npm run build:webview    # Build webview 靜態資源（給 VS Code Extension 用）
npm run build:vscode     # Build VS Code Extension
npm run build:intellij   # Build IntelliJ webview 靜態資源
npm run type-check       # 型別檢查所有 package 與 scripts/（含測試檔）
npm run lint             # ESLint
```

**IntelliJ Plugin build：**
```bash
npm run build:intellij                    # Build 前端靜態資源
cd packages/intellij && ./gradlew buildPlugin  # Build plugin ZIP
```

**系統需求：** Node.js 22+、Java 17+（IntelliJ plugin build 需要）

### 容器環境的即時重載（devcontainer / WSL）

spek 會監看 `openspec/` 並在檔案變更時即時重載。在不傳遞原生檔案事件的檔案系統上 —— 9p / drvfs / NFS / CIFS 等掛載（devcontainer、WSL 把 host 目錄掛進容器即如此）—— spek 會自動改用 polling，確保新建檔案仍能被偵測。判別依據是被監看路徑所在掛載的檔案系統型別。可用環境變數覆寫：

- `SPEK_WATCH_POLLING=on`（或 `off`）—— 對所有版本強制開啟 / 關閉 polling
- `CHOKIDAR_USEPOLLING=1` / `CHOKIDAR_INTERVAL=<ms>` —— Web 與 VS Code 另外尊重 chokidar 原生環境變數

## 參與貢獻

歡迎各種形式的貢獻 —— 從修正錯字到跨 Web / VS Code / IntelliJ 的新功能。請先閱讀
[Contributing Guide](CONTRIBUTING.md)，裡面有開發環境設定、慣例，以及送出 PR 的流程。

- [Contributing Guide](CONTRIBUTING.md) —— 開發環境、慣例、如何送 PR
- [Code of Conduct](CODE_OF_CONDUCT.md) —— 行為準則
- [Security Policy](SECURITY.md) —— 如何私下回報安全漏洞

## 致謝

本專案的靈感來自[龍哥（高見龍）](https://kaochenlong.com)介紹 SDD（Spec Driven Development）的系列文章。特別感謝龍哥在 SDD 和 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 上的貢獻。

- [SDD — Spec Driven Development](https://kaochenlong.com/sdd-spec-driven-development)
- [Spectra with OpenSpec](https://kaochenlong.com/spectra-with-openspec)

## 貢獻者

感謝所有為 spek 貢獻的人：

- [@nthansen](https://github.com/nthansen)（Norman Hansen）
  - 支援自訂 OpenSpec schema —— 從磁碟探索 change 的 artifact，任何 schema 的 artifact 都能各自成為分頁
  - 使用者可選的 artifact 分頁排序（最後修改 / Schema order / A–Z），其中 Schema order 取自 OpenSpec CLI
  - Changes 列表、Dashboard 與 Change 詳情頁的 schema badge，與 repo 預設相同時自動隱藏
  - 網路掛載 / 無原生檔案事件檔案系統（devcontainer / WSL）的 polling 即時重載 fallback
  - `@spekjs/core` 與 `@spekjs/ui` 的跨平台建置指令 —— 從原始碼建置在 Windows `cmd.exe` 下也能運作
  - 跨 worktree 聚合時的 schema 基準 —— 每個 change 對照自己所在 worktree 的預設 schema 判斷 badge，掃描時每個 worktree 的 config 只讀一次而非每個 change 讀一次
  - TOC 與 `#hash` 導覽把目標標題捲到 sticky header 下方，而不是被它遮住
  - 開啟 change 不再每個都查一次 OpenSpec CLI —— 權威 artifact 順序改以 schema 為單位快取，因為共用同一 schema 的 change 得到的答案完全相同
  - 項目間有空行的清單，項目符號與編號改為與內容首行同行，不再被擠到自己一行
  - Tasks 分頁的 task 文字改以 Markdown 呈現，且 task 的續行 —— 子項目、段落、程式碼區塊 —— 不再於 parser 階段就被丟棄，得以完整顯示
  - 移除 web server 中未被引用的 `server/lib/` 核心掃描邏輯副本 —— 它是 `@spekjs/core` 之外的第二份同規則實作，會成為漂移的溫床
  - 各介面皆可瀏覽 workflow schema —— Schemas 頁面列出每個 schema 定義了什麼，詳情頁把它的 artifact 依相依順序畫成可讀的流程

- [@david-lutz](https://github.com/david-lutz)（David Lutz）
  - Changes 列表與關聯圖中，跨 git worktree 共用的 active change 去重 —— 勝出的副本以 git 分歧選舉決定，而非檔案時間戳（fresh checkout 會把它整個重寫掉）

- [@DannyGoodall](https://github.com/DannyGoodall)（Danny Goodall）
  - 實驗性的 Jujutsu（jj）workspace 聚合 —— 在 jj workspace 撰寫、對 `git worktree list` 隱形的 change 也能被探索並併入聚合畫面，以內容去重，分歧的副本則保留並加上標示

- [@Katsz](https://github.com/Katsz)（Alex）
  - Spec 差異檢視中，新增／刪除行的紅綠底色鋪滿整個橫向捲動範圍 —— 過長的行不再只有第一個畫面寬度有底色

## 授權

MIT
