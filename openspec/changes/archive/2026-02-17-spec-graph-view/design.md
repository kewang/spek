## Context

spek 目前以列表方式呈現 Specs 和 Changes，使用者需要進入個別頁面才能看到它們的關聯。`scanOpenSpec` 已經在掃描時遍歷所有 change 目錄來計算 `historyCount`，代表關聯資料已隱含在掃描過程中，只是沒有結構化暴露出來。

前端使用 React 19 + Tailwind + React Router v7，透過 `ApiAdapter` 介面抽象通訊層（Fetch / Message / Static 三種實作）。新功能需要遵循這個模式。

## Goals / Non-Goals

**Goals:**
- 新增 `/graph` 頁面，以 force-directed 圖表呈現 specs 與 changes 的關聯
- 圖表支援拖曳、hover 高亮、點擊導航、縮放平移
- 在 Web、VS Code Webview、Demo 三種模式下都能運作
- 節點大小反映重要性（spec 的 historyCount、change 關聯的 spec 數量）

**Non-Goals:**
- Spec → Spec 的交叉引用（未來 wiki-link 語法的範疇）
- 時間軸佈局或雙欄佈局（先做 force-directed，其他佈局未來擴展）
- 圖表匯出（截圖、SVG 下載等）
- 圖表內的篩選或搜尋功能

## Decisions

### 1. 圖表資料來源：新增 `buildGraphData` core 函式 + API endpoint

**選擇**：在 `@spek/core` 新增 `buildGraphData(repoDir)` 函式，一次掃描回傳結構化的 nodes + edges。

**替代方案**：前端從現有 `getSpecs()` + 逐一 `getSpec(topic)` 組合資料。
**拒絕原因**：N+1 查詢，spec 數量多時效能差。

**資料結構**：
```typescript
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
interface GraphNode {
  id: string;
  type: "spec" | "change";
  label: string;
  date?: string | null;       // change only
  status?: "active" | "archived";  // change only
  historyCount?: number;      // spec only
  specCount?: number;         // change only: 關聯幾個 specs
}
interface GraphEdge {
  source: string;  // change node id（格式 "change:{slug}"）
  target: string;  // spec node id（格式 "spec:{topic}"）
}
```

節點 id 用 `"spec:{topic}"` / `"change:{slug}"` 前綴避免命名衝突。

### 2. 圖表渲染：D3 force simulation + SVG in React ref

**選擇**：使用 `d3-force`、`d3-selection`、`d3-zoom`、`d3-drag` 模組，在 React component 中透過 ref 操作 SVG。

**替代方案 A**：React Flow — 偏向流程圖/節點編輯器，force layout 非原生支援。
**替代方案 B**：純 React re-render 同步 D3 tick — 高頻 tick 觸發 React re-render 效能不佳。

**拒絕原因**：D3 直接操作 SVG 是 force-directed graph 的標準做法，效能最好、彈性最大。React 只負責容器 mount/unmount 生命週期。

### 3. 節點視覺設計

- **Spec 節點**：圓形，琥珀色（accent #f59e0b），半徑依 `historyCount` 縮放（min 20, max 45）
- **Change 節點**：圓角矩形，active 為綠色、archived 為藍灰色，大小依 `specCount` 縮放
- **邊**：淺灰色連線，hover 時高亮為白色
- **文字標籤**：節點旁顯示 topic/description，字型 12px，超長截斷
- 符合現有深色主題（背景 #0a0c0f 系列）

### 4. 互動行為

- **拖曳**：D3 drag behavior，拖曳時固定節點位置，放開後可選擇保持或釋放
- **Hover**：高亮該節點 + 所有相連的邊和鄰居節點，其餘降低 opacity
- **點擊**：spec 節點導航至 `/specs/:topic`，change 節點導航至 `/changes/:slug`
- **縮放平移**：D3 zoom behavior，含 zoom extent 限制（0.3x ~ 3x）

### 5. ApiAdapter 擴展

在 `ApiAdapter` 介面新增 `getGraphData(): Promise<GraphData>`：
- `FetchAdapter`：呼叫 `GET /api/openspec/graph?dir=...`
- `MessageAdapter`：透過 postMessage `{ type: "getGraphData" }`
- `StaticAdapter`：從 `window.__DEMO_DATA__.graphData` 讀取

### 6. 不含 `hasSpecs` 的 changes 處理

沒有 `specs/` 目錄的 changes（如純文件 change）不會出現在圖表中，因為它們沒有邊。只顯示有關聯的節點，避免圖表雜訊。

## Risks / Trade-offs

- **D3 bundle size**：d3-force + d3-selection + d3-zoom + d3-drag 約增加 ~40KB gzipped。→ 透過只 import 需要的 d3 子模組控制大小。
- **大型 repo 效能**：如果 specs 和 changes 數量極大（數百個節點），force simulation 可能變慢。→ 目前 spek 本身只有 26 specs + 24 changes，短期內不是問題。未來可加 node limit 或 lazy loading。
- **D3 與 React 整合**：D3 直接操作 DOM 繞過 React，可能造成 React 預期外的 DOM 狀態。→ 限制 D3 操作範圍在單一 ref container 內，React 只負責 mount/unmount 該容器。
- **VS Code Webview CSP**：D3 不需要 eval 或 inline script，SVG 操作相容現有 CSP 設定（IIFE + nonce）。→ 低風險。
