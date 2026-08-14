import type { GraphData, GraphNode } from "@spekjs/core";
import { drag } from "d3-drag";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity } from "d3-zoom";
import { useEffect, useRef } from "react";
import { changeNodeSlug } from "@spekjs/core/graph-node-id";
import { CSS_VARS, resolveColor } from "./theme.js";

interface SimNode extends SimulationNodeDatum, GraphNode {
  x: number;
  y: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode;
  target: SimNode;
}

export interface SpecGraphProps {
  data: GraphData;
  /** 使用者觸發一個 spec 節點。宿主決定要做什麼（web 導頁、Electron 開側欄）。 */
  onSelectSpec?: (topic: string) => void;
  /**
   * 使用者觸發一個 change 節點。`worktreeKey` 只有聚合掃描才有值 —— 非聚合的宿主可以忽略它。
   */
  onSelectChange?: (slug: string, worktreeKey?: string) => void;
  /**
   * 主題變動的訊號。
   *
   * d3 把顏色**寫進 SVG 屬性**（命令式），不能用 `var()` —— 所以宿主換膚時必須重畫一次。
   * 元件**不去偵測**宿主的主題（監看 `data-theme` 之類都是在猜宿主的實作），而是由宿主換一個值
   * 來明說「該重畫了」。只有單一主題的宿主不必傳。
   */
  themeKey?: string | number;
  /** 是否顯示圖例。 */
  legend?: boolean;
}

function truncateLabel(label: string, max = 25): string {
  return label.length > max ? label.slice(0, max) + "..." : label;
}

function nodeRadius(node: SimNode): number {
  if (node.type === "spec") {
    const count = node.historyCount || 0;
    return Math.min(45, Math.max(20, 20 + count * 5));
  }
  const count = node.specCount || 1;
  return Math.min(40, Math.max(18, 14 + count * 6));
}

/**
 * spec ↔ change 的力導向關聯圖。
 *
 * **它與 `ChangeTimeline` 是兩個不同的視覺化**：這裡呈現的是「哪個 change 動到哪些 spec」的
 * 關聯結構，沒有時間概念；時間軸是 Timeline 的事。
 *
 * 這個元件會**填滿它的父容器**（父容器要有明確的高度，並設 `position: relative` 才能讓圖例定位）。
 */
