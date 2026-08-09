// Regroup a flat hast tree into collapsible sections.
//
// `react-markdown` maps nodes one-for-one: the `h3` renderer receives an `h3` and knows nothing about
// what follows it. A section is therefore not expressible as a component — the sibling run has to be
// regrouped before React sees it, which is what this does. Keeping it a pure tree-in / tree-out
// function is deliberate: a mis-scoped boundary silently swallows a following requirement into the
// previous one, which reads as content loss rather than as a layout bug, so it is tested directly.

export type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

export interface FoldOptions {
  /** Heading levels that become folds. Everything else stays a plain sibling. */
  levels: number[];
  /** Of those, the levels rendered open. */
  openLevels: number[];
}

const HEADING = /^h([1-6])$/;

/** 1–6 for a heading element, null for anything else. */
export function headingLevel(node: HastNode): number | null {
  if (node.type !== "element" || !node.tagName) return null;
  const m = HEADING.exec(node.tagName);
  return m ? Number(m[1]) : null;
}

/**
 * A section owns every node from its heading up to — but excluding — the next heading of the same
 * level or shallower. Because the body can then only contain deeper headings, the recursion can pass
 * the same `levels` down and still terminate: an h4 inside an h3's body groups, an h3 never does.
 */
function group(nodes: HastNode[], options: FoldOptions): HastNode[] {
  const out: HastNode[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];
    const level = headingLevel(node);

    if (level === null || !options.levels.includes(level)) {
      out.push(node);
      i += 1;
      continue;
    }

    let end = i + 1;
    while (end < nodes.length) {
      const next = headingLevel(nodes[end]);
      if (next !== null && next <= level) break;
      end += 1;
    }

    const body = group(nodes.slice(i + 1, end), options);
    const properties: Record<string, unknown> = { "data-spek-fold": String(level) };
    // Omitted rather than set false: hast renders a present `open` as open regardless of value.
    if (options.openLevels.includes(level)) properties.open = true;

    out.push({
      type: "element",
      tagName: "details",
      properties,
      children: [
        // The heading keeps its own element and id, so `getElementById`, `scroll-mt-*` and the
        // scrollspy's measurements all go on working. `<summary>` permits one heading element as its
        // content, so this is spec-legal rather than a hack.
        { type: "element", tagName: "summary", properties: {}, children: [node] },
        ...body,
      ],
    });
    i = end;
  }

  return out;
}

/** Pure entry point: returns a new root with its children regrouped. */
export function foldSections(tree: HastNode, options: FoldOptions): HastNode {
  return { ...tree, children: group(tree.children ?? [], options) };
}

/**
 * rehype plugin form. Must run **after** the heading-id plugin: that one assigns ids while walking a
 * still-flat tree, and running it second would have it see a different traversal order.
 */
export function rehypeSpekFoldSections(options: FoldOptions) {
  return (tree: HastNode) => {
    tree.children = group(tree.children ?? [], options);
  };
}
