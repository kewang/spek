import * as vscode from "vscode";
import { SpekPanel } from "./panel";
import { SpecsTreeProvider, ChangesTreeProvider } from "./tree-provider";

let statusBarItem: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext) {
  // 偵測 workspace 是否有 openspec/
  const workspacePath = getWorkspacePath();
  const hasOpenSpec = workspacePath ? hasOpenSpecDir(workspacePath) : false;

  // 設定 context key 供 when clause 使用
  vscode.commands.executeCommand("setContext", "spek.hasOpenSpec", hasOpenSpec);

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
    vscode.commands.registerCommand("spek.openDashboard", () => {
      const panel = SpekPanel.createOrShow(context);
      panel.navigateTo("/dashboard");
    }),
    vscode.commands.registerCommand("spek.navigateTo", (routePath: string) => {
      const panel = SpekPanel.createOrShow(context);
      panel.navigateTo(routePath);
    }),
  );

  // 有 openspec/ 時顯示 status bar icon 和註冊 TreeView
  if (hasOpenSpec && workspacePath) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    statusBarItem.text = "$(book) spek";
    statusBarItem.tooltip = "Open spek — OpenSpec Viewer";
    statusBarItem.command = "spek.open";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 註冊 TreeView providers
    const specsProvider = new SpecsTreeProvider(workspacePath);
    const changesProvider = new ChangesTreeProvider(workspacePath);

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider("spek.specsView", specsProvider),
      vscode.window.registerTreeDataProvider("spek.changesView", changesProvider),
    );

    // 監聽 openspec/ 檔案變更，觸發 TreeView 更新
    const treeWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspacePath, "openspec/**"),
    );
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshTree = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        specsProvider.refresh();
        changesProvider.refresh();
      }, 500);
    };
    treeWatcher.onDidCreate(refreshTree);
    treeWatcher.onDidChange(refreshTree);
    treeWatcher.onDidDelete(refreshTree);
    context.subscriptions.push(treeWatcher);
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
