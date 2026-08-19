import { useMemo, useState } from "react";
import { DERIVED_EDGE_MEANING, type FlowLevel } from "../utils/schemaView";
import {
  ARCHIVE_DASH,
  ARROW_LEN,
  DERIVED_DASH,
  fitLabel,
  layoutGraph,
  MARK_COLOR,
  MARK_OPACITY,
  NODE_H,
  NODE_W,
} from "../utils/schemaLayout";

/**
 * The schema workflow as a real diagram: nodes for steps, edges for `requires`.
 *
 * Declarative SVG with `var(--color-*)` fills, the same way `ChangeTimeline` draws — not d3. d3 is
 * right for `SpecGraph`, where a force simulation discovers a shape nobody declared; here the shape
 * *is* declared, and it must land identically on every render.
 *
 * The edges are what a card layout could never show. Level rows told you `specs` and `design` sat
 * at the same depth, but not that `tasks` reaches back to both, or that `design` skips a level to
 * get there. That is the schema's actual structure.
 *
 * **Colour is spent once, on the accent, and only where it means something**: the implementation
 * step, and the current selection. Everything else is surface and border. There is no second
 * semantic in this data worth a second hue — a palette here would be decoration wearing the
 * costume of information.
 */

const LABEL_SIZE = 13;
const SUB_SIZE = 10.5;
const TEXT_X = 14;

