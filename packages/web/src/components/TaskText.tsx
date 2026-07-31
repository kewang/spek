import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TaskTextProps {
  text: string;
}

/**
 * Renders a single task's text as Markdown.
 *
 * Deliberately not `MarkdownRenderer`: that one adds BDD keyword highlighting, heading anchor ids and
 * `mb-4` block spacing, all of which would change the Tasks tab beyond making formatting work. This
 * keeps standard CommonMark+GFM only — no spek-specific syntax — and stays margin-free so a
 * single-line task sits inline with its checkbox icon exactly as before. Element classes mirror
 * `MarkdownRenderer` so the two surfaces look consistent.
 */
export function TaskText({ text }: TaskTextProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Margin-free, so a single-line task is visually unchanged. Only a task that actually has
        // several paragraphs pays for the spacing between them.
        p({ children }) {
          return <p className="mt-2 first:mt-0">{children}</p>;
        },
        strong({ children }) {
          return <strong className="font-bold">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic">{children}</em>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              className="text-accent hover:text-accent-hover underline transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        code({ className, children }) {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return <code className={`${className} block`}>{children}</code>;
          }
          return (
            <code className="bg-bg-tertiary text-accent px-1.5 py-0.5 rounded text-[0.9em]">
              {children}
            </code>
          );
        },
        pre({ children }) {
          return (
            <pre className="bg-bg-tertiary border border-border rounded-md p-2 mt-2 text-xs overflow-x-auto">
              {children}
            </pre>
          );
        },
        ul({ children }) {
          return <ul className="list-disc list-outside pl-5 mt-1 space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-outside pl-6 mt-1 space-y-0.5">{children}</ol>;
        },
        li({ children }) {
          return <li>{children}</li>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-accent pl-3 mt-2 text-text-secondary italic">
              {children}
            </blockquote>
          );
        },
        // GFM renders a nested `- [ ]` as a checkbox. The viewer is read-only, and these are not
        // counted tasks, so they stay disabled.
        input({ checked, type }) {
          if (type === "checkbox") {
            return <input type="checkbox" checked={checked} readOnly className="mr-1.5 accent-accent" />;
          }
          return <input type={type} />;
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
