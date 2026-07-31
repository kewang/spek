export interface TaskItem {
  /**
   * The checkbox's content, plus any continuation lines folded on with newlines. Markdown, and
   * possibly multi-line — render it, don't treat it as a plain one-line label.
   */
  text: string;
  completed: boolean;
}

export interface TaskSection {
  title: string;
  tasks: TaskItem[];
}

export interface TaskStats {
  total: number;
  completed: number;
}

export interface ParsedTasks extends TaskStats {
  sections: TaskSection[];
}

// Anchored at column 0 on purpose: an indented checkbox is part of its parent task's text, not a
// task of its own. Relaxing this would silently change every `total` / `completed` and CI badge.
const CHECKBOX_RE = /^- \[([ xX])\] (.+)$/;
const SECTION_RE = /^## (.+)$/;

// Width of the `- ` list marker, i.e. CommonMark's content offset for these items. Continuation
// lines are dedented by this much so the folded text renders the way a standard renderer shows the
// original source — no more. Stripping the full indent instead would promote deeply indented lines
// into bullet lists that no other Markdown viewer displays.
const CONTENT_OFFSET = 2;

function dedentContinuation(line: string): string {
  let n = 0;
  while (n < CONTENT_OFFSET && (line[n] === " " || line[n] === "\t")) n++;
  return line.slice(n);
}

function leadingWhitespace(line: string): number {
  return /^[ \t]*/.exec(line)![0].length;
}

// A column-0 line that opens a new block, which ends the preceding item rather than continuing it.
// CommonMark's lazy continuation only runs on for *paragraph* text: any line that starts a block
// interrupts the paragraph, so a standard renderer puts it outside the list. Without this, a plain
// `- Note: …` bullet after a checkbox is swallowed into that task and shown as a nested list, and a
// `---` turns the task into a setext heading.
//
// Only checked at column 0 — an indented block-opener is genuinely inside the item (that is how
// sub-bullets work). Every entry below was checked against the reference renderer rather than read
// off the spec: `2.` is here because remark ends the item on it, even though the "only a list
// starting at 1 interrupts a paragraph" rule reads like it should not.
//
// Deliberately not covered:
//   - HTML blocks — rare in tasks.md and the rules are long.
//   - Fence *tracking*. A fence opens a block here, but its contents are not skipped, so a column-0
//     `- [ ]` inside a fenced block still counts as a task. Predates this rule; fixing it would move
//     `total`.
//   - A setext underline (`===`). It is not a block start — it is lazily absorbed as paragraph text,
//     so the reference keeps it inside the item. Folding it in is the closer of the two wrong
//     answers (the text survives, but renders as a heading); flushing would delete it outright,
//     which is the bug this whole change exists to fix.
const BLOCK_OPENER_RE = new RegExp(
  "^(?:" +
    [
      // `[ \t]` rather than `\s`, and `$` on an already-split line: both spell the same thing in
      // Kotlin's regex engine, where `\s` and `$` do not mean what they mean in JS. Keep the two
      // patterns literally translatable — that is the only thing keeping them from drifting.
      "#{1,6}(?:[ \\t]|$)", // ATX heading (`## ` is handled earlier by SECTION_RE)
      ">", // blockquote
      "[-+*](?:[ \\t]|$)", // bullet list item (`- [x] ` is handled earlier by CHECKBOX_RE)
      // Any ordered marker, not just `1.`: the "only a list starting at 1 interrupts a paragraph"
      // rule is about paragraphs in running text. Inside a bullet list a `2.` opens a list of a
      // different type, which ends the item — checked against the reference renderer, not assumed.
      "\\d{1,9}[.)](?:[ \\t]|$)",
      "`{3,}|~{3,}", // fenced code block
      "(?:[-*_][ \\t]*){3,}$", // thematic break
    ]
      .map((alt) => `(?:${alt})`)
      .join("|") +
    ")",
);

function opensBlock(line: string): boolean {
  return BLOCK_OPENER_RE.test(line);
}

interface PendingTask {
  first: string;
  completed: boolean;
  rest: string[];
}

export function parseTasks(content: string): ParsedTasks {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: TaskSection[] = [];
  let currentSection: TaskSection = { title: "", tasks: [] };
  let total = 0;
  let completed = 0;

  // The task still accepting continuation lines, and whether a blank line has intervened since its
  // last content line. Only whether one occurred matters, not how many: blank lines do not end a
  // list, they only make the next line's indentation decide whether it is still inside the item.
  let pending: PendingTask | null = null;
  let sawBlank = false;

  function flush(): void {
    if (!pending) return;
    const { first, rest } = pending;
    while (rest.length > 0 && rest[rest.length - 1].trim() === "") rest.pop();
    // With continuation lines the first line is kept verbatim: two trailing spaces are a hard line
    // break, and trimming them would quietly downgrade it to a soft one.
    const text =
      rest.length > 0
        ? [first, ...rest.map((l) => (l.trim() === "" ? "" : dedentContinuation(l)))].join("\n")
        : first.trim();
    currentSection.tasks.push({ text, completed: pending.completed });
    total++;
    if (pending.completed) completed++;
    pending = null;
  }

  for (const line of lines) {
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      flush();
      if (currentSection.tasks.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: sectionMatch[1].trim(), tasks: [] };
      sawBlank = false;
      continue;
    }

    const taskMatch = line.match(CHECKBOX_RE);
    if (taskMatch) {
      flush();
      pending = {
        first: taskMatch[2],
        completed: taskMatch[1].toLowerCase() === "x",
        rest: [],
      };
      sawBlank = false;
      continue;
    }

    if (!pending) continue;

    if (line.trim() === "") {
      sawBlank = true;
      pending.rest.push(line);
      continue;
    }

    // Lazy continuation runs on at any indentation, but once a blank line intervenes the line must
    // reach the content offset to stay inside the item — otherwise a standard renderer puts it in
    // its own paragraph outside the list, so it is not part of this task.
    if (sawBlank && leadingWhitespace(line) < CONTENT_OFFSET) {
      flush();
      sawBlank = false;
      continue;
    }

    // Lazy continuation applies to paragraph text only: a column-0 line that opens a new block ends
    // the item instead of joining it.
    if (leadingWhitespace(line) === 0 && opensBlock(line)) {
      flush();
      sawBlank = false;
      continue;
    }

    sawBlank = false;
    pending.rest.push(line);
  }

  flush();

  if (currentSection.tasks.length > 0) {
    sections.push(currentSection);
  }

  return { total, completed, sections };
}
