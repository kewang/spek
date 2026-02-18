## Overview

單行修正：將 `SpekPanel` 的 `FileSystemWatcher` glob 從 `openspec/**/*.{md,yaml}` 改為 `openspec/**`。

## Key Decisions

### 為何用 `openspec/**` 而非更精確的 pattern？

`vscode.workspace.createFileSystemWatcher` 底層使用 OS 的 inotify (Linux) / FSEvents (macOS)。目錄 rename（`mv`）只在父目錄層觸發事件，不會為子目錄內的個別檔案觸發 create/delete。使用 `openspec/**` 可以捕捉到目錄層級的變更。

搭配既有的 500ms debounce，即使收到較多事件也不會造成效能問題。

## File Changes

| 檔案 | 變更 |
|------|------|
| `packages/vscode/src/panel.ts` | glob pattern 從 `openspec/**/*.{md,yaml}` 改為 `openspec/**` |
