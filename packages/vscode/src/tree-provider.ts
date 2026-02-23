import * as vscode from "vscode";
import { scanOpenSpec } from "@spek/core";
import type { SpecInfo, ChangeInfo } from "@spek/core";

// --- Specs TreeView ---

export class SpecsTreeProvider implements vscode.TreeDataProvider<SpecTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly workspacePath: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SpecTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<SpecTreeItem[]> {
    try {
      const scan = await scanOpenSpec(this.workspacePath);
      return scan.specs
        .sort((a, b) => a.topic.localeCompare(b.topic))
        .map((spec) => new SpecTreeItem(spec));
    } catch {
      return [];
    }
  }
}

class SpecTreeItem extends vscode.TreeItem {
  constructor(spec: SpecInfo) {
    super(spec.topic, vscode.TreeItemCollapsibleState.None);
    this.tooltip = spec.topic;
    this.iconPath = new vscode.ThemeIcon("file-text");
    this.command = {
      command: "spek.navigateTo",
      title: "Open Spec",
      arguments: [`/specs/${spec.topic}`],
    };
  }
}

// --- Changes TreeView ---

type ChangesTreeNode = ChangeGroupItem | ChangeTreeItem;

export class ChangesTreeProvider implements vscode.TreeDataProvider<ChangesTreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly workspacePath: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ChangesTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ChangesTreeNode): Promise<ChangesTreeNode[]> {
    if (element instanceof ChangeGroupItem) {
      return element.changes.map((c) => new ChangeTreeItem(c));
    }

    try {
      const scan = await scanOpenSpec(this.workspacePath);
      const groups: ChangeGroupItem[] = [];

      if (scan.activeChanges.length > 0) {
        groups.push(new ChangeGroupItem("Active", scan.activeChanges));
      }
      if (scan.archivedChanges.length > 0) {
        groups.push(new ChangeGroupItem("Archived", scan.archivedChanges));
      }

      return groups;
    } catch {
      return [];
    }
  }
}

class ChangeGroupItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly changes: ChangeInfo[],
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(
      label === "Active" ? "git-branch" : "archive",
    );
    this.description = `${changes.length}`;
  }
}

class ChangeTreeItem extends vscode.TreeItem {
  constructor(change: ChangeInfo) {
    super(change.slug, vscode.TreeItemCollapsibleState.None);
    this.tooltip = change.description || change.slug;
    this.iconPath = new vscode.ThemeIcon(
      change.status === "active" ? "edit" : "check",
    );
    this.command = {
      command: "spek.navigateTo",
      title: "Open Change",
      arguments: [`/changes/${change.slug}`],
    };
  }
}
