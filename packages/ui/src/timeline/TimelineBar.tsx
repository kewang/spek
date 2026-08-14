import type { ChangeInfo } from "@spekjs/core";
import { CSS_VARS } from "../theme.js";

interface TimelineBarProps {
  change: ChangeInfo;
  topics: string[];
  scale: (date: string) => number;
  today: string;
  y: number;
  barHeight: number;
  onHover: (payload: BarHoverPayload | null) => void;
  onClick: (change: ChangeInfo) => void;
}

export interface BarHoverPayload {
  change: ChangeInfo;
  topics: string[];
  // 視窗座標，給 tooltip 絕對定位用
  clientX: number;
  clientY: number;
}

const ARROW_WIDTH = 6;
const MIN_BAR_WIDTH = 4;

// 單條 bar：archived 為固定區段，active 延伸到 today 並右端帶箭頭三角形。
export function TimelineBar({
  change,
  topics,
  scale,
  today,
  y,
  barHeight,
  onHover,
  onClick,
}: TimelineBarProps) {
  if (!change.createdDate) return null;

  const isArchived = change.status === "archived" && change.archivedDate;
  const startX = scale(change.createdDate);
  const endX = isArchived ? scale(change.archivedDate as string) : scale(today);
  const rawWidth = Math.max(MIN_BAR_WIDTH, endX - startX);

  // Status is carried by the fill colour alone. The opacity that used to carry it multiplies after the
  // colour is chosen, so no contract value can reach the floor through it: the archived bar measured
  // 1.91:1 light and 2.17:1 dark even once the host's token was corrected.
  //
  // The cost, stated: the two colours are only 1.42:1 apart dark and 1.25:1 light, and the small lightness
  // difference between the states was exactly what the opacity provided. Hue now does most of that work,
  // with the open arrow on the active bar's right edge doing the rest — which is why that arrow is not
  // decoration and should not be removed.
  const fill = isArchived ? `var(${CSS_VARS.textMuted})` : `var(${CSS_VARS.accent})`;

  const handleMove = (e: React.MouseEvent<SVGGElement>) => {
    onHover({
      change,
      topics,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  return (
    <g
      onMouseEnter={handleMove}
      onMouseMove={handleMove}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(change)}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={startX}
        y={y}
        width={rawWidth}
        height={barHeight}
        rx={3}
        ry={3}
        fill={fill}
      >
        <title>{`${change.slug} (${change.status})${change.source && !change.source.isMain ? ` · ${change.source.branch ?? "detached"}` : ""}`}</title>
      </rect>
      {!isArchived && (
        <polygon
          points={`${startX + rawWidth},${y} ${startX + rawWidth + ARROW_WIDTH},${y + barHeight / 2} ${startX + rawWidth},${y + barHeight}`}
          fill={fill}
        />
      )}
      {/* 透明 hit area 讓 hover 容易觸發 */}
      <rect
        x={startX - 2}
        y={y - 4}
        width={rawWidth + ARROW_WIDTH + 4}
        height={barHeight + 8}
        fill="transparent"
      />
    </g>
  );
}
