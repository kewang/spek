import { useLocation, useNavigate } from "react-router-dom";
import { specHeadingLabel, type Heading } from "@spekjs/core/headings";
import { useScrollspy } from "../hooks/useScrollspy";
import { scrollToAnchorId } from "../utils/scrollOffset";

interface SpecTocProps {
  headings: Heading[];
  /**
   * 這些 heading 來自 spec 形狀的內容，entry 要跟內文一樣不重複格式關鍵字。
   *
   * 由呼叫端宣告而不是在這裡看文字判斷：同一個元件也服務 change 的 proposal / design tab，那些不是
   * spec，其中剛好叫 `Requirement: …` 的標題不該被剝 —— 「不得以內容文字推斷 spec 形狀」是既有規範。
   */
  specShaped?: boolean;
}

export function SpecToc({ headings, specShaped }: SpecTocProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const ids = headings.map((h) => h.slug);
  const activeId = useScrollspy(ids);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    scrollToAnchorId(slug);
    navigate(`${location.pathname}${location.search}#${slug}`, { replace: false });
  };

  return (
    <nav
      aria-label="Table of contents"
      className="sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto text-sm"
    >
      <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        On this page
      </div>
      <ul className="space-y-1 border-l border-border">
        {headings.map((h) => {
          const isActive = activeId === h.slug;
          const indentClass = h.level === 3 ? "pl-6" : "pl-3";
          const activeClass = isActive
            ? "border-l-2 -ml-px border-accent text-accent"
            : "text-text-muted hover:text-text-primary border-l-2 -ml-px border-transparent";
          return (
            <li key={h.slug}>
              <a
                href={`#${h.slug}`}
                onClick={(e) => handleClick(e, h.slug)}
                className={`block py-1 ${indentClass} transition-colors ${activeClass}`}
              >
                {/* 只有 label 變，錨點仍是原文推導出來的 slug。 */}
                {specShaped ? specHeadingLabel(h.text) : h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
