import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { type ReactNode } from "react";
import { slugifyHeading } from "@spekjs/core/headings";

// rehype plugin：為 h2/h3 加上 deterministic id（與 extractHeadings 的 slug 演算法一致）。
// 在 hast 階段處理可避免 React Strict Mode 的 double render 讓 counter 翻倍。
type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function hastToText(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.children) return node.children.map(hastToText).join("");
  return "";
}

function rehypeSpekHeadingIds(options?: { idPrefix?: string }) {
  const prefix = options?.idPrefix ?? "";
  return (tree: HastNode) => {
    const counter = new Map<string, number>();
    const walk = (node: HastNode) => {
      if (
        node.type === "element" &&
        (node.tagName === "h2" || node.tagName === "h3")
      ) {
        const base = slugifyHeading(hastToText(node).trim());
        if (base) {
          const n = counter.get(base) ?? 0;
          counter.set(base, n + 1);
          const dedup = n === 0 ? base : `${base}-${n + 1}`;
          node.properties = node.properties ?? {};
          node.properties.id = `${prefix}${dedup}`;
        }
      }
      if (node.children) for (const child of node.children) walk(child);
    };
    walk(tree);
  };
}

interface MarkdownRendererProps {
  content: string;
  specTopics?: string[];
  // 給 ChangeDetail Specs tab 使用：多份 delta spec 合併時以 `<topic>--` 前綴避免 id 衝突
  idPrefix?: string;
}

// BDD 關鍵字樣式對應
const BDD_KEYWORDS: Record<string, string> = {
  WHEN: "bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-sm font-semibold",
  GIVEN: "bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-sm font-semibold",
  THEN: "bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-sm font-semibold",
  AND: "bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded text-sm font-semibold",
  MUST: "text-red-400 font-bold",
  SHALL: "text-red-400 font-bold",
  ADDED: "bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded text-xs font-semibold",
  MODIFIED: "bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-xs font-semibold",
};

const BDD_PATTERN = new RegExp(
  `\\b(${Object.keys(BDD_KEYWORDS).join("|")})\\b`,
  "g"
);

function highlightBddKeywords(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  BDD_PATTERN.lastIndex = 0;
  while ((match = BDD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const keyword = match[1];
    parts.push(
      <span key={match.index} className={BDD_KEYWORDS[keyword]}>
        {keyword}
      </span>
    );
    lastIndex = BDD_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function processChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    return highlightBddKeywords(children);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? (
        <span key={i}>{highlightBddKeywords(child)}</span>
      ) : (
        child
      )
    );
  }
  return children;
}

export function MarkdownRenderer({ content, specTopics, idPrefix }: MarkdownRendererProps) {
  return (
    // `overflow-wrap` is inherited, so this covers prose as well as inline code: instruction text
    // is full of bare paths (`openspec/changes/<name>/brainstorm.md`) that have no space to break
    // at, and one of them widens the whole page on a phone. A page that overflows makes mobile
    // Safari zoom out to fit, which reads as the layout jumping on every selection.
    <div className="markdown-body [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSpekHeadingIds, { idPrefix }]]}
        components={{
          // 段落：套用 BDD 高亮
          p({ children }) {
            return <p className="mb-4 leading-relaxed">{processChildren(children)}</p>;
          },
          // 列表項：套用 BDD 高亮
          li({ children }) {
            return <li className="mb-1">{processChildren(children)}</li>;
          },
          // 標題
          h1({ children }) {
            return <h1 className="text-2xl font-bold mt-6 mb-4 text-text-primary">{children}</h1>;
          },
          h2({ id, children }) {
            return <h2 id={id} className="text-xl font-bold mt-6 mb-3 text-text-primary border-b border-border pb-2 scroll-mt-20">{children}</h2>;
          },
          h3({ id, children }) {
            return <h3 id={id} className="text-lg font-semibold mt-5 mb-2 text-text-primary scroll-mt-20">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-base font-semibold mt-4 mb-2 text-text-secondary">{children}</h4>;
          },
          h5({ children }) {
            return <h5 className="text-sm font-semibold mt-3 mb-1 text-text-secondary">{children}</h5>;
          },
          h6({ children }) {
            return <h6 className="text-sm font-medium mt-3 mb-1 text-text-muted">{children}</h6>;
          },
          // 強調
          strong({ children }) {
            return <strong className="font-bold text-text-primary">{processChildren(children)}</strong>;
          },
          em({ children }) {
            return <em className="italic text-text-secondary">{children}</em>;
          },
          // 連結
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
          // 程式碼區塊 — 不做 BDD 高亮
          code({ className, children }) {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <code className={`${className} block`}>
                  {children}
                </code>
              );
            }
            const text = typeof children === "string" ? children : String(children ?? "");
            if (specTopics?.includes(text)) {
              return (
                <Link
                  to={`/specs/${text}`}
                  className="bg-bg-tertiary text-accent hover:text-accent-hover px-1.5 py-0.5 rounded text-sm underline decoration-dotted transition-colors"
                >
                  {text}
                </Link>
              );
            }
            return (
              <code className="bg-bg-tertiary text-accent px-1.5 py-0.5 rounded text-sm">
                {children}
              </code>
            );
          },
          pre({ children }) {
            return (
              <pre className="bg-bg-tertiary border border-border rounded-lg p-4 text-sm overflow-x-auto mb-4 leading-relaxed">
                {children}
              </pre>
            );
          },
          // 表格
          table({ children }) {
            return (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border-collapse border border-border text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-bg-tertiary">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border border-border px-3 py-2 text-left font-semibold text-text-secondary">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-3 py-2 text-text-primary">
                {children}
              </td>
            );
          },
          // Lists: list-outside puts the marker in the left padding gutter, inline with the
          // first line. `list-style-position: inside` breaks a loose list (blank lines between
          // items, so each item's content is a block <p>) — an inline marker can't share a line
          // box with a block, so it gets pushed onto its own line above the text.
          // The gutter must fit the widest marker: a bullet is ~7px, but "99." is 22.2px and
          // "100." is 31.1px, so ol gets pl-8 (32px) while ul stays at pl-6 (24px).
          ul({ children }) {
            return <ul className="list-disc list-outside pl-6 mb-4 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside pl-8 mb-4 space-y-1">{children}</ol>;
          },
          // 分隔線
          hr() {
            return <hr className="border-border my-6" />;
          },
          // 引用
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-accent pl-4 my-4 text-text-secondary italic">
                {children}
              </blockquote>
            );
          },
          // 輸入（checkbox）
          input({ checked, type }) {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 accent-accent"
                />
              );
            }
            return <input type={type} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
