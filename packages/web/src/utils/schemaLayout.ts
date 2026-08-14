import { drawableEdges, type OrderingSource } from "@spekjs/core/schema-flow";
import type { FlowLevel, FlowStep } from "./schemaView";

/**
 * Geometry for the schema workflow diagram.
 *
 * Deliberately a **deterministic layered layout**, not a force simulation like `SpecGraph`. A
 * workflow has a fixed shape the reader is trying to learn; it must land in the same place every
 * time it renders, and levels already give us the layering for free. Force layouts are right for
 * the spec/change graph, where there is no inherent order to preserve.
 *
 * Pure geometry so it can be tested without a DOM, like the rest of this package's view logic.
 */

// Sized to the longest realistic label (`retrospective` / `retrospective.md`) plus padding, and no
// wider. Every extra pixel is doubled on a two-node row, which is what pushed the diagram past a
// phone's panel width.
export const NODE_W = 156;
export const NODE_H = 52;
// Internal spacing: the caller positions nothing itself, it renders what layoutGraph returns.
const X_GAP = 20;
const Y_GAP = 40;
const PAD = 8;
/**
 * Length of the arrowhead, in user units.
 *
 * Edges stop this far short of the node they point at, and the marker is anchored at its base, so
 * the arrow occupies the gap instead of the stroke running through it. Ending the stroke *at* the
 * node and centring a marker there draws the line straight through the triangle.
 */
export const ARROW_LEN = 9;

/** Dash of a derived connection, shared with the legend swatch that has to match it. */
export const DERIVED_DASH = "5 4";

/** Smallest clearance between a bypassing curve and the nodes it passes. */
const LANE_MIN = 20;
/** Largest bow we will attempt before accepting the widest one we tried. */
const LANE_MAX = 88;
/** Step between attempts while searching for a bow that clears. */
const LANE_STEP = 6;
/** Clearance kept between the widest bow on a flank and the diagram's edge. */
const LANE_MARGIN = 8;
/** How far a curve's control points sit along its own descent — the "fluidity" of the S. */
const TANGENT = 0.3;

interface LayoutNode {
  step: FlowStep;
  x: number;
  y: number;
}

interface LayoutEdge {
  /** Step key the edge comes from (a prerequisite). */
  from: string;
  /** Step key the edge goes to (the dependent step). */
  to: string;
  /** Cubic bezier from the bottom of `from` to the top of `to`. */
  path: string;
  /**
   * Whose authority this connection rests on. `derived` is an ordering spek worked out because the
   * schema had no way to state it, and the view must draw it so a reader can tell it apart from a
   * dependency the CLI blocks on.
   */
  origin: OrderingSource;
}

// Not exported: callers destructure what layoutGraph returns rather than naming its type, so
// exporting these would advertise an extension point the module does not actually have.
interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

interface Box {
  x: number;
  y: number;
}

function levelWidth(count: number): number {
  return count * NODE_W + (count - 1) * X_GAP;
}

type Point = [number, number];

