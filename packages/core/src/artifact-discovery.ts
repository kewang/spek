import fs from "node:fs";
import path from "node:path";
import { parseTasks } from "./tasks.js";
import { defaultRank } from "./artifact-order.js";
import type { ChangeArtifact } from "./types.js";
import { rootArtifacts, listSpecFiles, specsMtime, type RootKind } from "./artifact-files.js";

/**
 * Build ChangeArtifact objects for one change directory. artifact-files.ts lists which files are artifacts.
 * This file reads their content and builds the objects. discoverArtifacts is the only entry point, and
 * the only place that reads artifact content.
 */

/** Build a display title from a filename stem: dash/underscore to space, then title case. */
function humanize(stem: string): string {
  return stem
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Remove the last extension (`asyncapi.yaml` to `asyncapi`, `proposal.md` to `proposal`). */
function stripExt(file: string): string {
  return file.replace(/\.[^.]+$/, "");
}

/** Assign an id that is not yet used. If base is taken, try base-2, base-3, and so on, then record it.
 *  This resolves the clash between a root specs.md and the specs delta tree over the "specs" id. */
function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

/** Build one root-file artifact from its kind and content. The switch is exhaustive over RootKind, so a
 *  new root kind is a compile error until it gets a case. */
function buildArtifact(id: string, file: string, kind: RootKind, content: string): ChangeArtifact {
  switch (kind) {
    case "tasks":
      return { id, title: humanize(stripExt(file)), kind, tasks: parseTasks(content) };
    case "markdown":
      return { id, title: humanize(stripExt(file)), kind, content };
    case "data":
      // A data artifact keeps its extension in the title (`asyncapi.yaml`). This is clear, and it does
      // not clash with a markdown tab of the same stem. The frontend derives the fence language from the
      // extension.
      return { id, title: file, kind, content };
  }
}

/**
 * Discover a change directory's artifacts from disk. It builds one artifact per root file and one for a
 * non-empty specs tree, then sorts by mtime, newest first.
 *
 * The id-dedup precedence is: specs first, then root files in rootArtifacts order (markdown/tasks before
 * data). So a root specs.md becomes specs-2, spec.md keeps "spec", and spec.json becomes spec-2. This
 * order decides the ids only. The display order is the mtime sort at the end.
 *
 * A root file takes its own mtime. specs takes the newest mtime of its delta files. So an artifact edited
 * during a run (for example tasks) moves to the front. Two artifacts tie only when their mtime is exactly
 * equal (for example, written in the same second). The tiebreak is then the default order (DEFAULT_ORDER
 * first, then alphabetical). Note that git clone and git checkout usually write a different sub-ms mtime
 * per file. So this default (Last modified) mode does not guarantee the proposal, design, ... narrative
 * order for a fresh, unedited checkout. For authored order, use the frontend Schema order or A-Z. This
 * does not call the openspec CLI and does not parse any schema.
 */
export function discoverArtifacts(changePath: string): ChangeArtifact[] {
  const used = new Set<string>();
  const items: { artifact: ChangeArtifact; mtime: number }[] = [];

  // specs reserves the "specs" id first (see the precedence note above).
  const specs = listSpecFiles(changePath);
  if (specs.length > 0) {
    used.add("specs");
    items.push({
      artifact: {
        id: "specs",
        title: "Specs",
        kind: "specs",
        specs: specs.map(({ topic, file }) => ({ topic, content: fs.readFileSync(file, "utf-8") })),
      },
      mtime: specsMtime(changePath),
    });
  }

  for (const { file, kind } of rootArtifacts(changePath)) {
    const full = path.join(changePath, file);
    const id = uniqueId(stripExt(file), used);
    items.push({
      artifact: buildArtifact(id, file, kind, fs.readFileSync(full, "utf-8")),
      mtime: fs.statSync(full).mtimeMs,
    });
  }

  items.sort((a, b) => {
    if (b.mtime !== a.mtime) return b.mtime - a.mtime;
    const ra = defaultRank(a.artifact.id);
    const rb = defaultRank(b.artifact.id);
    if (ra !== rb) return ra - rb;
    return a.artifact.id.localeCompare(b.artifact.id);
  });

  return items.map((i) => i.artifact);
}