export function SchemaGraph({
  levels,
  selectedKey,
  onSelect,
}: {
  levels: FlowLevel[];
  /** Step *key*, never a declared id — two steps may share an id, and both must be selectable. */
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  // Hover now does one thing only: brighten the node's own outline, so a clickable thing looks
  // clickable. It no longer touches edges or other nodes.
  const [hovered, setHovered] = useState<string | null>(null);
  // Memoised against `hovered`, which changes on every pointer move across a node. The layout
  // depends only on `levels` — hovering changes which colours the JSX picks, nothing geometric —
  // and re-running it means 6 barycentre passes plus a bypass search that samples each candidate
  // curve at 48 points, all to arrive at the identical diagram.
  const { nodes, edges, width, height } = useMemo(() => layoutGraph(levels), [levels]);

  if (nodes.length === 0) return null;

  // Connections light up for the **selected** step, not the hovered one. Hover is a pointer
  // passing through; selection is a decision, and it is the decision the rest of the page is
  // already about. Driving it from hover meant the diagram lit up and went dark again as the
  // cursor crossed it, and the highlight was never there while you actually read the step.
  const isConnected = (edge: { from: string; to: string }) =>
    selectedKey !== null && (edge.from === selectedKey || edge.to === selectedKey);

  return (
    <div>
      {/*
        Natural size when there is room, scaled down proportionally when there is not
        (`max-w-full h-auto` against the viewBox). The earlier rule was the opposite — scroll,
        never scale, to protect label legibility — but on a phone that traded a slightly smaller
        label for a diagram you cannot see the shape of, which is the whole reason it exists. A
        seven-level flow clipped at the second column is worse than one at 85%.
      */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Schema workflow diagram"
        className="mx-auto block h-auto max-w-full"
      >
        <defs>
          {/*
            refX=0 anchors the marker at its BASE, so the triangle extends forward from where the
            stroke stops (ARROW_LEN short of the node) and its tip lands on the node's edge. With
            the marker centred on the path's end instead, the stroke runs straight through it.

            markerUnits="userSpaceOnUse" keeps the head a fixed size: the default scales markers by
            stroke width, so a highlighted edge's thicker stroke would inflate its arrowhead too.
          */}
          {[
            { id: "schema-arrow", color: MARK_COLOR, opacity: MARK_OPACITY },
            { id: "schema-arrow-active", color: "var(--color-accent)", opacity: 1 },
          ].map(({ id, color, opacity }) => (
            <marker
              key={id}
              id={id}
              markerUnits="userSpaceOnUse"
              markerWidth={ARROW_LEN}
              markerHeight={7}
              refX={0}
              refY={3.5}
              orient="auto"
            >
              <path
                d={`M 0 0 L ${ARROW_LEN} 3.5 L 0 7 z`}
                fill={color}
                fillOpacity={opacity}
              />
            </marker>
          ))}
        </defs>

        {/*
          No stage numbers. They were added to reconcile the page's "Stages" count with the
          diagram, but the rows already *are* the stages — a number beside each one restates what
          the layout shows, and nothing in the UI ever refers to "stage 3". The leader lines that
          followed were chrome invented to fix the detachment the numbers themselves created.
        */}

        <g>
          {edges.map((edge) => {
            const connected = isConnected(edge);
            // Dashed, not a second hue: colour here already means selection, and a dash survives
            // greyscale and colour-blindness. Its own pattern (DERIVED_DASH), distinct from the
            // archive node's (ARCHIVE_DASH) — the two are different meanings, not one shared mark.
            const derived = edge.origin === "derived";
            return (
              <g key={`${edge.from}->${edge.to}`}>
                <path
                  d={edge.path}
                  fill="none"
                  stroke={connected ? "var(--color-accent)" : MARK_COLOR}
                  strokeOpacity={connected ? 1 : MARK_OPACITY}
                  strokeWidth={connected ? 2 : 1.5}
                  strokeDasharray={derived ? DERIVED_DASH : undefined}
                  markerEnd={connected ? "url(#schema-arrow-active)" : "url(#schema-arrow)"}
                />
                {derived && (
                  // Wide transparent companion so the meaning is hoverable: the visible dashed 1.5px
                  // line is nearly untargetable, and ~half of it is gaps.
                  <path
                    d={edge.path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12}
                    pointerEvents="stroke"
                  >
                    <title>{DERIVED_EDGE_MEANING}</title>
                  </path>
                )}
              </g>
            );
          })}
        </g>

        {nodes.map(({ step, x, y }) => {
          const selected = step.key === selectedKey;
          const isHovered = step.key === hovered;
          // One place for what the outline is, because four of its five inputs disagree about why.
          // Archive rests on a legible colour: its dash is the only thing saying "not declared by
          // this schema", so it answers the 3:1 a sole carrier owes. Every other step's outline is
          // trim — the label carries the step, at better than 13:1, and the fill carries nothing
          // (bg-tertiary on the panel is 1.10:1 in both themes) — so it stays a hairline.
          // Hover is text-secondary rather than text-muted so that it is still a step *up* from
          // archive's resting colour; against text-muted the one node most likely to be hovered
          // for an explanation would be the one that stopped responding.
          const outline = selected
            ? { stroke: "var(--color-accent)", opacity: 1 }
            : isHovered
              ? { stroke: "var(--color-text-secondary)", opacity: 1 }
              : step.isArchive
                ? { stroke: MARK_COLOR, opacity: MARK_OPACITY }
                : { stroke: "var(--color-border)", opacity: 1 };
          const labelWidth = NODE_W - TEXT_X - 12 - (step.isApply ? 14 : 0);
          return (
            <g
              key={step.key}
              transform={`translate(${x},${y})`}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              className="cursor-pointer outline-none"
              onClick={() => onSelect(step.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(step.key);
                }
              }}
              onMouseEnter={() => setHovered(step.key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(step.key)}
              onBlur={() => setHovered(null)}
            >
              <title>
                {step.requires.length > 0
                  ? `${step.id} — requires ${step.requires.join(", ")}`
                  : step.id}
              </title>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill="var(--color-bg-tertiary)"
                // Dashed for archive: it really is the terminal stage of every workflow, but no
                // schema declares it, so it must not read as one of the steps this schema owns.
                strokeDasharray={step.isArchive ? ARCHIVE_DASH : undefined}
                // Hover brightens the node's own outline. Without it the only feedback was other
                // nodes fading, so the one under the pointer was the one that never reacted.
                stroke={outline.stroke}
                strokeOpacity={outline.opacity}
                strokeWidth={selected ? 2 : 1}
              />
              {/* Selection reads as a lit surface, not just a ring — a 1px border change is a weak
                  signal for the one thing the whole right-hand panel is about. */}
              {selected && (
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  fill="var(--color-accent)"
                  fillOpacity={0.1}
                />
              )}
              {step.isApply && (
                <circle cx={TEXT_X - 4} cy={NODE_H / 2} r={4} fill="var(--color-accent)" />
              )}
              <text
                x={step.isApply ? TEXT_X + 10 : TEXT_X}
                y={step.generates ? 22 : NODE_H / 2 + 4}
                fill={step.isArchive ? "var(--color-text-secondary)" : "var(--color-text-primary)"}
                fontSize={LABEL_SIZE}
                fontWeight={600}
              >
                {fitLabel(step.id, labelWidth, LABEL_SIZE)}
              </text>
              {step.generates && (
                <text
                  x={step.isApply ? TEXT_X + 10 : TEXT_X}
                  y={38}
                  // text-secondary, not text-muted: a selected step is washed in accent at 0.10,
                  // and text-muted over that wash is 4.45:1 in the light theme — under the text
                  // floor, for the ordinary case of selecting a step that declares an output.
                  // Lightening the wash instead buys ~0.2 of margin, because text-muted measures
                  // 5.17 against the bare fill and that is its ceiling; moving the text clears it
                  // at 5.96.
                  fill="var(--color-text-secondary)"
                  fontSize={SUB_SIZE}
                  // Monospace for a path, matching how <code> renders everywhere else in the app.
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {/* No separate "this is a pattern" mark. `specs/**\/*.md` already contains the
                      wildcards, so a glyph announcing them is decoration — and it was a second
                      marker system competing with the apply dot for no gain. The legend states the
                      rule, and the detail panel spells it out for the selected step. */}
                  {fitLabel(step.generates, labelWidth, SUB_SIZE)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
