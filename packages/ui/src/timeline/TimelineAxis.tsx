import { CSS_VARS } from "../theme.js";
import { formatTickLabel, type TickSet } from "./scale.js";

interface TimelineAxisProps {
  ticks: TickSet;
  scale: (date: string) => number;
  spanDays: number;
  axisHeight: number;
  chartHeight: number; // 給 minor grid line 從上畫到下
  today: string;
}

// React 渲染的 SVG 可以直接用 var() —— 只有 d3 那種命令式寫屬性的才需要先解出顏色。
const BORDER = `var(${CSS_VARS.border})`;
const MUTED = `var(${CSS_VARS.textMuted})`;
const ACCENT = `var(${CSS_VARS.accent})`;

// 上方時間軸：major tick (label + 全長 grid line)、minor tick (淡 grid line)、today 虛線
export function TimelineAxis({
  ticks,
  scale,
  spanDays,
  axisHeight,
  chartHeight,
  today,
}: TimelineAxisProps) {
  const todayX = scale(today);
  return (
    <g>
      {/* minor grid lines */}
      {ticks.minor.map((iso) => (
        <line
          key={`minor-${iso}`}
          x1={scale(iso)}
          x2={scale(iso)}
          y1={axisHeight}
          y2={chartHeight}
          stroke={BORDER}
          strokeOpacity={0.4}
          strokeWidth={1}
        />
      ))}
      {/* major grid lines */}
      {ticks.major.map((iso) => (
        <line
          key={`major-line-${iso}`}
          x1={scale(iso)}
          x2={scale(iso)}
          y1={axisHeight - 4}
          y2={chartHeight}
          stroke={BORDER}
          strokeWidth={1}
        />
      ))}
      {/* major tick labels */}
      {ticks.major.map((iso) => (
        <text
          key={`major-label-${iso}`}
          x={scale(iso) + 4}
          y={axisHeight - 8}
          fontSize={11}
          fill={MUTED}
        >
          {formatTickLabel(iso, spanDays)}
        </text>
      ))}
      {/* today line */}
      <line
        x1={todayX}
        x2={todayX}
        y1={axisHeight - 8}
        y2={chartHeight}
        stroke={ACCENT}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      {/* No opacity on either mark: the line states where now is and the label names it, and both were
          under their floors on that mechanism alone — 2.35:1 and 4.39:1 in the light theme. The accent
          clears both at full strength, and the dash pattern is what separates the line from a bar.
          The grid lines above are deliberately left alone: they are border-coloured decoration, and the
          dates they help read are stated by the axis labels. */}
      <text x={todayX + 4} y={axisHeight - 22} fontSize={10} fill={ACCENT}>
        today
      </text>
    </g>
  );
}
