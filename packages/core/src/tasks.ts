export interface TaskItem {
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

const CHECKBOX_RE = /^- \[([ xX])\] (.+)$/;
const SECTION_RE = /^## (.+)$/;

export function parseTasks(content: string): ParsedTasks {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: TaskSection[] = [];
  let currentSection: TaskSection = { title: "", tasks: [] };
  let total = 0;
  let completed = 0;

  for (const line of lines) {
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      if (currentSection.tasks.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: sectionMatch[1].trim(), tasks: [] };
      continue;
    }

    const taskMatch = line.match(CHECKBOX_RE);
    if (taskMatch) {
      const done = taskMatch[1].toLowerCase() === "x";
      currentSection.tasks.push({ text: taskMatch[2].trim(), completed: done });
      total++;
      if (done) completed++;
    }
  }

  if (currentSection.tasks.length > 0) {
    sections.push(currentSection);
  }

  return { total, completed, sections };
}
