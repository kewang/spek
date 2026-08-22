import type { ChangeArtifact } from "@spekjs/core";

// Whether an artifact renders as Markdown with a table of contents (markdown and specs yes, tasks and
// data no).
export function isMarkdownLike(kind: ChangeArtifact["kind"]): boolean {
  return kind === "markdown" || kind === "specs";
}

// The fence language of a data artifact, from the title extension (.json to json, .yaml/.yml to yaml).
export function dataLanguage(title: string): string {
  return title.toLowerCase().endsWith(".json") ? "json" : "yaml";
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
