import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanOpenSpec, readSpec, readChange } from "../packages/core/dist/index.js";
import type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  ChangesData,
  ChangeDetail,
} from "../packages/core/dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "packages", "web");
const DIST_DEMO = path.join(WEB_DIR, "dist-demo");
const OUT_DIR = path.join(ROOT, "docs");
const OUT_FILE = path.join(OUT_DIR, "demo.html");

async function main() {
  // 1. 收集 openspec 資料
  console.log("Collecting openspec data...");

  const scan = scanOpenSpec(ROOT);

  const overview: OverviewData = {
    specsCount: scan.specs.length,
    changesCount: {
      active: scan.activeChanges.length,
      archived: scan.archivedChanges.length,
    },
    taskStats: {
      total: 0,
      completed: 0,
    },
  };

  // 彙總 task stats
  for (const c of [...scan.activeChanges, ...scan.archivedChanges]) {
    if (c.taskStats) {
      overview.taskStats.total += c.taskStats.total;
      overview.taskStats.completed += c.taskStats.completed;
    }
  }

  // 讀取所有 spec details
  const specDetails: Record<string, SpecDetail> = {};
  for (const spec of scan.specs) {
    const detail = await readSpec(ROOT, spec.topic);
    if (detail) {
      specDetails[spec.topic] = detail;
    }
  }

  // 讀取所有 change details
  const changeDetails: Record<string, ChangeDetail> = {};
  const allChanges = [...scan.activeChanges, ...scan.archivedChanges];
  for (const change of allChanges) {
    const detail = readChange(ROOT, change.slug);
    if (detail) {
      changeDetails[change.slug] = detail;
    }
  }

  const specs: SpecInfo[] = scan.specs.map((s) => ({ topic: s.topic, path: s.path }));
  const changes: ChangesData = {
    active: scan.activeChanges,
    archived: scan.archivedChanges,
  };

  const demoData = { overview, specs, specDetails, changes, changeDetails };
  const demoDataJson = JSON.stringify(demoData);

  console.log(
    `  ${specs.length} specs, ${changes.active.length} active + ${changes.archived.length} archived changes`,
  );

  // 2. 執行 Vite build
  console.log("Building demo with Vite...");
  execSync("npx vite build --config vite.demo.config.ts", {
    cwd: WEB_DIR,
    stdio: "inherit",
  });

  // 3. 讀取 build 產出，組裝成單檔 HTML
  console.log("Assembling single-file HTML...");

  const distFiles = fs.readdirSync(path.join(DIST_DEMO, "assets"));
  const jsFile = distFiles.find((f) => f.endsWith(".js"));
  const cssFile = distFiles.find((f) => f.endsWith(".css"));

  if (!jsFile) throw new Error("No JS output found");

  const jsContent = fs.readFileSync(path.join(DIST_DEMO, "assets", jsFile), "utf-8");
  const cssContent = cssFile
    ? fs.readFileSync(path.join(DIST_DEMO, "assets", cssFile), "utf-8")
    : "";
  const styleBlock = cssContent ? `\n    <style>${cssContent}</style>` : "";

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>spek — OpenSpec Viewer Demo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&display=swap" rel="stylesheet" />${styleBlock}
  </head>
  <body>
    <div id="root"></div>
    <script>window.__DEMO_DATA__ = ${demoDataJson};</script>
    <script>${jsContent}</script>
  </body>
</html>`;

  // 4. 寫入最終檔案
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html, "utf-8");

  const sizeKB = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`\n✓ Demo built: ${OUT_FILE} (${sizeKB} KB)`);

  // 5. 清理暫存
  fs.rmSync(DIST_DEMO, { recursive: true, force: true });
  console.log("✓ Cleaned up dist-demo/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
