import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { MessageHandler } from "./handler";
import { watchOpenspecDir } from "./watcher";
import { listWorkspaces } from "@spekjs/core";

export class SpekPanel {
  private static instance: SpekPanel | undefined;
  private panel: vscode.WebviewPanel;
  private handler: MessageHandler;
  private disposables: vscode.Disposable[] = [];
  private webviewReady = false;
  private pendingMessages: unknown[] = [];
  private disposed = false;
  private fileChangeTimer: ReturnType<typeof setTimeout> | undefined;

  private constructor(
    private readonly context: vscode.ExtensionContext,
  ) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

    this.panel = vscode.window.createWebviewPanel(
      "spek",
      "spek",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "webview"),
        ],
      },
    );

    // Tab icon
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "webview", "favicon.svg");

    this.handler = new MessageHandler(workspacePath);

    // 設定 Webview HTML
    this.panel.webview.html = this.getHtml();

    // 處理來自 Webview 的訊息
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type === "ready") {
          // Webview ready，發送 init 訊息
          this.panel.webview.postMessage({
            type: "init",
            workspacePath,
            theme: this.getCurrentTheme(),
          });
          // 標記 ready，flush 等待中的訊息
          this.webviewReady = true;
          for (const pending of this.pendingMessages) {
            this.panel.webview.postMessage(pending);
          }
          this.pendingMessages = [];
          return;
        }

        if (message.type === "request") {
          try {
            const data = await this.handler.handle(message.method, message.params);
            this.panel.webview.postMessage({
              type: "response",
              id: message.id,
              data,
            });
          } catch (err) {
            this.panel.webview.postMessage({
              type: "response",
              id: message.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      },
      null,
      this.disposables,
    );

    // 監聯 theme 變更
    vscode.window.onDidChangeActiveColorTheme(
      (theme) => {
        this.panel.webview.postMessage({
          type: "themeChange",
          theme: theme.kind === vscode.ColorThemeKind.Light ? "light" : "dark",
        });
      },
      null,
      this.disposables,
    );

    // Refresh the webview when an aggregation setting changes, so the header control and the data
    // re-read the new value.
    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (
          e.affectsConfiguration("spek.aggregateWorktrees") ||
          e.affectsConfiguration("spek.aggregateJjWorkspaces")
        ) {
          this.notifyFileChange();
        }
      },
      null,
      this.disposables,
    );

    // 監聽 openspec 檔案變更，通知 webview 刷新。
    // 聚合模式下也監看同 repo 其他 worktree 的 openspec/，任一 worktree 變更都會刷新。
    this.watchOpenspec(workspacePath);
    this.addWorktreeWatchers(workspacePath);

    // Panel 關閉時清理
    this.panel.onDidDispose(
      () => {
        SpekPanel.instance = undefined;
        this.disposed = true;
        this.webviewReady = false;
        this.pendingMessages = [];
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
      },
      null,
      this.disposables,
    );
  }

  // 對指定目錄的 openspec/ 建立檔案監看，變更時 debounce 通知 webview
  private watchOpenspec(dir: string): void {
    if (this.disposed) return;
    const watcher = watchOpenspecDir(dir, () => this.notifyFileChange());
    this.disposables.push(watcher);
  }

  // 聚合模式：為同 repo 其他 worktree 的 openspec/ 也建立監看
  private addWorktreeWatchers(workspacePath: string): void {
    const main = path.resolve(workspacePath);
    const includeJj = vscode.workspace
      .getConfiguration("spek")
      .get<boolean>("aggregateJjWorkspaces", false);
    // 監看 git worktree 與（設定開啟時）jj workspace 的 openspec/，任一變動都觸發更新
    void listWorkspaces(workspacePath, { includeJj }).then((worktrees) => {
      if (this.disposed) return;
      for (const wt of worktrees) {
        if (!wt.isBare && wt.path !== main) {
          this.watchOpenspec(wt.path);
        }
      }
    });
  }

  private notifyFileChange(): void {
    if (this.fileChangeTimer) clearTimeout(this.fileChangeTimer);
    this.fileChangeTimer = setTimeout(() => {
      this.panel.webview.postMessage({ type: "fileChanged" });
    }, 500);
  }

  static createOrShow(context: vscode.ExtensionContext): SpekPanel {
    if (SpekPanel.instance) {
      SpekPanel.instance.panel.reveal();
      return SpekPanel.instance;
    }
    SpekPanel.instance = new SpekPanel(context);
    return SpekPanel.instance;
  }

  static dispose() {
    SpekPanel.instance?.panel.dispose();
    SpekPanel.instance = undefined;
  }

  postMessage(message: unknown) {
    if (this.webviewReady) {
      this.panel.webview.postMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  navigateTo(routePath: string) {
    this.panel.reveal();
    const msg = { type: "navigate", path: routePath };
    if (this.webviewReady) {
      this.panel.webview.postMessage(msg);
    } else {
      this.pendingMessages.push(msg);
    }
  }

  private getCurrentTheme(): "dark" | "light" {
    return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light
      ? "light"
      : "dark";
  }

  private getHtml(): string {
    const webviewDir = vscode.Uri.joinPath(this.context.extensionUri, "webview");
    const indexPath = path.join(webviewDir.fsPath, "index.webview.html");

    if (!fs.existsSync(indexPath)) {
      return `<!DOCTYPE html><html><body><h1>spek webview assets not found</h1><p>Run build first.</p></body></html>`;
    }

    const nonce = getNonce();
    const webview = this.panel.webview;
    const cspSource = webview.cspSource;

    // 將 /assets/... 路徑轉為 webview URI
    const assetsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewDir, "assets"),
    );

    // CSP：允許 nonce script + 外部 style + unsafe-inline style（Tailwind 需要）
    const csp = [
      `default-src 'none'`,
      `style-src ${cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${cspSource}`,
      `img-src ${cspSource} data:`,
    ].join("; ");

    // 組裝最終 HTML（CSS 由 Vite IIFE build inline 到 JS 中，以 <style> 注入）
    const finalHtml = `<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>spek</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${assetsUri}/index.webview.js"></script>
  </body>
</html>`;

    return finalHtml;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
