import { execFile } from "node:child_process";
import path from "node:path";

// in-memory cache: repoDir → (slug → ISO timestamp)
const cache = new Map<string, Map<string, string>>();

/**
 * 執行單一 git log 指令，解析每個 change slug 的最早 commit 時間。
 * git log 預設最新在前，對同一個 slug 持續覆寫，最後留下的就是最早 commit。
 */
export function buildChangeTimestamps(
  repoDir: string,
): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    execFile(
      "git",
      [
        "log",
        "--format=COMMIT %aI",
        "--name-only",
        "--",
        "openspec/changes/",
      ],
      { cwd: repoDir, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          // 非 git repo 或其他錯誤，回傳空 Map
          resolve(new Map());
          return;
        }

        const timestamps = new Map<string, string>();
        let currentTimestamp: string | null = null;

        for (const line of stdout.split("\n")) {
          if (line.startsWith("COMMIT ")) {
            currentTimestamp = line.slice(7).trim();
          } else if (currentTimestamp && line.startsWith("openspec/changes/")) {
            // 從路徑中取出 slug：openspec/changes/<slug>/... 或 openspec/changes/archive/<slug>/...
            const rel = line.slice("openspec/changes/".length);
            const parts = rel.split("/");
            let slug: string | null = null;

            if (parts[0] === "archive" && parts.length >= 2) {
              slug = parts[1];
            } else if (parts[0] !== "archive" && parts.length >= 1) {
              slug = parts[0];
            }

            if (slug) {
              // git log 最新在前，持續覆寫 → 最後留下最早 commit
              timestamps.set(slug, currentTimestamp);
            }
          }
        }

        resolve(timestamps);
      },
    );
  });
}

/**
 * 取得某 repo 的 change timestamps，有 cache 就直接回傳，沒有就 lazy build。
 */
export async function getTimestamps(
  repoDir: string,
): Promise<Map<string, string>> {
  const absDir = path.resolve(repoDir);
  const cached = cache.get(absDir);
  if (cached) return cached;

  const timestamps = await buildChangeTimestamps(absDir);
  cache.set(absDir, timestamps);
  return timestamps;
}

/**
 * 清除並重建某 repo 的 timestamp cache。
 */
export async function resyncTimestamps(
  repoDir: string,
): Promise<Map<string, string>> {
  const absDir = path.resolve(repoDir);
  cache.delete(absDir);
  const timestamps = await buildChangeTimestamps(absDir);
  cache.set(absDir, timestamps);
  return timestamps;
}
