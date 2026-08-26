import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { type ReactNode } from "react";
import { slugifyHeading, specHeadingLabel } from "@spekjs/core/headings";
import { rehypeHighlightNarrow } from "../utils/highlight";
import {
  rehypeSpekFoldSections,
  type FoldOptions,
  type HastNode,
} from "../utils/foldSections";

// rehype plugin：為 h2/h3 加上 deterministic id（與 extractHeadings 的 slug 演算法一致）。
// 在 hast 階段處理可避免 React Strict Mode 的 double render 讓 counter 翻倍。

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

const HEADING_TAG_RE = /^h[1-6]$/;

/**
 * rehype plugin：spec 標題不重複格式關鍵字（`Requirement:` / `Scenario:`）。
 *
 * 判斷一律用**整個標題**的文字，而不是「開頭那一段純文字」。`### Requirement: \`@spekjs/ui\` package
 * exports …`（本 repo 的 ui-package spec 就有兩個）第一個 text node 恰好是 `"Requirement: "`，單看它會
 * 判定「剝完就空了」而放棄，於是內文留著關鍵字、讀整行的 TOC 卻剝掉 —— 兩個介面對同一個標題講不同的話。
 * 所以這裡沿用 id plugin 已經在用的 `hastToText`，決定好之後才從第一個 text node 砍掉等量的字元。
 *
 * 關鍵字沒有完整落在第一個 text node 裡（例如標題以 markup 開頭）就整個不動 —— 跨 markup 去剝等於刪掉
 * 作者寫的結構。
 *
 * 不看 heading level：決定一個標題是不是 requirement 的是關鍵字，不是層級。而且各介面顯示的層級並不
 * 一致（內文全部顯示，`extractHeadings` 只回 h2/h3），一旦按層級 gate，`## Requirement: X` 就會在側欄
 * 被剝、在內文留著。
 */
