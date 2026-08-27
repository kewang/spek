import { useEffect, useMemo, type ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { extractHeadings } from "@spekjs/core/headings";
import type { ChangeArtifact } from "@spekjs/core";
import { useChange, useSpecs } from "../hooks/useOpenSpec";
import { TabView } from "../components/TabView";
import { TaskProgress } from "../components/TaskProgress";
import { TaskText } from "../components/TaskText";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { SpecsTabContent } from "../components/SpecsTabContent";
import { SpecToc } from "../components/SpecToc";
import { SchemaBadge } from "../components/SchemaBadge";
import { formatLifecycleBanner, todayIso } from "../utils/lifecycle";
import { useArtifactSort } from "../hooks/useArtifactSort";
import { FoldControls } from "../components/FoldControls";
import { foldOptionsFor, useSpecFold, type SpecFold } from "../hooks/useSpecFold";
import { sortArtifacts, type ArtifactSortMode } from "@spekjs/core/artifact-order";
import { scrollToAnchorId } from "../utils/scrollOffset";
import { isMarkdownLike, dataLanguage, dataTabNames, fencedBlock } from "../utils/dataArtifact";

const TOC_MIN_HEADINGS = 3;

// 對齊 @spekjs/core 的 parseSlug：去掉開頭 YYYY-MM-DD- 前綴並把 dash 轉空格
function slugTitle(slug: string): string {
  const m = slug.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  return (m ? m[1] : slug).replace(/-/g, " ");
}

// Compile-time exhaustiveness guard: if a new ArtifactKind is added without a branch in renderArtifact,
// `kind` is not `never` at the call site and this fails to type-check. It does not throw, on purpose.
// renderArtifact runs for the mounted tab, and a host can present a kind this bundle predates. IntelliJ's
// ChangeArtifact.kind is a free-form String, its webview bundle is a build artifact that goes stale, and
// @spekjs/core's ArtifactKind is on its own published line. Throwing here unmounts the whole page, because
// there is no error boundary. So the caller returns a graceful fallback instead.
function assertNever(_kind: never): void {}

function renderArtifact(artifact: ChangeArtifact, specTopics: string[], fold: SpecFold) {
  if (artifact.kind === "markdown") {
    // proposal / design 等 markdown artifact 不摺疊 —— 只有 spec 形狀的內容摺
    return artifact.content ? (
      <MarkdownRenderer content={artifact.content} specTopics={specTopics} />
    ) : (
      <p className="text-text-muted text-sm">No content</p>
    );
  }
  if (artifact.kind === "data") {
    // data artifact（.yaml/.yml/.json）走同一條 highlight 管線的 fenced block；無 TOC、不摺疊。
    return artifact.content != null ? (
      <MarkdownRenderer content={fencedBlock(artifact.content, dataLanguage(artifact.title))} />
    ) : (
      <p className="text-text-muted text-sm">No content</p>
    );
  }
  if (artifact.kind === "specs") {
    return artifact.specs && artifact.specs.length > 0 ? (
      <SpecsTabContent
        key={fold.generation}
        specs={artifact.specs}
        fold={foldOptionsFor(fold.mode)}
      />
    ) : (
      <p className="text-text-muted text-sm">No delta specs</p>
    );
  }
  // 到這裡只可能是 tasks；若日後新增 kind 卻沒補分支，assertNever 會在型別層報錯（不 throw）。
  // 執行期則優雅退場：顯示提示而非讓未知 kind 讓整頁崩掉。
  if (artifact.kind !== "tasks") {
    assertNever(artifact.kind);
    return <p className="text-text-muted text-sm">Unsupported artifact type</p>;
  }
  return artifact.tasks ? (
    <div className="space-y-4">
      <TaskProgress completed={artifact.tasks.completed} total={artifact.tasks.total} />
      <div className="space-y-4">
        {artifact.tasks.sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-text-secondary mb-2">{section.title}</h3>
            <div className="space-y-1">
              {/* A completed task carries no opacity: opacity composites every descendant toward the
                  page, including the links and inline code spans a task's Markdown carries, each of
                  which sets its own colour. Nothing in the row passed in either theme while it was
                  applied — body text 3.24:1 dark / 2.77:1 light, a link 3.64 / 1.89. The de-emphasis
                  is a colour instead, so a child with its own colour keeps it at full strength. */}
              {section.tasks.map((task, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {task.completed ? (
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-status-success" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.2" />
                      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-text-muted" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  )}
                  {/* A div, not a span: task text is Markdown and may contain block content
                      (lists, code). As a flex item its display is blockified either way, so the
                      single-line appearance is unchanged. min-w-0 lets a code block scroll inside
                      the row instead of widening it. */}
                  <div className={`min-w-0 ${task.completed ? "text-text-muted line-through" : "text-text-primary"}`}>
                    <TaskText text={task.text} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <p className="text-text-muted text-sm">No content</p>
  );
}

const SORT_OPTIONS: { mode: ArtifactSortMode; label: string }[] = [
  { mode: "modified", label: "Last modified" },
  { mode: "schema", label: "Schema order" },
  { mode: "alpha", label: "A–Z" },
];

// Change 詳情的 artifact tab 排序控制（segmented control）。schemaFallback 為真時，
// 在 "Schema order" 選項標上 * 表示目前顯示的是退回的預設順序而非真實 schema 順序。
function ArtifactSortControl({
  mode,
  onChange,
  schemaFallback,
}: {
  mode: ArtifactSortMode;
  onChange: (m: ArtifactSortMode) => void;
  schemaFallback: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Sort artifacts"
      className="inline-flex items-center gap-0.5 rounded border border-border bg-bg-tertiary p-0.5 text-[11px]"
    >
      {SORT_OPTIONS.map((opt) => {
        const active = opt.mode === mode;
        const mark = opt.mode === "schema" && schemaFallback;
        return (
          <button
            key={opt.mode}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.mode)}
            title={
              mark
                ? "Schema order unavailable — showing default order"
                : `Sort by ${opt.label.toLowerCase()}`
            }
            className={
              "rounded px-1.5 py-0.5 transition-colors " +
              (active
                ? "bg-bg-secondary text-accent font-medium"
                : "text-text-muted hover:text-text-secondary")
            }
          >
            {opt.label}
            {mark ? " *" : ""}
          </button>
        );
      })}
    </div>
  );
}

export function ChangeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // 聚合視圖下，wt 指定要從哪個 worktree 讀這個 change（同名 slug 辨識用）
  const wt = searchParams.get("wt") ?? undefined;
  const { data, loading, error } = useChange(slug ?? "", wt);
  const { data: specsData } = useSpecs();
  const specTopics = specsData?.map((s) => s.topic) ?? [];

  const [sortMode, setSortMode] = useArtifactSort();
  const fold = useSpecFold();
  const rawArtifacts = useMemo(() => data?.artifacts ?? [], [data]);
  const schemaOrder = data?.schemaOrder;
  // 依使用者選擇的模式重新排序（modified = core 交付的 mtime 序，即 last-modified）
  const artifacts = useMemo(
    () => sortArtifacts(rawArtifacts, sortMode, schemaOrder),
    [rawArtifacts, sortMode, schemaOrder],
  );

  // 活躍 tab：?tab=<artifact-id>；不存在或未知時 fallback 回第一個 artifact
  const tabParam = searchParams.get("tab");
  const activeArtifact =
    artifacts.find((a) => a.id === tabParam) ?? artifacts[0] ?? null;
  const activeTab = activeArtifact?.id ?? "";

  const currentHeadings = useMemo(() => {
    if (!activeArtifact || !isMarkdownLike(activeArtifact.kind)) return [];
    if (activeArtifact.kind === "markdown") {
      return activeArtifact.content ? extractHeadings(activeArtifact.content) : [];
    }
    // specs：每個 delta spec heading 以 topic 前綴避免 id 碰撞
    return (activeArtifact.specs ?? []).flatMap((s) =>
      extractHeadings(s.content).map((h) => ({ ...h, slug: `${s.topic}--${h.slug}` })),
    );
  }, [activeArtifact]);

  // Tab 切換時：URL 只保留 ?tab=<id>，同步清掉 hash（不同 tab 的舊 heading 已無意義），
  // 並把 window 捲回頂端，避免停留在上一個 tab 的視窗位置。
  const handleTabChange = (id: string) => {
    const next: Record<string, string> = { tab: id };
    if (wt) next.wt = wt;
    setSearchParams(next, { replace: false });
    if (location.hash) {
      const wtq = wt ? `&wt=${encodeURIComponent(wt)}` : "";
      window.history.replaceState(null, "", `${location.pathname}?tab=${id}${wtq}`);
    }
    window.scrollTo(0, 0);
  };

  // Hash 錨點：在內容就緒 + hash 或 tab 變更時，捲到對應 heading（等 markdown render 完再試）
  useEffect(() => {
    if (!data) return;
    const hash = location.hash.replace(/^#/, "");
    if (!hash) return;

    let attempts = 0;
    let rafId: number | null = null;

    const tryScroll = () => {
      if (scrollToAnchorId(hash)) return;
      if (attempts++ < 10) {
        rafId = requestAnimationFrame(tryScroll);
      }
    };

    rafId = requestAnimationFrame(tryScroll);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [data, activeTab, location.hash]);

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-status-error">Error: {error}</p>;
  if (!data) return <p className="text-text-muted">Change not found</p>;

  // A data tab shows its stem as the label plus a format badge, not the raw filename (dataTabNames owns the
  // stem/collision rule).
  const dataNames = dataTabNames(artifacts);
  const tabs = artifacts.map((artifact) => {
    let label: ReactNode = artifact.title;
    const dataName = dataNames.get(artifact.id);
    if (dataName) {
      label = (
        <span className="inline-flex items-center gap-1.5">
          {dataName.name}
          <span className="rounded bg-bg-tertiary px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-text-muted">
            {dataName.format}
          </span>
        </span>
      );
    }
    return {
      id: artifact.id,
      label,
      // Only the mounted tab renders. TabView shows just activeTab.content. Building content for every
      // artifact ran each data tab's fencedBlock scan on every re-render (tab switch, sort, fold, watcher
      // refresh). Rendering only the active one bounds that scan to one artifact.
      content: artifact.id === activeTab ? renderArtifact(artifact, specTopics, fold) : null,
    };
  });

  const lifecycleBanner = formatLifecycleBanner(data, todayIso());
  const title = slug ? slugTitle(slug) : "";

  // schema-order 模式但 schemaOrder 不可用 → 退回預設順序，並向使用者說明原因
  const schemaFallback = sortMode === "schema" && (!schemaOrder || schemaOrder.length === 0);
  // active change 的 schemaOrder 可能因多種原因為空（CLI 未安裝、無 planningArtifacts、outputPath
  // 對不上、逾時、非 0 結束），故此處不指定單一成因，與 * tooltip 的「Schema order unavailable」一致
  const fallbackMessage =
    data.status === "archived"
      ? "Schema order isn't tracked for archived changes — showing default order."
      : "Schema order unavailable — showing default spec-driven order.";

  const headerEl = (
    <div className="pt-2 pb-3">
      <Link to="/changes" className="text-text-muted text-base font-medium hover:text-accent transition-colors">
        &larr; Back to Changes
      </Link>
      <h1 className="text-2xl font-bold mt-2" title={slug}>{title}</h1>
      <div className="flex items-center gap-2 mt-2 mb-1">
        <SchemaBadge schema={data.schema} defaultSchema={data.defaultSchema} />
        {lifecycleBanner && (
          <p className="text-text-muted text-xs tracking-wide [word-spacing:0.15em]">{lifecycleBanner}</p>
        )}
        <div className="ml-auto flex items-center gap-3">
          {/* 摺疊只作用在 specs tab，控制項也只在那裡出現 */}
          {activeArtifact?.kind === "specs" && (
            <FoldControls mode={fold.mode} onChange={fold.setMode} />
          )}
          {artifacts.length >= 2 && (
            <ArtifactSortControl mode={sortMode} onChange={setSortMode} schemaFallback={schemaFallback} />
          )}
        </div>
      </div>
      {artifacts.length >= 2 && schemaFallback && (
        <p className="mt-1 flex items-center gap-1 text-text-muted text-[11px]">
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z"
              clipRule="evenodd"
            />
          </svg>
          {fallbackMessage}
        </p>
      )}
    </div>
  );

  const showToc =
    activeArtifact !== null &&
    isMarkdownLike(activeArtifact.kind) &&
    currentHeadings.length >= TOC_MIN_HEADINGS;

  return (
    <div className={showToc ? "xl:grid xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-8" : ""}>
      <div className="min-w-0">
        <TabView tabs={tabs} header={headerEl} sticky activeId={activeTab} onChange={handleTabChange} />
      </div>
      {showToc && (
        <aside className="hidden xl:block xl:pt-2">
          {/* specs tab 才是 spec 形狀的內容；proposal / design 的標題照原文顯示。 */}
          <SpecToc
            key={activeTab}
            headings={currentHeadings}
            specShaped={activeArtifact?.kind === "specs"}
          />
        </aside>
      )}
    </div>
  );
}
