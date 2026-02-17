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
          {oldLabel && <span className="text-red-400">--- {oldLabel}</span>}
          {newLabel && <span className="text-green-400">+++ {newLabel}</span>}
        </div>
      )}
      <div className="overflow-x-auto">
        <pre className="text-sm leading-relaxed">
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
        <div className="px-4 py-1 bg-bg-secondary text-text-muted text-xs text-center border-y border-border">
          ··· {lines.length - 6} lines hidden ···
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

  const bgClass = change.added ? "bg-green-400/10" : "bg-red-400/10";
  const textClass = change.added ? "text-green-400" : "text-red-400";
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
