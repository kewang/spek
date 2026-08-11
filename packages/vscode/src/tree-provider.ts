import * as vscode from "vscode";
import {
  scanOpenSpec,
  scanOpenSpecAggregated,
  readSpec,
  extractHeadings,
  specHeadingLabel,
} from "@spekjs/core";
import type { SpecInfo, ChangeInfo, Heading } from "@spekjs/core";
import { formatTreeItemDescription } from "./lifecycle";

// --- Specs TreeView ---

type SpecsTreeNode = SpecTreeItem | SpecHeadingItem;

export class SpecsTreeProvider implements vscode.TreeDataProvider<SpecsTreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly workspacePath: string) {}

  // refresh() 重發 onDidChangeTreeData，VS Code 會對目前展開節點重新呼叫 getChildren，
  // 因此每次展開時 readSpec 會讀取最新檔案內容，不需要額外 cache 失效機制。
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SpecsTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SpecsTreeNode): Promise<SpecsTreeNode[]> {
    if (element instanceof SpecTreeItem) {
      try {
        const detail = await readSpec(this.workspacePath, element.topic);
        if (!detail) return [];
        const headings = extractHeadings(detail.content);
        return headings.map((h) => new SpecHeadingItem(element.topic, h));
      } catch {
        return [];
      }
    }

    if (element instanceof SpecHeadingItem) {
      return [];
    }

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
  readonly topic: string;

  constructor(spec: SpecInfo) {
    super(spec.topic, vscode.TreeItemCollapsibleState.Collapsed);
    this.topic = spec.topic;
    this.tooltip = spec.topic;
    this.iconPath = new vscode.ThemeIcon("file-text");
    // 點擊 spec 本體仍開啟完整 spec 頁面；展開 chevron 會列出 heading 子節點
    this.command = {
      command: "spek.navigateTo",
      title: "Open Spec",
      arguments: [`/specs/${spec.topic}`],
    };
  }
}

class SpecHeadingItem extends vscode.TreeItem {
  constructor(topic: string, heading: Heading) {
    // h3 用 description 欄位顯示層級標記，並配合不同 icon 以視覺區分 h2/h3
    //
    // label 與內文一致，不重複 `Requirement:` / `Scenario:`；tooltip 保留原文 —— 這個欄位本來就在，
    // 原文因此在這個 host 免費留得住。跳轉仍用 heading.slug（由原文推導），不受影響。
    super(specHeadingLabel(heading.text), vscode.TreeItemCollapsibleState.None);
    this.tooltip = heading.text;
    this.iconPath = new vscode.ThemeIcon(
      heading.level === 2 ? "symbol-string" : "symbol-field",
    );
    if (heading.level === 3) {
      this.description = "h3";
    }
    this.command = {
      command: "spek.navigateTo",
      title: "Open Heading",
      arguments: [`/specs/${topic}#${heading.slug}`],
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
      // Cross-worktree / jj-workspace aggregation, consistent with the webview Changes page.
      // Both flags are driven by settings: aggregateWorktrees (default on) and aggregateJjWorkspaces
      // (experimental, default off).
      const config = vscode.workspace.getConfiguration("spek");
      const aggregate = config.get<boolean>("aggregateWorktrees", true);
      const includeJj = config.get<boolean>("aggregateJjWorkspaces", false);
      const scan = await scanOpenSpecAggregated(this.workspacePath, { aggregate, includeJj });
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

    // description：lifecycle 資訊 +（非主工作目錄時）來源 + jj `@` 編輯中標記
    const parts: string[] = [];
    const lifecycle = formatTreeItemDescription(change);
    if (lifecycle) parts.push(lifecycle);
    if (change.source && !change.source.isMain) {
      const name = change.source.branch ?? (change.source.vcs === "jj" ? "" : "detached");
      parts.push(change.source.vcs === "jj" ? `jj:${name}` : name);
    }
    if (change.isCurrent) parts.push("✎ editing");
    if (change.conflictsWith) parts.push(`⚠ conflicts with ${change.conflictsWith}`);
    if (parts.length > 0) this.description = parts.join(" · ");

    const tooltipLines = [change.description || change.slug];
    if (change.createdDate) tooltipLines.push(`Created: ${change.createdDate}`);
    if (change.archivedDate) tooltipLines.push(`Archived: ${change.archivedDate}`);
    if (change.source && !change.source.isMain) {
      const kind = change.source.vcs === "jj" ? "jj workspace" : "Worktree";
      tooltipLines.push(`${kind}: ${change.source.branch ?? change.source.path}`);
    }
    if (change.isCurrent) {
      tooltipLines.push("目前 jj working copy (@) 正在編輯這個 change");
    }
    if (change.conflictsWith) {
      tooltipLines.push(`此版本與 ${change.conflictsWith} 的內容分歧（conflicts）`);
    }
    this.tooltip = tooltipLines.join("\n");

    this.iconPath = new vscode.ThemeIcon(
      change.status === "active" ? "edit" : "check",
    );
    // 聚合時帶 ?wt= 讓詳細頁能從正確的 worktree 讀取
    const route = change.source
      ? `/changes/${change.slug}?wt=${change.source.key}`
      : `/changes/${change.slug}`;
    this.command = {
      command: "spek.navigateTo",
      title: "Open Change",
      arguments: [route],
    };
  }
}
