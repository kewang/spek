import type { ChangeArtifact } from "@spekjs/core";

// Whether an artifact renders as Markdown with a table of contents (markdown and specs yes, tasks and
// data no).
export function isMarkdownLike(kind: ChangeArtifact["kind"]): boolean {
  return kind === "markdown" || kind === "specs";
}

// Per-extension metadata for a data artifact: the highlight.js fence language and the short format badge
// label. The key is the file's own last extension. The title is already a data artifact, classified by
// core's DATA_EXTENSIONS. This file must not import that value: it is browser code, and the core root
// index reaches for node:child_process. An extension that core treats as data but that is absent here (a
// future `.toml`) does not inherit yaml. dataLanguage returns "", so it renders plain rather than
// mis-tokenised. dataFormat falls back to its own uppercased extension.
const DATA_META: Record<string, { language: string; format: string }> = {
  ".json": { language: "json", format: "JSON" },
  ".yaml": { language: "yaml", format: "YAML" },
  ".yml": { language: "yaml", format: "YAML" },
};

// The file's last extension, lowercased and including the dot (`asyncapi.YAML` -> `.yaml`), or "" if none.
function lastExtension(title: string): string {
  return title.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

// The fence language of a data artifact, from the title extension. An unknown extension gives "" (no
// language). fencedBlock then emits a bare fence, and it renders plain rather than as mis-detected YAML.
export function dataLanguage(title: string): string {
  return DATA_META[lastExtension(title)]?.language ?? "";
}

// The short format label for a data tab's badge (YAML / JSON). An unknown extension gives the extension
// itself, uppercased (`.toml` -> "TOML"). No extension gives "".
export function dataFormat(title: string): string {
  const ext = lastExtension(title);
  if (!ext) return "";
  return DATA_META[ext]?.format ?? ext.replace(/^\./, "").toUpperCase();
}

// A data tab's display name: the filename without its extension (`asyncapi.yaml` -> `asyncapi`). The
// format shows as a separate badge, so the extension is dropped from the label. The caller restores the
// full filename only when this stem would collide with another tab's label.
export function dataStem(title: string): string {
  return title.replace(/\.[^.]+$/, "");
}

// Per data artifact, the tab label to show: the stem plus a format badge. The strip then reads
// `Proposal / asyncapi [YAML] / Specs` rather than a raw filename. The extension is restored only when the
// stem would collide with another tab's label (a markdown `notes` beside a data `notes.yaml`). That
// collision is the one ambiguity the extension in the title used to prevent. The map is keyed by artifact
// id. Non-data artifacts are absent, so they keep their own title. It is pure, so a unit test covers the
// collision rule.
export function dataTabNames(
  artifacts: { id: string; title: string; kind: string }[],
): Map<string, { name: string; format: string }> {
  const counts = new Map<string, number>();
  for (const a of artifacts) {
    const key = (a.kind === "data" ? dataStem(a.title) : a.title).toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out = new Map<string, { name: string; format: string }>();
  for (const a of artifacts) {
    if (a.kind !== "data") continue;
    const stem = dataStem(a.title);
    const collides = (counts.get(stem.toLowerCase()) ?? 0) > 1;
    out.set(a.id, { name: collides ? a.title : stem, format: dataFormat(a.title) });
  }
  return out;
}

// Wrap data content as a fenced code block for the same MarkdownRenderer pipeline. The fence is longer
// than the longest backtick run in the content (at least 3), so content that holds a ``` run cannot
// close the block early (CommonMark). One trailing newline is stripped: the file's own terminator would
// otherwise render as a blank line at the bottom of the block.
export function fencedBlock(content: string, lang: string): string {
  let longest = 0;
  for (const m of content.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${content.replace(/\r?\n$/, "")}\n${fence}`;
}
