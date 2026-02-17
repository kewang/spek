import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import Fuse from "fuse.js";
import {
  scanOpenSpec,
  readSpec,
  readChange,
  readSpecAtChange,
  resyncTimestamps,
} from "@spek/core";

export class MessageHandler {
  constructor(private readonly workspacePath: string) {}

  async handle(method: string, params?: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case "getOverview":
        return this.getOverview();
      case "getSpecs":
        return this.getSpecs();
      case "getSpec":
        return this.getSpec(params?.topic as string);
      case "getSpecAtChange":
        return this.getSpecAtChange(params?.topic as string, params?.slug as string);
      case "getChanges":
        return this.getChanges();
      case "getChange":
        return this.getChange(params?.slug as string);
      case "search":
        return this.search(params?.query as string);
      case "browse":
        return this.browse(params?.path as string);
      case "detect":
        return this.detect(params?.path as string);
      case "resync":
        return this.resync();
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private getOverview() {
    const scan = scanOpenSpec(this.workspacePath);
    let totalTasks = 0;
    let completedTasks = 0;
    for (const change of [...scan.activeChanges, ...scan.archivedChanges]) {
      if (change.taskStats) {
        totalTasks += change.taskStats.total;
        completedTasks += change.taskStats.completed;
      }
    }
    return {
      specsCount: scan.specs.length,
      changesCount: {
        active: scan.activeChanges.length,
        archived: scan.archivedChanges.length,
      },
      taskStats: { total: totalTasks, completed: completedTasks },
    };
  }

  private getSpecs() {
    const scan = scanOpenSpec(this.workspacePath);
    return scan.specs;
  }

  private async getSpec(topic: string) {
    const result = await readSpec(this.workspacePath, topic);
    if (!result) throw new Error("Spec not found");
    return result;
  }

  private getSpecAtChange(topic: string, slug: string) {
    const result = readSpecAtChange(this.workspacePath, topic, slug);
    if (!result) throw new Error("Spec version not found");
    return result;
  }

  private getChanges() {
    const scan = scanOpenSpec(this.workspacePath);
    return {
      active: scan.activeChanges,
      archived: scan.archivedChanges,
    };
  }

  private getChange(slug: string) {
    const result = readChange(this.workspacePath, slug);
    if (!result) throw new Error("Change not found");
    return result;
  }

  private search(query: string) {
    if (!query) throw new Error("query is required");

    interface SearchDocument {
      type: "spec" | "change";
      name: string;
      content: string;
    }

    const documents: SearchDocument[] = [];
    const openspecBase = path.join(this.workspacePath, "openspec");

    // 收集 specs
    const specsDir = path.join(openspecBase, "specs");
    if (fs.existsSync(specsDir)) {
      for (const topic of fs.readdirSync(specsDir)) {
        const specPath = path.join(specsDir, topic, "spec.md");
        if (fs.existsSync(specPath)) {
          documents.push({ type: "spec", name: topic, content: fs.readFileSync(specPath, "utf-8") });
        }
      }
    }

    // 收集 changes
    const changesDir = path.join(openspecBase, "changes");
    const collectChanges = (baseDir: string) => {
      if (!fs.existsSync(baseDir)) return;
      for (const slug of fs.readdirSync(baseDir)) {
        if (slug === "archive") continue;
        const changePath = path.join(baseDir, slug);
        if (!fs.statSync(changePath).isDirectory()) continue;
        for (const file of ["proposal.md", "design.md", "tasks.md"]) {
          const filePath = path.join(changePath, file);
          if (fs.existsSync(filePath)) {
            documents.push({ type: "change", name: slug, content: fs.readFileSync(filePath, "utf-8") });
          }
        }
      }
    };
    collectChanges(changesDir);
    collectChanges(path.join(changesDir, "archive"));

    const fuse = new Fuse(documents, {
      keys: ["content"],
      includeScore: true,
      includeMatches: true,
      threshold: 0.4,
    });

    const results = fuse.search(query);
    return results.map((r) => {
      const matches = r.matches?.flatMap((m) => {
        const value = m.value || "";
        const indices = m.indices || [];
        return indices.slice(0, 3).map(([start, end]) => {
          const contextStart = Math.max(0, start - 100);
          const contextEnd = Math.min(value.length, end + 101);
          return value.slice(contextStart, contextEnd);
        });
      }) || [];
      const name = r.item.name;
      const title = r.item.type === "change"
        ? name.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ")
        : name;
      return {
        type: r.item.type,
        title,
        topic: r.item.type === "spec" ? name : undefined,
        slug: r.item.type === "change" ? name : undefined,
        context: matches[0] || "",
      };
    });
  }

  private browse(dirPath?: string) {
    const resolved = path.resolve(dirPath || os.homedir());
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Directory not found: ${resolved}`);
    }
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const items = entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
        path: path.join(resolved, e.name),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return { path: resolved, entries: items };
  }

  private detect(dirPath: string) {
    if (!dirPath) throw new Error("path is required");
    const resolved = path.resolve(dirPath);
    const configPath = path.join(resolved, "openspec", "config.yaml");
    if (!fs.existsSync(configPath)) {
      return { hasOpenSpec: false };
    }
    const content = fs.readFileSync(configPath, "utf-8");
    const schemaMatch = content.match(/^schema:\s*(.+)$/m);
    return { hasOpenSpec: true, schema: schemaMatch ? schemaMatch[1].trim() : "unknown" };
  }

  private async resync() {
    await resyncTimestamps(this.workspacePath);
    return { ok: true };
  }
}
