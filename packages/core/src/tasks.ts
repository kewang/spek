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

    sawBlank = false;
    pending.rest.push(line);
  }

  flush();

  if (currentSection.tasks.length > 0) {
    sections.push(currentSection);
  }

  return { total, completed, sections };
}
