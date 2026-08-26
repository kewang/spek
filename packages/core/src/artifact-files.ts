import fs from "node:fs";
import path from "node:path";

/**
 * The filesystem view of one change directory: which files are artifacts, their kinds, their names,
 * and their mtimes. Everything here reads directory entries and stats only. It does not read file
 * content. discoverArtifacts in artifact-discovery.ts builds the ChangeArtifact objects on top of this list.
 */

/** The root-level extensions of a data artifact. Exported so a file watcher can build the set of
 *  extensions worth reacting to (`.md` + these) from one source. Re-listing them would drift when a new
 *  data extension is added here. */
export const DATA_EXTENSIONS = [".yaml", ".yml", ".json"];

/** The kind of a root-level artifact file. specs is not here: it is a tree, not a root file. */
export type RootKind = "tasks" | "markdown" | "data";

const isTasksName = (n: string) => n === "tasks.md";
const isMarkdownName = (n: string) => n.endsWith(".md");
const isDataName = (n: string) => DATA_EXTENSIONS.some((ext) => n.endsWith(ext));

/**
 * The one classifier for root files. It returns the artifact kind of a root filename, or null if the
 * file is not an artifact. count, search, and discover all go through it, so a new root kind cannot slip
 * past one of them.
 */
function rootKind(nameLower: string): RootKind | null {
  if (isTasksName(nameLower)) return "tasks";
  if (isMarkdownName(nameLower)) return "markdown";
  if (isDataName(nameLower)) return "data";
  return null;
}

/**
 * The filenames at the change root that pass `match`. It ignores dotfiles and directories, and sorts by
 * name. root-only and non-dotfile are the shared rules of every root-file listing, stated here once. It
 * does not descend: a file under a subdirectory is not an artifact.
 */
function listRootFiles(changePath: string, match: (nameLower: string) => boolean): string[] {
  if (!fs.existsSync(changePath)) return [];
  return fs
    .readdirSync(changePath, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith(".") && match(e.name.toLowerCase()))
    .map((e) => e.name)
    .sort();
}

/**
 * The root artifact files with their kinds, in id-dedup precedence: markdown and tasks first, then data.
 * This order lets spec.md keep the id "spec" and pushes spec.json to spec-2. discoverArtifacts builds
 * from this list. The display order is a separate mtime sort in discoverArtifacts. It does one directory
 * read and partitions the entries by kind.
 */
export function rootArtifacts(changePath: string): { file: string; kind: RootKind }[] {
  if (!fs.existsSync(changePath)) return [];
  // The file-only, non-dotfile rules are the same ones listRootFiles states. They are kept here because
  // this walk also needs each entry's kind. Carry {file, kind} through the partition, so the kind is
  // computed once and not recomputed behind a non-null assertion after the sort.
  const md: { file: string; kind: RootKind }[] = [];
  const data: { file: string; kind: RootKind }[] = [];
  for (const e of fs.readdirSync(changePath, { withFileTypes: true })) {
    if (!e.isFile() || e.name.startsWith(".")) continue;
    const kind = rootKind(e.name.toLowerCase());
    if (!kind) continue;
    (kind === "data" ? data : md).push({ file: e.name, kind });
  }
  // Default string order per bucket (matches the prior `.sort()` on names), so spec.md still precedes
  // spec.yaml within data and the id-dedup precedence in discoverArtifacts is unchanged.
  const byName = (a: { file: string }, b: { file: string }) =>
    a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
  md.sort(byName);
  data.sort(byName);
  return [...md, ...data];
}

/**
 * The specs/ delta tree as a { topic, file } list, sorted by topic. It reads directory entries and tests
 * for each spec.md. It does not read content. hasSpecsTree, specsMtime, and the spec content read in
 * discoverArtifacts all derive from it, so the tree walk is written one time.
 */
export function listSpecFiles(changePath: string): { topic: string; file: string }[] {
  const specsDir = path.join(changePath, "specs");
  if (!fs.existsSync(specsDir) || !fs.statSync(specsDir).isDirectory()) return [];
  const out: { topic: string; file: string }[] = [];
  for (const topic of fs.readdirSync(specsDir).filter((n) => !n.startsWith("."))) {
    const file = path.join(specsDir, topic, "spec.md");
    if (fs.existsSync(file)) out.push({ topic, file });
  }
  return out.sort((a, b) => a.topic.localeCompare(b.topic));
}

/** True if specs/ holds at least one spec.md. It reads no content and returns on the first hit. This is
 *  the changes-list hot path (countArtifacts, called per change during a scan). So it does not build the
 *  full listSpecFiles list only to ask `.length > 0`. It walks the same specs/<topic>/spec.md shape as
 *  listSpecFiles. Keep the two in step. */
function hasSpecsTree(changePath: string): boolean {
  const specsDir = path.join(changePath, "specs");
  if (!fs.existsSync(specsDir) || !fs.statSync(specsDir).isDirectory()) return false;
  for (const topic of fs.readdirSync(specsDir)) {
    if (topic.startsWith(".")) continue;
    if (fs.existsSync(path.join(specsDir, topic, "spec.md"))) return true;
  }
  return false;
}

/** The sort time of the specs artifact: the newest mtime of every spec.md file (0 if none). */
export function specsMtime(changePath: string): number {
  let newest = 0;
  for (const { file } of listSpecFiles(changePath)) {
    const m = fs.statSync(file).mtimeMs;
    if (m > newest) newest = m;
  }
  return newest;
}

/**
 * The root files that count as a searchable artifact (markdown, tasks, and data), sorted by name. The
 * web and vscode search indexes share this list, so any tab that comes from a root file is indexed. The
 * specs delta tree is not here: it shows in the Specs tab, but its content does not go into search.
 */
export function listChangeArtifactFiles(changePath: string): string[] {
  return rootArtifacts(changePath)
    .map((a) => a.file)
    .sort();
}

/**
 * The root markdown filenames of a change (root *.md, including tasks.md). This is an existing published
 * export of @spekjs/core, kept for outside consumers. The app uses listChangeArtifactFiles instead.
 */
export function listChangeMarkdownFiles(changePath: string): string[] {
  return listRootFiles(changePath, isMarkdownName);
}

/**
 * The artifact count (the root artifact files, plus 1 for a non-empty specs tree). ChangeInfo uses it on
 * the changes-list hot path. It reads no content, and returns 0 for a missing changePath.
 */
export function countArtifacts(changePath: string): number {
  return rootArtifacts(changePath).length + (hasSpecsTree(changePath) ? 1 : 0);
}

/**
 * The newest mtime of the change directory: the maximum over the root artifact files and the specs tree.
 * The cross-worktree election uses it to find which copy was edited last.
 */
export function changeDirMtime(changePath: string): number {
  let newest = specsMtime(changePath);
  for (const { file } of rootArtifacts(changePath)) {
    const m = fs.statSync(path.join(changePath, file)).mtimeMs;
    if (m > newest) newest = m;
  }
  return newest;
}
