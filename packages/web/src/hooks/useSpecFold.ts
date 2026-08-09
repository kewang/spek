import { useCallback, useState } from "react";
import type { FoldOptions } from "../utils/foldSections";

const STORAGE_KEY = "spek:spec-fold";

export type FoldMode = "default" | "expanded" | "collapsed";
const MODES: FoldMode[] = ["default", "expanded", "collapsed"];

/** Requirement (h3) and Scenario (h4) fold; `## Requirements` and above stay plain separators. */
export const FOLD_LEVELS = [3, 4];

const OPEN_LEVELS: Record<FoldMode, number[]> = {
  default: [3],
  expanded: [3, 4],
  collapsed: [],
};

/** The plugin options a mode implies. */
export function foldOptionsFor(mode: FoldMode): FoldOptions {
  return { levels: FOLD_LEVELS, openLevels: OPEN_LEVELS[mode] };
}

function readStored(): FoldMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (MODES as string[]).includes(v)) return v as FoldMode;
  } catch {
    // localStorage unavailable (embedded host / privacy mode)
  }
  return "default";
}

export interface SpecFold {
  mode: FoldMode;
  setMode: (next: FoldMode) => void;
  /**
   * Bumped on every bulk action and used as the renderer container's `key`. The `<details>` elements
   * are uncontrolled — their `open` attribute is an initial value the browser then owns, which is what
   * keeps find-in-page and the disclosure widget from fighting a React-managed prop — so the only way
   * to force a new initial state is to remount. Discarding the reader's ad-hoc toggles is exactly what
   * they just asked for.
   */
  generation: number;
}

/**
 * Global (across every spec) fold preference, persisted in localStorage. Modelled on
 * `useArtifactSort`: defaults quietly and keeps working for the session when storage throws.
 */
export function useSpecFold(): SpecFold {
  const [mode, setModeState] = useState<FoldMode>(readStored);
  const [generation, setGeneration] = useState(0);

  const setMode = useCallback((next: FoldMode) => {
    setModeState(next);
    setGeneration((g) => g + 1);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore: preference applies to this session only
    }
  }, []);

  return { mode, setMode, generation };
}
