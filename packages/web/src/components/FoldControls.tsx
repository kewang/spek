import type { FoldMode } from "../hooks/useSpecFold";

interface FoldControlsProps {
  mode: FoldMode;
  onChange: (mode: FoldMode) => void;
}

const BASE =
  "text-xs px-2 py-0.5 rounded border transition-colors border-border text-text-muted hover:text-accent hover:border-accent";
const ACTIVE = "text-xs px-2 py-0.5 rounded border transition-colors border-accent text-accent bg-accent/10";

/**
 * Expand all / Collapse all for a spec's folded sections. `default` (requirements open, scenarios
 * closed) is the resting state and has no button of its own — it is what neither being active means.
 */
export function FoldControls({ mode, onChange }: FoldControlsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(mode === "expanded" ? "default" : "expanded")}
        className={mode === "expanded" ? ACTIVE : BASE}
        aria-pressed={mode === "expanded"}
      >
        Expand all
      </button>
      <button
        onClick={() => onChange(mode === "collapsed" ? "default" : "collapsed")}
        className={mode === "collapsed" ? ACTIVE : BASE}
        aria-pressed={mode === "collapsed"}
      >
        Collapse all
      </button>
    </div>
  );
}
