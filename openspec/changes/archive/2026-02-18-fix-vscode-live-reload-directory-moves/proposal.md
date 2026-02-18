## Why

VS Code 版的 live-reload 在目錄搬移（如 `mv` archive）時不會觸發更新。原因是 `FileSystemWatcher` 的 glob `openspec/**/*.{md,yaml}` 只匹配檔案，但 `mv` 整個目錄時 OS 層級是目錄 rename，不會對個別檔案觸發 create/delete 事件。Web 版的 chokidar 則能正確偵測。

## What Changes

- 將 VS Code `FileSystemWatcher` 的 glob 從 `openspec/**/*.{md,yaml}` 改為 `openspec/**`，捕捉所有變更包含目錄操作

## Capabilities

### New Capabilities

（無）

### Modified Capabilities
- `live-reload`: FileSystemWatcher glob 放寬為 `openspec/**` 以涵蓋目錄層級的變更事件

## Impact

- **VS Code Extension** (`packages/vscode/src/panel.ts`): 修改一行 glob pattern
- 不影響 Web 版和 Demo 版
