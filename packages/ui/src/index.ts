/**
 * `@spekjs/ui` —— 可重用的 OpenSpec 視覺化。
 *
 * 兩個元件，都是**純呈現層**：資料由 props 進來、使用者的選擇由回呼出去。它們**不知道**宿主有沒有
 * router、資料怎麼來、主題怎麼切 —— 因為宿主之間這三件事完全不同（spek web 走 HTTP + react-router，
 * spek-workspace 是 Electron，走 IPC、沒有 router）。
 *
 * 宿主要做的只有三件事：
 *
 * 1. `import '@spekjs/ui/styles.css'`
 * 2. 餵資料（`GraphData` / `Lane[]`），接回呼（`onSelectChange` / `onSelectSpec`）
 * 3.（可選）在自己的 `:root` 覆寫全部 9 個顏色變數換膚（漏掉的那個會留在套件的深色預設值）
 */

export { SpecGraph, type SpecGraphProps } from "./SpecGraph.js";

export {
  ChangeTimeline,
  type ChangeTimelineProps,
  type TimelineMetrics,
} from "./timeline/ChangeTimeline.js";

export { type BarHoverPayload } from "./timeline/TimelineBar.js";

/** lane 的推導是純函式 —— 宿主先套用自己的 filter，再交給 `ChangeTimeline`。 */
export {
  buildLanes,
  changeTopicsMap,
  type BuildLanesResult,
  type Lane,
  type LaneItem,
} from "./timeline/grouping.js";

/**
 * Graph node id parsing. Owned by `@spekjs/core`, which produces the format; re-exported here so hosts
 * that adopted it from this package keep working. A host that only needs the parsing should import
 * `@spekjs/core/graph-node-id` directly — it pulls in neither React nor d3.
 */
export { changeNodeSlug } from "@spekjs/core/graph-node-id";

/** 時間軸的刻度規則。宿主通常用不到，但它是這張圖的核心邏輯，值得暴露。 */
export {
  dateRange,
  formatTickLabel,
  generateTicks,
  padDomain,
  scaleTime,
  type TickSet,
} from "./timeline/scale.js";

/** 顏色契約。宿主可據此程式化地設定變數，或直接在 CSS 覆寫。 */
export { CSS_VARS } from "./theme.js";
