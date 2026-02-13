## Context

專案即將發佈到 GitHub，需要 README 作為訪客的第一進入點。目前 repo 沒有 README 檔案，只有 `CLAUDE.md`（開發指引）和 `docs/prd.md`（產品需求文件），兩者都不適合作為公開的專案介紹。

## Goals / Non-Goals

**Goals:**
- 提供英文版 README.md 作為 GitHub 預設顯示
- 提供繁體中文版 README.zh-TW.md 給台灣開發者
- 涵蓋專案介紹、功能特色、快速開始、架構說明、開發指令

**Non-Goals:**
- 不撰寫 API 文件（已有 CLAUDE.md 涵蓋）
- 不建立 GitHub Pages 或文件網站
- 不新增截圖（可日後補充）

## Decisions

1. **雙語 README 以獨立檔案呈現**
   - `README.md`（英文）+ `README.zh-TW.md`（繁中），頂部互相連結
   - 替代方案：單一檔案雙語混排 → 排版混亂、不易維護
   - 替代方案：只寫英文 → 專案以台灣開發者為主要受眾，需要中文版

2. **引用 `logo/full-logo.svg` 作為頂部 Logo**
   - SVG 格式在 GitHub 上直接渲染，不需額外處理
   - 替代方案：使用 PNG → 需額外轉檔維護

3. **README 內容結構**
   - 參考 GitHub 上主流開源專案的 README 結構
   - 包含：Logo → 一句話簡介 → 功能列表 → Quick Start → 架構 → 開發指令 → License

## Risks / Trade-offs

- SVG Logo 在某些 GitHub 客戶端可能不渲染 → 影響輕微，降級為純文字無礙閱讀
- 中文版需與英文版同步維護 → 內容不多，維護成本低
