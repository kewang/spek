import { useMemo } from "react";
import { diffLines, type Change } from "diff";

interface SpecDiffViewerProps {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
}

export function SpecDiffViewer({ oldContent, newContent, oldLabel, newLabel }: SpecDiffViewerProps) {
  const changes = useMemo(() => diffLines(oldContent, newContent), [oldContent, newContent]);

  const hasChanges = changes.some((c) => c.added || c.removed);

  if (!hasChanges) {
    return (
      <div className="rounded-lg border border-border bg-bg-secondary p-6 text-center">
        <p className="text-text-muted">No differences found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {(oldLabel || newLabel) && (
        <div className="flex items-center gap-4 px-4 py-2 bg-bg-secondary border-b border-border text-xs text-text-muted">
          {oldLabel && <span className="text-status-error">--- {oldLabel}</span>}
          {newLabel && <span className="text-status-success">+++ {newLabel}</span>}
        </div>
      )}
      <div className="overflow-x-auto">
        {/* w-max min-w-full: rows share the widest row's width so tints span the full
            scrolled area instead of stopping at the first viewport width */}
        <pre className="text-sm leading-relaxed w-max min-w-full">
          {changes.map((change, i) => (
            <DiffBlock key={i} change={change} />
          ))}
        </pre>
      </div>
    </div>
  );
}

function DiffBlock({ change }: { change: Change }) {
  const lines = change.value.replace(/\n$/, "").split("\n");

  if (!change.added && !change.removed) {
    // 未變更的行：只顯示前後各 3 行作為上下文
    if (lines.length <= 6) {
      return (
        <>
          {lines.map((line, i) => (
            <div key={i} className="px-4 py-0.5">
              <span className="text-text-muted select-none inline-block w-5 mr-2"> </span>
              {line}
            </div>
          ))}
        </>
      );
    }

    const contextBefore = lines.slice(0, 3);
    const contextAfter = lines.slice(-3);

    return (
      <>
        {contextBefore.map((line, i) => (
          <div key={`b-${i}`} className="px-4 py-0.5">
            <span className="text-text-muted select-none inline-block w-5 mr-2"> </span>
            {line}
          </div>
        ))}
        <div className="py-1 bg-bg-secondary text-text-muted text-xs border-y border-border">
          {/* sticky left-0: the bar itself spans the full scroll width, but its label stays
              pinned in view instead of centering into the middle of a wide diff */}
          <span className="sticky left-0 inline-block px-4">
            ··· {lines.length - 6} lines hidden ···
          </span>
        </div>
        {contextAfter.map((line, i) => (
          <div key={`a-${i}`} className="px-4 py-0.5">
            <span className="text-text-muted select-none inline-block w-5 mr-2"> </span>
            {line}
          </div>
        ))}
      </>
    );
  }

  const bgClass = change.added ? "bg-status-success/10" : "bg-status-error/10";
  const textClass = change.added ? "text-status-success" : "text-status-error";
  const prefix = change.added ? "+" : "-";

  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className={`px-4 py-0.5 ${bgClass}`}>
          <span className={`${textClass} select-none inline-block w-5 mr-2`}>{prefix}</span>
          <span className={textClass}>{line}</span>
        </div>
      ))}
    </>
  );
}
