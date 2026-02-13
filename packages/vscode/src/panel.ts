import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { MessageHandler } from "./handler";

export class SpekPanel {
  private static instance: SpekPanel | undefined;
  private panel: vscode.WebviewPanel;
  private handler: MessageHandler;
  private disposables: vscode.Disposable[] = [];

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

    // 監聽 theme 變更
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

    // Panel 關閉時清理
    this.panel.onDidDispose(
      () => {
        SpekPanel.instance = undefined;
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
      },
      null,
      this.disposables,
    );
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
    this.panel.webview.postMessage(message);
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

    const html = fs.readFileSync(indexPath, "utf-8");
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