function cubicAt(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/**
 * Does this curve stay out of every box it passes?
 *
 * Sampled rather than reasoned about. A cubic only *touches* its control points, so putting them
 * outside a node proves nothing about the curve between them — the first attempt at this cleared
 * `specs` at mid-span and still clipped its lower corner. Sampling asks the question that matters.
 */
function curveClears(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  boxes: Box[],
  margin = 4,
): boolean {
  const SAMPLES = 48;
  for (let i = 0; i <= SAMPLES; i++) {
    const [x, y] = cubicAt(i / SAMPLES, p0, p1, p2, p3);
    for (const box of boxes) {
      if (
        x > box.x - margin &&
        x < box.x + NODE_W + margin &&
        y > box.y - margin &&
        y < box.y + NODE_H + margin
      ) {
        return false;
      }
    }
  }
  return true;
}

/** Which flank a bypassing edge should bow around, given what it has to pass. */
function bypassSide(x1: number, between: Box[]): "left" | "right" {
  const leftMost = Math.min(...between.map((n) => n.x));
  const rightMost = Math.max(...between.map((n) => n.x + NODE_W));
  return x1 >= (leftMost + rightMost) / 2 ? "right" : "left";
}

/**
 * How far out this edge has to bow to clear what it passes, widening until sampling says the whole
 * curve is outside every passed node.
 *
 * Returned as a distance from the passed nodes' edge rather than an absolute x, which makes it
 * translation-invariant — so the provisional pass can measure it and the real pass will find the
 * same answer after everything shifts right.
 */
function findBow(p0: Point, p3: Point, passed: Box[], side: "left" | "right"): number {
  const dy = p3[1] - p0[1];
  const leftMost = Math.min(...passed.map((n) => n.x));
  const rightMost = Math.max(...passed.map((n) => n.x + NODE_W));

  for (let bow = LANE_MIN; bow <= LANE_MAX; bow += LANE_STEP) {
    const lane = side === "right" ? rightMost + bow : leftMost - bow;
    const p1: Point = [lane, p0[1] + dy * TANGENT];
    const p2: Point = [lane, p3[1] - dy * TANGENT];
    if (curveClears(p0, p1, p2, p3, passed)) return bow;
  }
  return LANE_MAX;
}

/** Passes of barycentre refinement. Alternates downward and upward; converges well before this. */
const REFINE_PASSES = 6;

/**
 * Lay levels out top to bottom, positioning each node near the nodes it connects to.
 *
 * Top-down rather than left-to-right: schemas get tall, not wide — `superpowers-bridge` is seven
 * levels deep and never more than two wide — and a vertical flow keeps a narrow panel usable
 * without shrinking the labels to nothing.
 *
 * Horizontal placement is a **barycentre pass**, not row-centring. Centring every row is the naive
 * choice and it manufactures crossings: in `superpowers-bridge`, `specs` has one parent (`proposal`,
 * in the left column) yet centring dragged it into the middle, directly under the path from
 * `design` to `tasks` — so that edge had to detour around a node it has no relationship with. Put
 * `specs` under its own parent and the detour disappears, because nothing is in the way any more.
 * Each node is pulled toward the average of its neighbours; rows keep their declared order and a
 * minimum gap.
 */
export function layoutGraph(levels: FlowLevel[]): GraphLayout {
  if (levels.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const levelOf = new Map<string, number>();
  levels.forEach((level, i) => level.steps.forEach((step) => levelOf.set(step.key, i)));

  const present = new Set(levels.flatMap((l) => l.steps.map((s) => s.key)));
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const level of levels) {
    for (const step of level.steps) {
      const parents = step.incoming.map((edge) => edge.from).filter((key) => present.has(key));
      parentsOf.set(step.key, parents);
      for (const parent of parents) {
        childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), step.key]);
      }
    }
  }

  const height = levels.length * NODE_H + (levels.length - 1) * Y_GAP + PAD * 2;

  // Left edges, keyed by step id. Seeded with centred rows, then refined.
  const widest = Math.max(...levels.map((l) => levelWidth(l.steps.length)));
  const xOf = new Map<string, number>();
  for (const level of levels) {
    const startX = (widest - levelWidth(level.steps.length)) / 2;
    level.steps.forEach((step, i) => xOf.set(step.key, startX + i * (NODE_W + X_GAP)));
  }
  const centreOf = (id: string) => (xOf.get(id) ?? 0) + NODE_W / 2;

  for (let pass = 0; pass < REFINE_PASSES; pass++) {
    // Odd parity, so the LAST pass is downward. Upward passes place roots above their children;
    // a downward pass then settles each node under its own parents, which is the alignment that
    // keeps edges short. Ending upward instead re-centred `specs` under `tasks` and put it straight
    // back in the path of `design → tasks`.
    const downward = pass % 2 === 1;
    const order = downward ? levels : [...levels].reverse();

    for (const level of order) {
      const desired = level.steps.map((step) => {
        const neighbours = downward
          ? (parentsOf.get(step.key) ?? [])
          : (childrenOf.get(step.key) ?? []);
        if (neighbours.length === 0) return centreOf(step.key);
        return neighbours.reduce((sum, id) => sum + centreOf(id), 0) / neighbours.length;
      });

      // Pack left to right, honouring the declared order and a minimum gap, then slide the whole
      // row so it sits as close to the desired positions as the packing allows.
      const packed: number[] = [];
      desired.forEach((centre, i) => {
        const left = centre - NODE_W / 2;
        packed.push(i === 0 ? left : Math.max(left, packed[i - 1] + NODE_W + X_GAP));
      });
      const drift =
        desired.reduce((sum, centre, i) => sum + (centre - NODE_W / 2 - packed[i]), 0) /
        desired.length;
      level.steps.forEach((step, i) => xOf.set(step.key, packed[i] + drift));
    }
  }

  const place = (padLeft: number): LayoutNode[] => {
    const minX = Math.min(...[...xOf.values()]);
    const out: LayoutNode[] = [];
    levels.forEach((level, row) => {
      for (const step of level.steps) {
        out.push({
          step,
          x: (xOf.get(step.key) ?? 0) - minX + padLeft,
          y: PAD + row * (NODE_H + Y_GAP),
        });
      }
    });
    return out;
  };

  // Which edges to draw is a graph fact, so it is settled once here rather than inside `buildEdges`,
  // which runs twice (once to measure the bows, once to draw). Core owns the rule — including why a
  // derived edge may not imply a declared one away.
  const drawable = drawableEdges(
    levels.flatMap((l) => l.steps).map((step) => ({ id: step.key, incoming: step.incoming })),
  );

  const passedBy = (nodes: LayoutNode[], fromLevel: number, toLevel: number): LayoutNode[] =>
    nodes.filter((n) => {
      const l = levelOf.get(n.step.key) ?? 0;
      return l > fromLevel && l < toLevel;
    });

  /**
   * Build every edge for a given placement, and report how far the widest bypass had to bow.
   *
   * Run twice: once on a provisional placement to measure, once on the real one to draw. It has to
   * be the *same* routine both times — measuring with node centres while drawing with spread
   * anchors over-measured the bow and reserved a fifth of the diagram's width for nothing.
   * Everything here is translation-invariant, so the second run finds the same bows as the first.
   */
  const buildEdges = (nodes: LayoutNode[]) => {
    const byKey = new Map(nodes.map((n) => [n.step.key, n]));

    const pairs: Array<{ parent: LayoutNode; child: LayoutNode; origin: OrderingSource }> = [];
    for (const node of nodes) {
      for (const edge of drawable.get(node.step.key) ?? []) {
        const parent = byKey.get(edge.from);
        if (parent) pairs.push({ parent, child: node, origin: edge.origin });
      }
    }

    /**
     * Where each edge meets a node, spread across its edge rather than all meeting at the centre.
     *
     * Two edges converging on one point stack their arrowheads at different angles on top of each
     * other — `specs` and `design` both arriving at `tasks` looked like a single smudged arrow.
     * Slots are ordered by the other end's position so the fan does not cross itself.
     *
     * Ties are broken by **how far away the other end is, nearest first**. Two ends in the same
     * column say nothing about left and right, so the order was whatever the edge list happened to
     * hold — which put the long way round on the inside slot and crossed it over the short one. A
     * distant end is the one that has to travel around whatever sits between, so it takes the outer
     * slot and its detour stays outside the direct edge instead of cutting through it. (The
     * derived-edge case that first exposed this — a step drawn after apply beside its declared
     * parent in the same column — no longer arises now that the redundant declared edge is reduced
     * away; the tiebreak stays for any same-column convergence that survives reduction.)
     */
    const anchor = (
      key: (p: { parent: LayoutNode; child: LayoutNode }) => LayoutNode,
      other: (p: { parent: LayoutNode; child: LayoutNode }) => LayoutNode,
    ) => {
      const groups = new Map<string, Array<{ parent: LayoutNode; child: LayoutNode }>>();
      for (const pair of pairs) {
        const id = key(pair).step.key;
        groups.set(id, [...(groups.get(id) ?? []), pair]);
      }
      const at = new Map<string, number>();
      for (const [, group] of groups) {
        const base = levelOf.get(key(group[0]).step.key) ?? 0;
        const span = (p: { parent: LayoutNode; child: LayoutNode }) =>
          Math.abs((levelOf.get(other(p).step.key) ?? 0) - base);
        const sorted = [...group].sort((a, b) => other(a).x - other(b).x || span(a) - span(b));
        sorted.forEach((pair, i) => {
          at.set(
            `${pair.parent.step.key}->${pair.child.step.key}`,
            key(pair).x + (NODE_W * (i + 1)) / (sorted.length + 1),
          );
        });
      }
      return at;
    };

    const exitX = anchor((p) => p.parent, (p) => p.child);
    const entryX = anchor((p) => p.child, (p) => p.parent);

    const edges: LayoutEdge[] = [];
    // How far the drawn curves actually stray outside the node column, either side. Measured from
    // the sampled curve, not from the bow: a bow is a *control point* offset and a cubic only
    // reaches about 60% of it, so reserving the bow padded ~25px a side for air nothing occupies.
    let leftOverflow = 0;
    let rightOverflow = 0;
    const columnLeft = Math.min(...nodes.map((n) => n.x));
    const columnRight = Math.max(...nodes.map((n) => n.x + NODE_W));

    for (const { parent, child, origin } of pairs) {
      const edgeKey = `${parent.step.key}->${child.step.key}`;
      const p0: Point = [exitX.get(edgeKey) ?? parent.x + NODE_W / 2, parent.y + NODE_H];
      // Stops short so the arrowhead fills the remaining gap rather than sitting on top of the
      // stroke. The arrow's tip lands on the node's edge.
      const p3: Point = [entryX.get(edgeKey) ?? child.x + NODE_W / 2, child.y - ARROW_LEN];
      const dy = p3[1] - p0[1];
      const passed = passedBy(
        nodes,
        levelOf.get(parent.step.key) ?? 0,
        levelOf.get(child.step.key) ?? 0,
      );

      let p1: Point = [p0[0], p0[1] + dy * TANGENT];
      let p2: Point = [p3[0], p3[1] - dy * TANGENT];

      // Only detour if the natural curve would actually hit something. Spanning a level is not the
      // same as being obstructed by it: once barycentre placement puts `specs` under its own
      // parent, `design → tasks` passes level 3 without going anywhere near it, and bowing anyway
      // would drag the line sideways to avoid a node that was never in the way.
      if (passed.length > 0 && !curveClears(p0, p1, p2, p3, passed)) {
        // One smooth curve, bowed just far enough to clear what it passes. An elbow with a straight
        // lane also clears them, but reads as a different kind of line from every other edge.
        const side = bypassSide(p0[0], passed);
        const bow = findBow(p0, p3, passed, side);

        const leftMost = Math.min(...passed.map((n) => n.x));
        const rightMost = Math.max(...passed.map((n) => n.x + NODE_W));
        const lane = side === "right" ? rightMost + bow : leftMost - bow;
        p1 = [lane, p0[1] + dy * TANGENT];
        p2 = [lane, p3[1] - dy * TANGENT];

        for (let i = 0; i <= 48; i++) {
          const [x] = cubicAt(i / 48, p0, p1, p2, p3);
          leftOverflow = Math.max(leftOverflow, columnLeft - x);
          rightOverflow = Math.max(rightOverflow, x - columnRight);
        }
      }

      edges.push({
        from: parent.step.key,
        to: child.step.key,
        path: `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`,
        origin,
      });
    }

    return { edges, overflow: Math.max(0, leftOverflow, rightOverflow) };
  };

  // Measure on a provisional placement, then lay out for real with exactly the room the bows need.
  const measured = buildEdges(place(PAD));

  // Symmetric, deliberately. Reserving only the flank that overflows is tighter, but it leaves the
  // node column off-centre inside the diagram — `superpowers-bridge` bows right only, so the whole
  // flow drifted left. Padding both sides by the widest overflow keeps the flow centred.
  const pad = PAD + (measured.overflow > 0 ? Math.ceil(measured.overflow) + LANE_MARGIN : 0);
  // From the refined column's real span, not the widest row: barycentre placement can leave a row
  // offset from the others, so a row's width no longer bounds the diagram.
  const xs = [...xOf.values()];
  const spanned = Math.max(...xs) + NODE_W - Math.min(...xs);
  const width = spanned + pad * 2;
  const nodes = place(pad);
  const { edges } = buildEdges(nodes);

  return { nodes, edges, width, height };
}

/**
 * SVG has no text-overflow, so labels are cut to fit by hand. Approximated from the average glyph
 * width at the label's font size rather than measured — a schema artifact id is short, and a
 * measurement pass would cost a layout round-trip for nothing.
 */
export function fitLabel(text: string, maxWidth: number, fontSize: number): string {
  const perChar = fontSize * 0.6;
  const max = Math.floor(maxWidth / perChar);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * Sample the points a path actually passes through. Exposed so tests can assert what a curve
 * touches rather than where its control points sit — the distinction that let the first bypass
 * ship looking correct while clipping a node.
 */
export function sampleCubicPath(path: string, samples = 48): Point[] {
  const nums = path.match(/-?[\d.]+/g)?.map(Number) ?? [];
  if (nums.length < 8) return [];
  const [x0, y0, x1, y1, x2, y2, x3, y3] = nums;
  const pts: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    pts.push(cubicAt(i / samples, [x0, y0], [x1, y1], [x2, y2], [x3, y3]));
  }
  return pts;
}
