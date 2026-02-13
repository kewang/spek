<p align="center">
  <img src="logo/full-logo.svg" alt="spek" width="480" />
</p>

<p align="center">
  輕量級的 <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> 內容檢視器 — 結構化瀏覽 specs、changes 與 tasks。
</p>

**[English](README.md)**

---

## spek 是什麼？

**spek** 把你本機的 OpenSpec 目錄變成可瀏覽、可搜尋的介面。不用再打開一堆 Markdown 檔案逐一閱讀，spek 提供結構化的瀏覽體驗，包含 BDD 語法高亮、任務進度追蹤和全文搜尋。

提供兩種使用方式：

- **Web 版** — 本地 Express + React 應用，瀏覽器即可使用
- **VS Code Extension** — 直接在 VS Code 內開啟 Webview Panel 瀏覽

兩者皆為**唯讀**且**純本地**運作。不需要部署伺服器、不需要登入、資料不會離開你的電腦。

## 功能特色

- **Dashboard 總覽** — Specs 數量、Changes 數量、任務完成率一覽
- **Specs 瀏覽** — 依字母排序的主題列表，含詳細內容與修訂歷史
- **Changes 時間線** — 進行中與已封存的 changes，分頁顯示 Proposal / Design / Tasks / Specs
- **BDD 語法高亮** — WHEN/GIVEN（藍）、THEN（綠）、AND（灰）、MUST/SHALL（紅）關鍵字上色
- **任務進度** — 解析 checkbox，依章節分組顯示進度條
- **全文搜尋** — `Cmd+K` / `Ctrl+K` 跨 specs 與 changes 搜尋
- **深色 / 淺色主題** — 可切換，預設深色主題
- **Spec 歷史追蹤** — 基於 Git 的時間戳記追蹤 spec 修訂紀錄
- **響應式版面** — 適應不同螢幕尺寸

## 快速開始

### Web 版

```bash
git clone https://github.com/kewang/spek.git
cd spek
npm install
npm run dev
```

開啟 http://localhost:5173，輸入包含 `openspec/` 目錄的 repo 路徑，即可開始瀏覽。

### VS Code Extension

```bash
npm run build -w @spek/core
npm run build:webview -w @spek/web
npm run build -w spek-vscode
cd packages/vscode && npx vsce package --no-dependencies
```

在 VS Code 中安裝產出的 `.vsix` 檔案。當 workspace 包含 `openspec/config.yaml` 時，Extension 會自動啟動。

**指令：**
- `spek: Open spek` — 開啟檢視器面板
- `spek: Search OpenSpec` — 開啟搜尋對話框

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
├── core/       # @spek/core — 純邏輯（掃描器、解析器、型別定義）
├── web/        # @spek/web — Express API + React SPA
└── vscode/     # spek-vscode — VS Code Extension
```

### API Adapter 模式

前端透過 `ApiAdapter` 介面與後端溝通，有兩種實作：

- **FetchAdapter** — Web 版，透過 HTTP 呼叫 Express REST API
- **MessageAdapter** — VS Code 版，透過 `postMessage` 與 Extension Host 通訊

同一套 React UI 不需改動程式碼就能在兩種環境運作。

### 技術棧

| 層面 | 技術 |
|------|------|
| Core | TypeScript, Node.js |
| 前端 | React 19, Vite 6, Tailwind CSS v4, React Router v7 |
| 後端 | Express 4 |
| Markdown 渲染 | react-markdown, remark-gfm |
| 搜尋 | Fuse.js |
| Extension | VS Code Webview API, esbuild |

## 開發

```bash
npm install              # 安裝所有 workspace 依賴
npm run dev              # 啟動 Vite (5173) + Express (3001)
npm run build            # Build core + web
npm run build:core       # 僅 Build @spek/core
npm run build:webview    # Build webview 靜態資源（給 VS Code Extension 用）
npm run build:vscode     # Build VS Code Extension
npm run type-check       # TypeScript 型別檢查
```

**系統需求：** Node.js 22+

## 授權

MIT
