import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  scanOpenSpec,
  readSpec,
  readChange,
  readSpecAtChange,
  buildGraphData,
  listSchemas,
  readSchema,
  groupSchemaUsage,
} from "../packages/core/dist/index.js";
import type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  ChangesData,
  ChangeDetail,
  SchemaDefinition,
} from "../packages/core/dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT, "packages", "web");
const DIST_DEMO = path.join(WEB_DIR, "dist-demo");

// CLI 參數解析
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

const REPO_DIR = getArg("--repo-dir") ? path.resolve(getArg("--repo-dir")!) : ROOT;
const OUT_FILE = getArg("--output") ? path.resolve(getArg("--output")!) : path.join(ROOT, "docs", "demo.html");
const PAGE_TITLE = getArg("--title") || "spek — OpenSpec Viewer Demo";

async function main() {
  // 1. 收集 openspec 資料
  console.log("Collecting openspec data...");

  const scan = await scanOpenSpec(REPO_DIR);

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
    const detail = await readSpec(REPO_DIR, spec.topic);
    if (detail) {
      specDetails[spec.topic] = detail;
    }
  }

  // 讀取所有 change details
  const changeDetails: Record<string, ChangeDetail> = {};
  const allChanges = [...scan.activeChanges, ...scan.archivedChanges];
  for (const change of allChanges) {
    const detail = await readChange(REPO_DIR, change.slug);
    if (detail) {
      changeDetails[change.slug] = detail;
    }
  }

  const specs: SpecInfo[] = scan.specs;
  const changes: ChangesData = {
    active: scan.activeChanges,
    archived: scan.archivedChanges,
    defaultSchema: scan.defaultSchema,
  };

  // 收集 spec 歷史版本內容（供 diff 檢視）
  const specVersions: Record<string, Record<string, string>> = {};
  for (const spec of scan.specs) {
    const detail = specDetails[spec.topic];
    if (!detail?.history?.length) continue;
    for (const entry of detail.history) {
      const version = readSpecAtChange(REPO_DIR, spec.topic, entry.slug);
      if (version) {
        if (!specVersions[spec.topic]) specVersions[spec.topic] = {};
        specVersions[spec.topic][entry.slug] = version.content;
      }
    }
  }

  // 建立 graph 資料
  const graphData = buildGraphData(REPO_DIR);

  // Workflow schemas, captured here so the demo needs neither the openspec CLI nor a filesystem at
  // view time — the whole point of the static build. The catalog is joined with change usage exactly
  // as the server routes do, and every enumerated schema's definition is read so the detail page
  // works offline; a schema that cannot be read is left out rather than embedded half-formed, and
  // the view's own not-found state covers it.
  const catalog = await listSchemas(REPO_DIR);
  const schemas = groupSchemaUsage(catalog, scan.activeChanges);
  const schemaDetails: Record<string, SchemaDefinition> = {};
  for (const summary of catalog.schemas) {
    const result = await readSchema(REPO_DIR, summary.name);
    if (result.ok) schemaDetails[summary.name] = result.schema;
  }

  const demoData = {
    overview,
    specs,
    specDetails,
    changes,
    changeDetails,
    specVersions,
    graphData,
    schemas,
    schemaDetails,
  };
  const demoDataJson = JSON.stringify(demoData);

  console.log(
    `  ${specs.length} specs, ${changes.active.length} active + ${changes.archived.length} archived changes`,
  );
  console.log(
    `  ${schemas.schemas.length} schemas (${Object.keys(schemaDetails).length} readable)` +
      (catalog.degradedReason ? `, degraded: ${catalog.degradedReason}` : ""),
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
    <title>${PAGE_TITLE}</title>
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
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
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