export function SpecGraph({
  data,
  onSelectSpec,
  onSelectChange,
  themeKey,
  legend = true,
}: SpecGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // 回呼放進 ref：它們每次渲染都是新的閉包，但 d3 的 effect 不該為此重跑整個模擬。
  const onSelectSpecRef = useRef(onSelectSpec);
  onSelectSpecRef.current = onSelectSpec;
  const onSelectChangeRef = useRef(onSelectChange);
  onSelectChangeRef.current = onSelectChange;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const container = svg.parentElement!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 主題色在繪製當下解出來（d3 寫的是屬性，不是 var()）。
    // 連線走 text-muted 而不是 border：border 是面板髮絲線，全強度也只有 1.22:1（深）／1.13:1（淺），
    // 沒有任何透明度能讓它畫出看得見的邊 —— 而一條連線就是它要表達的那個關係本身。0.85 是兩個主題都
    // 清得過 3:1 的最輕一階（4.37 / 3.81；0.75 在淺色只有 3.24）。
    const edgeColor = resolveColor(CSS_VARS.textMuted);
    const EDGE_OPACITY = 0.85;
    const edgeHighlight = resolveColor(CSS_VARS.textPrimary);
    const specColor = resolveColor(CSS_VARS.accent);
    const activeColor = resolveColor(CSS_VARS.nodeActive);
    const archivedColor = resolveColor(CSS_VARS.textMuted);
    const NODE_FILL_OPACITY = 0.85;
    const labelColor = resolveColor(CSS_VARS.textSecondary);

    // 清除舊內容
    const sel = select(svg);
    sel.selectAll("*").remove();
    sel.attr("width", width).attr("height", height);

    // 準備資料（deep copy 避免 D3 mutation 衝突）
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n, x: 0, y: 0 }) as SimNode);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = data.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
      }));

    // 建立鄰接表（hover 用）
    const neighbors = new Map<string, Set<string>>();
    for (const link of links) {
      const sId = link.source.id;
      const tId = link.target.id;
      if (!neighbors.has(sId)) neighbors.set(sId, new Set());
      if (!neighbors.has(tId)) neighbors.set(tId, new Set());
      neighbors.get(sId)!.add(tId);
      neighbors.get(tId)!.add(sId);
    }

    // 建立 zoom container
    const g = sel.append("g");

    // Edges
    const linkSel = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", edgeColor)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", EDGE_OPACITY);

    // Node groups
    const nodeSel = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer");

    // Spec 節點：圓形。這些顏色是視覺化自己的調色盤，不是宿主的主題色。
    nodeSel
      .filter((d) => d.type === "spec")
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", specColor)
      .attr("fill-opacity", NODE_FILL_OPACITY)
      // 描邊取填色本身：比填色亮一階是深色主題的假設，淺底下框線得往暗走，而套件無從得知往哪邊。
      // 量出來框對填只有 1.31–1.39:1，所以它撐的是節點外緣壓在頁面上的那半邊，不是框與填的對比。
      .attr("stroke", specColor)
      .attr("stroke-width", 2);

    // Change 節點：圓角矩形
    nodeSel
      .filter((d) => d.type === "change")
      .append("rect")
      .attr("width", (d) => nodeRadius(d) * 2)
      .attr("height", (d) => nodeRadius(d) * 1.4)
      .attr("x", (d) => -nodeRadius(d))
      .attr("y", (d) => -nodeRadius(d) * 0.7)
      .attr("rx", 6)
      .attr("fill", (d) => (d.status === "active" ? activeColor : archivedColor))
      .attr("fill-opacity", NODE_FILL_OPACITY)
      .attr("stroke", (d) => (d.status === "active" ? activeColor : archivedColor))
      .attr("stroke-width", 2);

    // 標籤
    nodeSel
      .append("text")
      .text((d) => truncateLabel(d.label))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadius(d) + 16)
      .attr("fill", labelColor)
      .attr("font-size", 12)
      // A halo of the page colour, drawn behind the glyphs (`paint-order`), so a label keeps its own
      // background when the layout drifts another node under it. A label sits below *its* node and never on
      // it, but nodes collide: measured against a node fill a label is 1.06–1.84:1 in either theme, and
      // this change made the light case worse by giving the fills the saturation they were missing
      // (a spec node went 3.91:1 → 1.48:1). With the halo the label is read against `bg-primary` — 7.64:1
      // dark, 7.24:1 light — whatever it happens to overlap.
      .attr("paint-order", "stroke")
      .attr("stroke", resolveColor(CSS_VARS.bgPrimary))
      .attr("stroke-width", 3)
      .attr("stroke-linejoin", "round")
      .attr("pointer-events", "none");

    // 聚合圖：非主 worktree 的 change 節點以 <title> 標示來源 worktree / branch
    nodeSel
      .filter((d) => d.type === "change" && !!d.source && !d.source.isMain)
      .append("title")
      .text((d) => `${d.label} · ${d.source?.branch ?? "detached"}`);

    // Hover 互動
    nodeSel
      .on("mouseenter", (_event, d) => {
        const connected = neighbors.get(d.id) || new Set<string>();
        nodeSel.attr("opacity", (n) => (n.id === d.id || connected.has(n.id) ? 1 : 0.1));
        linkSel
          .attr("stroke-opacity", (l) =>
            l.source.id === d.id || l.target.id === d.id ? 0.9 : 0.05,
          )
          .attr("stroke", (l) =>
            l.source.id === d.id || l.target.id === d.id ? edgeHighlight : edgeColor,
          );
      })
      .on("mouseleave", () => {
        nodeSel.attr("opacity", 1);
        linkSel.attr("stroke-opacity", EDGE_OPACITY).attr("stroke", edgeColor);
      });

    // Click（區分 drag vs click）。**元件不導航** —— 它只回報使用者選了什麼。
    let dragged = false;
    nodeSel.on("click", (_event, d) => {
      if (dragged) return;
      if (d.type === "spec") {
        onSelectSpecRef.current?.(d.label);
      } else {
        onSelectChangeRef.current?.(changeNodeSlug(d), d.source?.key);
      }
    });

    // Force simulation
    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(80),
      )
      .force("charge", forceManyBody().strength(-120))
      .force("center", forceCenter(width / 2, height / 2))
      .force("x", forceX(width / 2).strength(0.05))
      .force("y", forceY(height / 2).strength(0.05))
      .force("collide", forceCollide<SimNode>().radius((d) => nodeRadius(d) + 8))
      .on("tick", () => {
        linkSel
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);
        nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    // Drag 互動
    const dragBehavior = drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        dragged = false;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        dragged = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSel.call(dragBehavior);

    // Zoom + pan
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    sel.call(zoomBehavior);

    // 等 simulation 穩定後 fit to viewport
    simulation.on("end", () => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of nodes) {
        const r = nodeRadius(n) + 20;
        if (n.x - r < minX) minX = n.x - r;
        if (n.y - r < minY) minY = n.y - r;
        if (n.x + r > maxX) maxX = n.x + r;
        if (n.y + r > maxY) maxY = n.y + r;
      }
      const bw = maxX - minX;
      const bh = maxY - minY;
      if (bw <= 0 || bh <= 0) return;

      const padding = 60;
      const scale = Math.min((width - padding * 2) / bw, (height - padding * 2) / bh, 1.5);
      const tx = width / 2 - (minX + bw / 2) * scale;
      const ty = height / 2 - (minY + bh / 2) * scale;

      sel
        .transition()
        .duration(500)
        .call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(scale));
    });

    return () => {
      simulation.stop();
    };
  }, [data, themeKey]);

  return (
    <>
      <svg ref={svgRef} className="spekui-graph" />
      {legend && <Legend />}
    </>
  );
}

function Legend() {
  return (
    <div className="spekui-legend">
      <div className="spekui-legend-row">
        <span className="spekui-legend-swatch spekui-legend-swatch--spec" />
        <span>Spec</span>
      </div>
      <div className="spekui-legend-row">
        <span className="spekui-legend-swatch spekui-legend-swatch--active" />
        <span>Active Change</span>
      </div>
      <div className="spekui-legend-row">
        <span className="spekui-legend-swatch spekui-legend-swatch--archived" />
        <span>Archived Change</span>
      </div>
    </div>
  );
}
