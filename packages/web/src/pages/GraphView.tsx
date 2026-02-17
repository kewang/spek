import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useGraphData } from "../hooks/useOpenSpec";
import type { GraphData, GraphNode } from "@spek/core";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity } from "d3-zoom";
import { drag } from "d3-drag";

interface SimNode extends SimulationNodeDatum, GraphNode {
  x: number;
  y: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode;
  target: SimNode;
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

function ForceGraph({ data, onNavigate, theme }: { data: GraphData; onNavigate: (path: string) => void; theme: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const container = svg.parentElement!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 取得主題相關顏色
    const styles = getComputedStyle(document.documentElement);
    const edgeColor = styles.getPropertyValue("--color-border").trim() || "#374151";
    const edgeHighlight = styles.getPropertyValue("--color-text-primary").trim() || "#e2e8f0";
    const labelColor = styles.getPropertyValue("--color-text-secondary").trim() || "#94a3b8";

    // 清除舊內容
    const sel = select(svg);
    sel.selectAll("*").remove();
    sel.attr("width", width).attr("height", height);

    // 準備資料（deep copy 避免 D3 mutation 衝突）
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n, x: 0, y: 0 } as SimNode));
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
      .attr("stroke-opacity", 0.6);

    // Node groups
    const nodeSel = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer");

    // Spec 節點：圓形
    nodeSel
      .filter((d) => d.type === "spec")
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", "#f59e0b")
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#fbbf24")
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
      .attr("fill", (d) => (d.status === "active" ? "#22c55e" : "#64748b"))
      .attr("fill-opacity", 0.85)
      .attr("stroke", (d) => (d.status === "active" ? "#4ade80" : "#94a3b8"))
      .attr("stroke-width", 2);

    // 標籤
    nodeSel
      .append("text")
      .text((d) => truncateLabel(d.label))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadius(d) + 16)
      .attr("fill", labelColor)
      .attr("font-size", 12)
      .attr("pointer-events", "none");

    // Hover 互動
    nodeSel
      .on("mouseenter", (_event, d) => {
        const connected = neighbors.get(d.id) || new Set<string>();
        nodeSel.attr("opacity", (n) =>
          n.id === d.id || connected.has(n.id) ? 1 : 0.1,
        );
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
        linkSel.attr("stroke-opacity", 0.6).attr("stroke", edgeColor);
      });

    // Click 導航（區分 drag vs click）
    let dragged = false;
    nodeSel.on("click", (_event, d) => {
      if (dragged) return;
      if (d.type === "spec") {
        onNavigateRef.current(`/specs/${d.label}`);
      } else {
        // 從 id 取得 slug（去掉 "change:" 前綴）
        const slug = d.id.replace(/^change:/, "");
        onNavigateRef.current(`/changes/${slug}`);
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
      // 計算節點邊界
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
      const scale = Math.min(
        (width - padding * 2) / bw,
        (height - padding * 2) / bh,
        1.5,
      );
      const tx = width / 2 - (minX + bw / 2) * scale;
      const ty = height / 2 - (minY + bh / 2) * scale;

      sel
        .transition()
        .duration(500)
        .call(
          zoomBehavior.transform,
          zoomIdentity.translate(tx, ty).scale(scale),
        );
    });

    return () => {
      simulation.stop();
    };
  }, [data, theme]);

  return <svg ref={svgRef} className="w-full h-full" />;
}

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 bg-bg-secondary/90 border border-border rounded-lg px-4 py-3 text-xs text-text-secondary space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
        <span>Spec</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-2.5 rounded-sm bg-green-500" />
        <span>Active Change</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-2.5 rounded-sm bg-slate-500" />
        <span>Archived Change</span>
      </div>
    </div>
  );
}

export function GraphView() {
  const { data, loading, error } = useGraphData();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (path: string) => navigate(path),
    [navigate],
  );

  if (loading) {
    return <p className="text-text-muted">Loading graph...</p>;
  }
  if (error) {
    return <p className="text-red-400">Error: {error}</p>;
  }
  if (!data || data.edges.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Graph</h1>
        <p className="text-text-muted">No spec-change relationships to visualize.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Graph</h1>
      <div className="relative h-[calc(100vh-10rem)] bg-bg-primary border border-border rounded-lg overflow-hidden">
        <ForceGraph data={data} onNavigate={handleNavigate} theme={theme} />
        <Legend />
      </div>
    </div>
  );
}
