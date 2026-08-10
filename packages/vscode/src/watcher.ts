import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { watch } from "chokidar";
import { shouldUsePolling, pollingInterval, withAuthoritativeChokidarEnv } from "@spekjs/core";

/**
 * 對 `<dir>/openspec` 建立 chokidar 檔案監看，任一相關事件都呼叫 `onChange`。
 *
 * 改用 chokidar（取代 `vscode.workspace.createFileSystemWatcher`）的原因：
 * VS Code 的遞迴 watcher 在 Linux 底層是 `@parcel/watcher`，對 agent 連續快速
 * 建立的巢狀目錄（如 `changes/<slug>/specs/<topic>/`）來不及掛上 inotify watch，
 * 會漏掉其中 `spec.md` 的新建與後續編輯；chokidar 收到新目錄後會重新掃描補發
 * 事件。設定比照 `packages/web/server/routes/openspec.ts`。
 */
export function watchOpenspecDir(
  dir: string,
  onChange: (filePath: string) => void,
): vscode.Disposable {
  const openspecPath = path.join(dir, "openspec");

  // 被監看路徑落在不傳遞原生事件的掛載（9p/drvfs 等，devcontainer/WSL）時改用 polling。
  // VS Code 在 remote（dev-container / wsl / ssh / codespaces）時 `remoteName` 非 undefined，
  // 當 fstype 無法判定時可作為保底訊號。
  const usePolling = shouldUsePolling(openspecPath, {
    extraRemoteIndicator: vscode.env.remoteName !== undefined,
  });
  const interval = pollingInterval();

  // chokidar 5.x 建構時會事後重讀 CHOKIDAR_USEPOLLING / CHOKIDAR_INTERVAL 覆寫我們傳入的
  // usePolling / interval；在建立期間把 env 對齊到權威決定（extension host 為共享 process，
  // 用即時 set→restore 而非永久改 env，避免影響其它擴充套件）。
  const watcher = withAuthoritativeChokidarEnv(usePolling, interval, () =>
    watch(openspecPath, {
      ignored: (filePath: string) => {
        // 只監看 .md 與 .yaml 檔案；目錄一律不忽略，才能遞迴進去
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          return !filePath.endsWith(".md") && !filePath.endsWith(".yaml");
        }
        return false;
      },
      ignoreInitial: true,
      persistent: true,
      usePolling,
      interval,
      binaryInterval: interval,
    }),
  );

  // 一併監聽目錄事件（addDir/unlinkDir），涵蓋僅目錄變動的情況
  const events = ["add", "addDir", "change", "unlink", "unlinkDir"] as const;
  for (const event of events) {
    watcher.on(event, onChange);
  }

  return { dispose: () => void watcher.close() };
}
