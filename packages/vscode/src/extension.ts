import * as vscode from "vscode";
import { SpekPanel } from "./panel";

let statusBarItem: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext) {
  // 偵測 workspace 是否有 openspec/
  const workspacePath = getWorkspacePath();
  const hasOpenSpec = workspacePath ? hasOpenSpecDir(workspacePath) : false;

  // 註冊 commands
  context.subscriptions.push(
    vscode.commands.registerCommand("spek.open", () => {
      SpekPanel.createOrShow(context);
    }),
    vscode.commands.registerCommand("spek.search", () => {
      const panel = SpekPanel.createOrShow(context);
      // 等 Webview ready 後發送搜尋指令
      panel.postMessage({ type: "openSearch" });
    }),
  );

  // 有 openspec/ 時顯示 status bar icon
  if (hasOpenSpec) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    statusBarItem.text = "$(book) spek";
    statusBarItem.tooltip = "Open spek — OpenSpec Viewer";
    statusBarItem.command = "spek.open";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
  }
}

export function deactivate() {
  SpekPanel.dispose();
  statusBarItem?.dispose();
  statusBarItem = undefined;
}

function getWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function hasOpenSpecDir(workspacePath: string): boolean {
  const configUri = vscode.Uri.joinPath(
    vscode.Uri.file(workspacePath),
    "openspec",
    "config.yaml",
  );
  try {
    // 同步存取不可用，用 vscode.workspace.fs 是 async
    // 但在 activate 中用 require('fs') 是安全的
    const fs = require("fs");
    return fs.existsSync(configUri.fsPath);
  } catch {
    return false;
  }
}
