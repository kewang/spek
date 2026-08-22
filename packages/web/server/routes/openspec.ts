import { Router, Request, Response, NextFunction } from "express";
import Fuse from "fuse.js";
import fs from "node:fs";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import {
  scanOpenSpec,
  scanOpenSpecAggregated,
  readSpec,
  readChange,
  readSpecAtChange,
  resyncTimestamps,
  buildGraphDataAggregated,
  listWorkspaces,
  toWorktreeSource,
  listChangeArtifactFiles,
  listSchemas,
  readSchema,
  groupSchemaUsage,
  countSchemaUsage,
  clearSchemaCache,
  affectsSchemas,
  shouldUsePolling,
  pollingInterval,
  withAuthoritativeChokidarEnv,
} from "@spekjs/core";

// --- File watcher 共享管理 ---

interface WatcherEntry {
  watcher: FSWatcher;
  clients: Set<Response>;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

const watchers = new Map<string, WatcherEntry>();

// 聚合時 watchDirs 含全部 worktree；非聚合時只含指定目錄。key 區分不同的監看集合。
// `repoRoot` is the directory being viewed — the only repo whose schema cache this watcher may drop.
function getOrCreateWatcher(key: string, watchDirs: string[], repoRoot: string): WatcherEntry {
  const existing = watchers.get(key);
  if (existing) return existing;

  const watchPaths = watchDirs.map((d) => path.join(d, "openspec"));
  // 任一監看路徑落在不傳遞原生事件的掛載（9p/drvfs/NFS/CIFS 等，常見於 devcontainer/WSL）
  // 時改用 polling，否則 inotify 收不到事件、live-reload 靜默失效。
  const usePolling = watchPaths.some((p) => shouldUsePolling(p));
  const interval = pollingInterval();
  // chokidar 5.x 建構時會事後重讀 CHOKIDAR_USEPOLLING / CHOKIDAR_INTERVAL 覆寫我們傳入的
  // usePolling / interval，因此在建立期間把 env 對齊到權威決定，讓 @spekjs/core 判定為準。
  const watcher = withAuthoritativeChokidarEnv(usePolling, interval, () =>
    chokidar.watch(watchPaths, {
      ignored: (filePath: string) => {
        // 只監聽 .md 和 .yaml 檔案（以及目錄）
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

  const entry: WatcherEntry = { watcher, clients: new Set(), debounceTimer: null };

  // The schema cache must be dropped before clients are told to refetch, or live-reload reports
  // success while serving the pre-edit copy. Narrowed to events that can have changed it, to this
  // repo's entries, and to once per debounce window — none of which affects that ordering.
  let schemasDirty = false;

  const notifyClients = (filePath: string) => {
    if (affectsSchemas(filePath)) schemasDirty = true;
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null;
      if (schemasDirty) {
        schemasDirty = false;
        clearSchemaCache(repoRoot);
      }
      for (const client of entry.clients) {
        client.write(`data: ${JSON.stringify({ type: "changed" })}\n\n`);
      }
    }, 500);
  };

  watcher.on("add", notifyClients);
  watcher.on("change", notifyClients);
  watcher.on("unlink", notifyClients);

  watchers.set(key, entry);
  return entry;
}

function removeClient(key: string, client: Response) {
  const entry = watchers.get(key);
  if (!entry) return;
  entry.clients.delete(client);
  if (entry.clients.size === 0) {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.watcher.close();
    watchers.delete(key);
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
  const aggregate = req.query.aggregate !== "false";
  const includeJj = req.query.jj === "true";
  const scan = await scanOpenSpecAggregated(dir, { aggregate, includeJj });

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
  const aggregate = req.query.aggregate !== "false";
  const includeJj = req.query.jj === "true";
  const scan = await scanOpenSpecAggregated(dir, { aggregate, includeJj });
  res.json({
    active: scan.activeChanges,
    archived: scan.archivedChanges,
    worktrees: scan.worktrees,
    aggregated: scan.aggregated,
    defaultSchema: scan.defaultSchema,
  });
});

openspecRouter.get("/changes/:slug", async (req, res) => {
  const dir = req.query.dir as string;
  const wt = req.query.wt as string | undefined;

  // 指定 wt 時，解析對應 worktree 路徑後再讀；否則沿用 dir
  let targetDir = dir;
  let source: ReturnType<typeof toWorktreeSource> | undefined;
  if (wt) {
    const match = (await listWorkspaces(dir)).find((w) => w.key === wt);
    if (match) {
      targetDir = match.path;
      source = toWorktreeSource(match);
    }
  }

  const result = await readChange(targetDir, req.params.slug);
  if (!result) {
    res.status(404).json({ error: "Change not found" });
    return;
  }
  if (source) result.source = source;
  res.json(result);
});

// Schemas: the catalog joined with the changes using it. Aggregation params mirror /changes so the
// counts on the two pages agree; schema *resolution* is deliberately not aggregated — a schema is a
// property of the repo spek was pointed at, a change is not.
openspecRouter.get("/schemas", async (req, res) => {
  const dir = req.query.dir as string;
  const aggregate = req.query.aggregate !== "false";
  const includeJj = req.query.jj === "true";

  const [catalog, scan] = await Promise.all([
    listSchemas(dir),
    scanOpenSpecAggregated(dir, { aggregate, includeJj }),
  ]);

  // 200, not 5xx: losing the CLI does not fail the request, it empties the answer. The catalog is
  // the CLI's alone — including for the repo's own openspec/schemas/ — so a degraded read is an
  // empty list plus a `degradedReason`, which is a statement the view can render rather than an
  // error it must handle. What it must not do is present that emptiness as a fact about the repo.
  // Reading a single schema is the case that can genuinely fail; that one 404s (below).
  res.json(groupSchemaUsage(catalog, scan.activeChanges));
});

// The definition plus its usage count, so the detail view needs no second request for the catalog.
// Aggregation params mirror /schemas, or the count would disagree with the row clicked through from.
openspecRouter.get("/schemas/:name", async (req, res) => {
  const dir = req.query.dir as string;
  const aggregate = req.query.aggregate !== "false";
  const includeJj = req.query.jj === "true";

  const [result, scan] = await Promise.all([
    readSchema(dir, req.params.name),
    scanOpenSpecAggregated(dir, { aggregate, includeJj }),
  ]);
  if (result.ok) {
    res.json({ ...result.schema, usage: countSchemaUsage(scan.activeChanges, req.params.name) });
    return;
  }
  // "we could not look" and "it does not exist" are different problems; both are 404 to the client,
  // but the reason distinguishes them so the view can say which.
  res.status(404).json({ error: "Schema not found", reason: result.reason });
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

  // 收集 changes 內容（active + archived）：索引每個 change 內所有 root *.md artifact，
  // 不再限定 proposal/design/tasks，使自訂 schema 的 brainstorm/plan/verify 等也可被搜尋
  const changesDir = path.join(openspecBase, "changes");
  const collectChanges = (baseDir: string) => {
    if (!fs.existsSync(baseDir)) return;
    for (const slug of fs.readdirSync(baseDir)) {
      if (slug === "archive") continue;
      const changePath = path.join(baseDir, slug);
      if (!fs.statSync(changePath).isDirectory()) continue;

      // Index every root artifact file of the change (markdown, tasks, and data), from the same
      // @spekjs/core list the tabs and the count use. So any tab that comes from a root file is
      // searchable. The specs delta tree is not indexed here, as before.
      for (const file of listChangeArtifactFiles(changePath)) {
        documents.push({
          type: "change",
          name: slug,
          content: fs.readFileSync(path.join(changePath, file), "utf-8"),
        });
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

openspecRouter.get("/graph", async (req, res) => {
  const dir = req.query.dir as string;
  const aggregate = req.query.aggregate !== "false";
  const includeJj = req.query.jj === "true";
  const graphData = await buildGraphDataAggregated(dir, { aggregate, includeJj });
  res.json(graphData);
});

// List working directories (git worktrees + jj workspaces) only — no change scan. Feeds the global
// header aggregation-scope control (visibility + whether a jj option is available), so it never runs
// the full /changes scan just to learn the worktree list.
openspecRouter.get("/worktrees", async (req, res) => {
  const dir = req.query.dir as string;
  const includeJj = req.query.jj === "true";
  const worktrees = await listWorkspaces(dir, { includeJj });
  res.json(worktrees);
});

// --- SSE file watching endpoint ---

openspecRouter.get("/watch", async (req, res) => {
  const dir = req.query.dir as string;
  const aggregate = req.query.aggregate !== "false";
  const includeJj = req.query.jj === "true";

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 送一個初始 comment 確認連線
  res.write(": connected\n\n");

  // 聚合時監看所有工作目錄（git worktree 與 jj workspace）的 openspec/，任一變動都推送更新
  let watchDirs = [dir];
  if (aggregate) {
    const worktrees = await listWorkspaces(dir, { includeJj });
    if (worktrees.length > 1) {
      watchDirs = worktrees.map((w) => w.path);
    }
  }
  const key = `${dir}::${aggregate}::${includeJj}`;
  const entry = getOrCreateWatcher(key, watchDirs, dir);
  entry.clients.add(res);

  req.on("close", () => {
    removeClient(key, res);
  });
});

openspecRouter.post("/resync", async (req, res) => {
  const dir = req.query.dir as string;
  await resyncTimestamps(dir);
  // Schemas resolve from three places, and only one of them — this repo's openspec/schemas/ — is
  // watched. A schema promoted from the repo to the machine-global directory, or edited there,
  // produces no filesystem event spek can see, so Refresh has to be the authoritative way to pick
  // it up rather than leaving the reader to wait out a cache TTL.
  clearSchemaCache();
  res.json({ ok: true });
});
