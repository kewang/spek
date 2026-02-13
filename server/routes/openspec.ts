import { Router, Request, Response, NextFunction } from "express";
import Fuse from "fuse.js";
import fs from "node:fs";
import path from "node:path";
import { scanOpenSpec, readSpec, readChange } from "../lib/scanner.js";

export const openspecRouter = Router();

// 所有 openspec routes 需要 dir 參數
openspecRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.query.dir) {
    res.status(400).json({ error: "dir parameter is required" });
    return;
  }
  next();
});

openspecRouter.get("/overview", (req, res) => {
  const dir = req.query.dir as string;
  const scan = scanOpenSpec(dir);

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

openspecRouter.get("/specs", (req, res) => {
  const dir = req.query.dir as string;
  const scan = scanOpenSpec(dir);
  res.json(scan.specs);
});

openspecRouter.get("/specs/:topic", (req, res) => {
  const dir = req.query.dir as string;
  const result = readSpec(dir, req.params.topic);
  if (!result) {
    res.status(404).json({ error: "Spec not found" });
    return;
  }
  res.json(result);
});

openspecRouter.get("/changes", (req, res) => {
  const dir = req.query.dir as string;
  const scan = scanOpenSpec(dir);
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

    return {
      type: r.item.type,
      name: r.item.name,
      score: r.score,
      matches,
    };
  });

  res.json(response);
});
