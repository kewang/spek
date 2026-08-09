import { useCallback, useState } from "react";
import { ARTIFACT_SORT_MODES, type ArtifactSortMode } from "@spekjs/core/artifact-order";

const STORAGE_KEY = "spek:artifact-sort";

// 讀取已儲存的排序偏好；localStorage 不可用（隱私模式 / 嵌入環境）或無效值時回預設 modified
function readStored(): ArtifactSortMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (ARTIFACT_SORT_MODES as readonly string[]).includes(v)) return v as ArtifactSortMode;
  } catch {
    // 忽略：localStorage 不可用
  }
  return "modified";
}

/**
 * 全域（跨所有 change）的 artifact 排序偏好，持久化於 localStorage。
 * 預設 modified（last-modified）；讀寫失敗一律靜默退回預設，不影響當前 session 使用。
 */
export function useArtifactSort(): [ArtifactSortMode, (mode: ArtifactSortMode) => void] {
  const [mode, setMode] = useState<ArtifactSortMode>(readStored);
  const update = useCallback((next: ArtifactSortMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 忽略：localStorage 不可用（偏好僅在本 session 生效）
    }
  }, []);
  return [mode, update];
}
