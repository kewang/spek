import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const filesystemRouter = Router();

filesystemRouter.get("/browse", (req, res) => {
  const dirPath = (req.query.path as string) || os.homedir();
  const resolved = path.resolve(dirPath);

  if (!fs.existsSync(resolved)) {
    res.status(400).json({ error: `Directory not found: ${resolved}` });
    return;
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    res.status(400).json({ error: `Not a directory: ${resolved}` });
    return;
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

  res.json({ path: resolved, entries: items });
});

filesystemRouter.get("/detect", (req, res) => {
  const dirPath = req.query.path as string;
  if (!dirPath) {
    res.status(400).json({ error: "path parameter is required" });
    return;
  }

  const resolved = path.resolve(dirPath);
  const openspecDir = path.join(resolved, "openspec");
  const configPath = path.join(openspecDir, "config.yaml");

  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf-8");
    const schemaMatch = content.match(/^schema:\s*(.+)$/m);
    const schema = schemaMatch ? schemaMatch[1].trim() : "unknown";
    res.json({ hasOpenSpec: true, schema });
    return;
  }

  // Fallback: 檢查 openspec/specs/ 或 openspec/changes/ 是否存在
  const hasSpecs = fs.existsSync(path.join(openspecDir, "specs"));
  const hasChanges = fs.existsSync(path.join(openspecDir, "changes"));
  if (hasSpecs || hasChanges) {
    res.json({ hasOpenSpec: true, schema: "unknown" });
    return;
  }

  res.json({ hasOpenSpec: false });
});