function rehypeSpekElideHeadingKeyword() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === "element" && node.tagName && HEADING_TAG_RE.test(node.tagName)) {
        const full = hastToText(node);
        const label = specHeadingLabel(full);
        if (label !== full) {
          const drop = full.length - label.length;
          const first = node.children?.[0];
          // `<` 而非 `<=`：整個 text node 剛好就是關鍵字（後面接 code span）是合法的，砍成空字串即可。
          if (first && first.type === "text" && (first.value ?? "").length >= drop) {
            first.value = (first.value ?? "").slice(drop);
          }
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
  /**
   * 開啟章節摺疊。由呼叫端指定而非由內容推斷 —— 這個 renderer 同時服務 proposal / design / tasks，
   * 只有 spec 形狀的內容該摺疊，其餘靠「沒傳」而不是靠某處的判斷來排除。
   */
  fold?: FoldOptions;
  /**
   * 這份內容是 spec 形狀的（spec 本體或 change 的 delta spec）。
   *
   * 它描述的是**文件的性質**，不是檢視狀態，所以刻意不從 `fold` 推導 —— 雖然今天兩者的呼叫端
   * 恰好完全重合。`fold` 是讀者用 FoldControls 切換、還會被持久化的偏好；日後只要多一個代表
   * 「不要摺疊」的模式，綁在一起就會讓顯示偏好順手改掉文件的排版。
   *
   * 影響範圍只有 h2：spec 形狀的文件裡每個 h2 都是結構分隔（`## Purpose`、`## Requirements`、
   * `## ADDED Requirements`），而 proposal / design 的 h2 是內容標題本身，兩者不能共用一套排版。
   */
  specShaped?: boolean;
}

// BDD 關鍵字樣式對應。
//
// 文字色走 `--color-kw-*` / `--color-badge-*` token，因為淺色主題需要自己的一組值（原本兩個主題
// 共用寫死的 Tailwind 400 色階，在淺色下全部不符 WCAG AA）。底色維持 `/20`，會自動疊在當前主題的
// 頁面底色上，不需要 token。
//
// 字重不放在這裡而放 `BDD_WEIGHTS`：關鍵字若出現在 `**粗體**` 內，highlight 不得把字重調低。
const BDD_KEYWORDS: Record<string, string> = {
  WHEN: "bg-blue-500/20 text-kw-when px-1.5 py-0.5 rounded text-sm",
  GIVEN: "bg-blue-500/20 text-kw-when px-1.5 py-0.5 rounded text-sm",
  THEN: "bg-green-500/20 text-kw-then px-1.5 py-0.5 rounded text-sm",
  AND: "bg-gray-500/20 text-kw-and px-1.5 py-0.5 rounded text-sm",
  MUST: "text-kw-normative",
  SHALL: "text-kw-normative",
  ADDED: "bg-orange-500/20 text-badge-added px-1.5 py-0.5 rounded text-xs",
  MODIFIED: "bg-blue-500/20 text-badge-modified px-1.5 py-0.5 rounded text-xs",
  // REMOVED 不用紅色：紅色在這個 renderer 已經是「規範性」（MUST/SHALL）的意思，
  // 一個顏色扛兩種意義會讓兩邊都變弱。改用紫與粉，與既有的橘/藍/綠/紅/灰都拉得開。
  REMOVED: "bg-purple-500/20 text-badge-removed px-1.5 py-0.5 rounded text-xs",
  RENAMED: "bg-pink-500/20 text-badge-renamed px-1.5 py-0.5 rounded text-xs",
};

// 只在 `<strong>` 之外套用 —— 見 highlightBddKeywords。
const BDD_WEIGHTS: Record<string, string> = {
  WHEN: "font-semibold",
  GIVEN: "font-semibold",
  THEN: "font-semibold",
  AND: "font-semibold",
  MUST: "font-bold",
  SHALL: "font-bold",
  ADDED: "font-semibold",
  MODIFIED: "font-semibold",
  REMOVED: "font-semibold",
  RENAMED: "font-semibold",
};

const BDD_PATTERN = new RegExp(
  `\\b(${Object.keys(BDD_KEYWORDS).join("|")})\\b`,
  "g"
);

/**
 * `inStrong` 時不輸出 highlight 自己的字重，改為繼承。否則 `**SHALL**` 會被 span 的
 * `font-semibold`（600）以 specificity 蓋過父層 `<strong>` 的 700，作者標了粗體的字反而變細 ——
 * 這裡的字重都 ≤ bold，繼承一律正確。
 */
function highlightBddKeywords(text: string, inStrong: boolean): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  BDD_PATTERN.lastIndex = 0;
  while ((match = BDD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const keyword = match[1];
    const className = inStrong
      ? BDD_KEYWORDS[keyword]
      : `${BDD_KEYWORDS[keyword]} ${BDD_WEIGHTS[keyword]}`;
    parts.push(
      <span key={match.index} className={className}>
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

function processChildren(children: ReactNode, inStrong = false): ReactNode {
  if (typeof children === "string") {
    return highlightBddKeywords(children, inStrong);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? (
        <span key={i}>{highlightBddKeywords(child, inStrong)}</span>
      ) : (
        child
      )
    );
  }
  return children;
}

// h2 的兩套排版。差別只在 spec 形狀的文件裡 h2 是結構分隔，不是內容標題 —— 見 `specShaped`。
//
// 降級後刻意停在「不低於 h4」：h3 是 text-lg/semibold/primary、h4 是 text-base/semibold/secondary，
// 這裡與 h4 同級再加上大寫與字距，所以排序是 h3 > h2 ≥ h4。若再往下降成 text-xs muted，h2 就會比
// 它所統括的 h4 還輕 —— 那正是這次要修的倒置，只是往下挪了一層。
const H2_CONTENT = "text-xl font-bold mt-6 mb-3 text-text-primary border-b border-border pb-2 scroll-mt-20";
const H2_STRUCTURAL = "text-base font-semibold uppercase tracking-wide mt-6 mb-3 text-text-secondary scroll-mt-20";

export function MarkdownRenderer({ content, specTopics, idPrefix, fold, specShaped }: MarkdownRendererProps) {
  // 順序不可調換，而且有兩個理由：
  //
  // 1. heading id 必須在還是扁平樹時指派，否則 dedup counter 看到的走訪順序會變。
  // 2. id 是從 heading 的文字算出來的，所以關鍵字**必須**在 id 指派之後才剝。反過來的話，每個
  //    requirement 的 id 都會變，而走 `extractHeadings`（直接解析原始 markdown）的 TOC 與 VS Code
  //    側欄仍然產出原本的 slug —— 兩邊從此指向不同的錨點，畫面上完全看不出來，只是連結再也跳不到。
  const rehypePlugins: NonNullable<Parameters<typeof ReactMarkdown>[0]["rehypePlugins"]> = [
    // Syntax highlighting for fenced blocks with a language hint. Never auto-detects, so a language-less
    // fence stays plain. An unregistered language renders plain too, never throwing. It is orthogonal to
    // the heading/fold plugins below (it only touches `pre > code`), so its position ahead of them does
    // not affect heading-id dedup.
    rehypeHighlightNarrow,
    [rehypeSpekHeadingIds, { idPrefix }],
  ];
  if (specShaped) rehypePlugins.push([rehypeSpekElideHeadingKeyword]);
  if (fold) rehypePlugins.push([rehypeSpekFoldSections, fold]);

  return (
    // `overflow-wrap` is inherited, so this covers prose as well as inline code: instruction text
    // is full of bare paths (`openspec/changes/<name>/brainstorm.md`) that have no space to break
    // at, and one of them widens the whole page on a phone. A page that overflows makes mobile
    // Safari zoom out to fit, which reads as the layout jumping on every selection.
    <div className="markdown-body [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
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
            return <h2 id={id} className={specShaped ? H2_STRUCTURAL : H2_CONTENT}>{children}</h2>;
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
            return <strong className="font-bold text-text-primary">{processChildren(children, true)}</strong>;
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
            // A fenced block with a language hint carries a `language-*` class (rehypeHighlightNarrow puts
            // `hljs` first, so match `language-` anywhere, not with startsWith). A bare ``` fence with no
            // language gets no such class, and the plugin never auto-detects. Tell it apart from inline
            // code another way: mdast-util-to-hast appends a trailing newline to every code *block*'s
            // text. An inline code span never has one, because its source line breaks fold to spaces. A
            // source-span check is wrong here: multi-line inline code (`` `a\nb` ``) spans two lines yet is
            // inline. Without this test a language-less block renders as an inline chip (amber text, pill
            // padding). The markdown-renderer spec forbids that ("plain, uncolored code").
            const classList = className?.split(/\s+/) ?? [];
            const hasLang = classList.some((c) => c.startsWith("language-"));
            const rawText = typeof children === "string" ? children : "";
            // A code block's text carries a trailing newline (mdast-util-to-hast appends one), except an
            // EMPTY fence, whose value is "" with no newline. So treat empty string as a block too — an
            // inline code span is never empty (`` `` `` is literal backticks, not a code node), so this
            // cannot misclassify inline code.
            const isBlock = hasLang || rawText === "" || rawText.endsWith("\n");
            if (isBlock) {
              // `bg-bg-tertiary` is required, not decorative. The VS Code webview injects its own
              // stylesheet onto a bare `<code>`. That paints the editor's code background, which is
              // dark even under a light theme. It shows through a highlighted block that sets no
              // background, and the block then reads dark on a light panel. The inline chip below uses
              // the same fix. This does not reproduce in a browser, which has no host stylesheet.
              // See CLAUDE.md.
              return (
                <code className={`${className ?? ""} block bg-bg-tertiary`}>
                  {children}
                </code>
              );
            }
            const text = typeof children === "string" ? children : String(children ?? "");
            // inline code 與 spec 參照本來就同色（差別在虛線底線），一起走 `--color-code-text`：
            // 深色維持既有的琥珀，淺色改用深一階的琥珀讓它符合 AA。頁面上其他連結仍走
            // `--color-accent`，那是 app 層級的對比問題（issue #43），不在這個 change 的範圍。
            if (specTopics?.includes(text)) {
              return (
                <Link
                  to={`/specs/${text}`}
                  className="bg-bg-tertiary text-code-text hover:text-accent-hover px-1.5 py-0.5 rounded text-sm underline decoration-dotted transition-colors"
                >
                  {text}
                </Link>
              );
            }
            return (
              <code className="bg-bg-tertiary text-code-text px-1.5 py-0.5 rounded text-sm">
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
          // 摺疊區塊。用原生 <details>/<summary>：它是唯一能被瀏覽器自身 find-in-page 找到的機制，
          // 而且鍵盤操作與輔助技術的狀態回報都不必自己重做。`group` 讓 summary 的箭頭能跟著 open 轉。
          details({ children, ...props }) {
            return (
              <details {...props} className="group">
                {children}
              </details>
            );
          },
          summary({ children }) {
            return (
              <summary className="list-none cursor-pointer flex items-baseline gap-1.5 [&::-webkit-details-marker]:hidden">
                <svg
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                  className="w-2.5 h-2.5 shrink-0 translate-y-px text-text-muted transition-transform group-open:rotate-90"
                >
                  <path d="M4 2.5 L8 6 L4 9.5 Z" fill="currentColor" />
                </svg>
                <span className="min-w-0 flex-1">{children}</span>
              </summary>
            );
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
