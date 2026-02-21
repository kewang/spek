import { Router, Request, Response, NextFunction } from "express";
import Fuse from "fuse.js";
import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";
import { scanOpenSpec, readSpec, readChange, readSpecAtChange, resyncTimestamps, buildGraphData } from "@spek/core";

// --- File watcher 共享管理 ---

interface WatcherEntry {
  watcher: chokidar.FSWatcher;
  clients: Set<Response>;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

const watchers = new Map<string, WatcherEntry>();

function getOrCreateWatcher(dir: string): WatcherEntry {
  const existing = watchers.get(dir);
  if (existing) return existing;

  const watchPath = path.join(dir, "openspec");
  const watcher = chokidar.watch(watchPath, {
    ignored: (filePath: string) => {
      // 只監聽 .md 和 .yaml 檔案（以及目錄）
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return !filePath.endsWith(".md") && !filePath.endsWith(".yaml");
      }
      return false;
    },
    ignoreInitial: true,
    persistent: true,
  });

  const entry: WatcherEntry = { watcher, clients: new Set(), debounceTimer: null };

  const notifyClients = () => {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null;
      for (const client of entry.clients) {
        client.write(`data: ${JSON.stringify({ type: "changed" })}\n\n`);
      }
    }, 500);
  };

  watcher.on("add", notifyClients);
  watcher.on("change", notifyClients);
  watcher.on("unlink", notifyClients);

  watchers.set(dir, entry);
  return entry;
}

function removeClient(dir: string, client: Response) {
  const entry = watchers.get(dir);
  if (!entry) return;
  entry.clients.delete(client);
  if (entry.clients.size === 0) {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.watcher.close();
    watchers.delete(dir);
  }
}

export const openspecRouter = Router();

// 所有 openspec routes 需要 dir 參數
openspecRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.query.dir) {
    res.status(400).json({ error: "dir parameter is required" });
    return;
  }
  next();
});

openspecRouter.get("/overview", async (req, res) => {
  const dir = req.query.dir as string;
  const scan = await scanOpenSpec(dir);

  let totalTasks = 0;
  let completedTasks = 0;
  for (const change of [...scan.activeChanges, ...scan.archivedChanges]) {
    if (change.taskStats) {
      totalTasks += change.taskStats.total;
      completedTasks += change.taskStats.completed;
    }
  }

  res.json({
    specsCount: scan.specs.length,
    changesCount: {
      active: scan.activeChanges.length,
      archived: scan.archivedChanges.length,
    },
    taskStats: { total: totalTasks, completed: completedTasks },
  });
});

openspecRouter.get("/specs", async (req, res) => {
  const dir = req.query.dir as string;
  const scan = await scanOpenSpec(dir);
  res.json(scan.specs);
});

openspecRouter.get("/specs/:topic", async (req, res) => {
  const dir = req.query.dir as string;
  const result = await readSpec(dir, req.params.topic);
  if (!result) {
    res.status(404).json({ error: "Spec not found" });
    return;
  }
  res.json(result);
});

openspecRouter.get("/specs/:topic/at/:slug", (req, res) => {
  const dir = req.query.dir as string;
  const result = readSpecAtChange(dir, req.params.topic, req.params.slug);
  if (!result) {
    res.status(404).json({ error: "Spec version not found" });
    return;
  }
  res.json(result);
});

openspecRouter.get("/changes", async (req, res) => {
  const dir = req.query.dir as string;
  const scan = await scanOpenSpec(dir);
  res.json({
    active: scan.activeChanges,
    archived: scan.archivedChanges,
  });
});

openspecRouter.get("/changes/:slug", (req, res) => {
  const dir = req.query.dir as string;
  const result = readChange(dir, req.params.slug);
  if (!result) {
    res.status(404).json({ error: "Change not found" });
    return;
  }
  res.json(result);
});

interface SearchDocument {
  type: "spec" | "change";
  name: string;
  content: string;
}

openspecRouter.get("/search", (req, res) => {
  const dir = req.query.dir as string;
  const q = req.query.q as string;

  if (!q) {
    res.status(400).json({ error: "q parameter is required" });
    return;
  }

  const documents: SearchDocument[] = [];
  const openspecBase = path.join(dir, "openspec");

  // 收集 specs 內容
  const specsDir = path.join(openspecBase, "specs");
  if (fs.existsSync(specsDir)) {
    for (const topic of fs.readdirSync(specsDir)) {
      const specPath = path.join(specsDir, topic, "spec.md");
      if (fs.existsSync(specPath)) {
        documents.push({
          type: "spec",
          name: topic,
          content: fs.readFileSync(specPath, "utf-8"),
        });
      }
    }
  }

  // 收集 changes 內容（active + archived）
  const changesDir = path.join(openspecBase, "changes");
  const collectChanges = (baseDir: string) => {
    if (!fs.existsSync(baseDir)) return;
    for (const slug of fs.readdirSync(baseDir)) {
      if (slug === "archive") continue;
      const changePath = path.join(baseDir, slug);
      if (!fs.statSync(changePath).isDirectory()) continue;

      const files = ["proposal.md", "design.md", "tasks.md"];
      for (const file of files) {
        const filePath = path.join(changePath, file);
        if (fs.existsSync(filePath)) {
          documents.push({
            type: "change",
            name: slug,
            content: fs.readFileSync(filePath, "utf-8"),
          });
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

  const results = fuse.search(q);

  const response = results.map((r) => {
    const matches =
      r.matches?.map((m) => {
        const value = m.value || "";
        const indices = m.indices || [];
        return indices.slice(0, 3).map(([start, end]) => {
          const contextStart = Math.max(0, start - 100);
          const contextEnd = Math.min(value.length, end + 101);
          return value.slice(contextStart, contextEnd);
        });
      }).flat() || [];

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

  res.json(response);
});

openspecRouter.get("/graph", (req, res) => {
  const dir = req.query.dir as string;
  const graphData = buildGraphData(dir);
  res.json(graphData);
});

// --- SSE file watching endpoint ---

openspecRouter.get("/watch", (req, res) => {
  const dir = req.query.dir as string;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 送一個初始 comment 確認連線
  res.write(": connected\n\n");

  const entry = getOrCreateWatcher(dir);
  entry.clients.add(res);

  req.on("close", () => {
    removeClient(dir, res);
  });
});

openspecRouter.post("/resync", async (req, res) => {
  const dir = req.query.dir as string;
  await resyncTimestamps(dir);
  res.json({ ok: true });
});
