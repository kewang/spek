import type { SchemaApplyDef, SchemaArtifactDef } from "./types.js";

/**
 * The shape of a schema's workflow: which steps can be reached only after which others.
 *
 * Its own module, exported at the `@spekjs/core/schema-flow` subpath, for the same reason `headings`
 * is: the frontend needs this and must not pull in `child_process` to get it. In core rather than in
 * the web package because the schemas list and the detail diagram both need the same answer.
 */

/** A levelling, and whether it is a reading of the graph or the fallback for a cycle. */
export interface ArtifactLevelling {
  levels: Map<string, number>;
  /** True when `levels` is declaration order, because the `requires` graph has a cycle. */
  cyclic: boolean;
}

/**
 * `computeArtifactLevels`, plus whether the result is the positional fallback.
 *
 * The levels map alone cannot answer that — a chain and a cycle can produce identical numbers — and
 * anything deriving an ordering from the graph has to know which it was handed. A derived ordering
 * layered over declaration order would be reasoning about the fallback rather than about the
 * schema, so callers that derive decline the fallback instead of using it.
 *
 * Reported rather than left to a second traversal in the caller: two implementations of "is this
 * cyclic" would be free to disagree with the one that decided the levels, and the disagreement
 * would surface as an ordering that contradicts the layout it is drawn on.
 */
export function levelArtifacts(artifacts: readonly RequiresNode[]): ArtifactLevelling {
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const levels = new Map<string, number>();
  const visiting = new Set<string>();
  let cyclic = false;

  const levelOf = (id: string): number => {
    const cached = levels.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) {
      cyclic = true;
      return 1;
    }
    visiting.add(id);

    let level = 1;
    for (const dep of byId.get(id)?.requires ?? []) {
      if (!byId.has(dep)) continue;
      level = Math.max(level, levelOf(dep) + 1);
    }

    visiting.delete(id);
    levels.set(id, level);
    return level;
  };

  for (const artifact of artifacts) levelOf(artifact.id);
  if (cyclic) return { levels: new Map(artifacts.map((a, i) => [a.id, i + 1])), cyclic };
  return { levels, cyclic };
}

/**
 * Dependency level per artifact id: 1 + the deepest level among the artifacts it requires.
 *
 * A `requires` entry naming something the schema does not declare cannot be ranked, so it is
 * ignored. A cycle has no valid levelling, so the whole schema falls back to positional levels
 * rather than looping or inventing a rank.
 *
 * Kept returning the map alone, rather than widened to carry the cycle flag: this is a published
 * export of `@spekjs/core`, so changing its return type would break registry consumers for the
 * benefit of one in-repo caller. `levelArtifacts` carries the extra fact, and this delegates to it
 * so there is one traversal and one answer.
 */
export function computeArtifactLevels(artifacts: readonly RequiresNode[]): Map<string, number> {
  return levelArtifacts(artifacts).levels;
}

/**
 * The level the apply step sits at, or null when the schema declares no apply.
 *
 * Levelled from its own `requires` like anything else — apply is **not** forced to the end.
 * Implementation is a step in the workflow, not necessarily its last: a schema can declare verify
 * or retrospective steps that follow it. Only when apply requires nothing the schema declares is
 * there no dependency to anchor it to, and it goes last for want of anywhere better.
 */
export function applyStepLevel(
  levels: Map<string, number>,
  apply: SchemaApplyDef | null,
): number | null {
  if (!apply) return null;
  const deepest = Math.max(0, ...levels.values());
  const resolvable = apply.requires.filter((id) => levels.has(id));
  return resolvable.length
    ? Math.max(...resolvable.map((id) => levels.get(id) ?? 0)) + 1
    : deepest + 1;
}

/** Every id reachable from `seeds` by following `requires`, including the seeds themselves. */
function closureOf(seeds: readonly string[], requiresOf: Map<string, readonly string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...seeds];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (seen.has(current) || !requiresOf.has(current)) continue;
    seen.add(current);
    stack.push(...(requiresOf.get(current) ?? []));
  }
  return seen;
}

/** Apply's own prerequisites, resolved and closed over. Shared so the two rules cannot disagree. */
function applyContext(artifacts: SchemaArtifactDef[], applyRequires: readonly string[]) {
  const requiresOf = new Map<string, readonly string[]>(artifacts.map((a) => [a.id, a.requires]));
  const resolved = applyRequires.filter((id) => requiresOf.has(id));
  return { requiresOf, resolved, beforeApply: closureOf(resolved, requiresOf) };
}

/**
 * The artifacts a schema produces only after implementation, in declared order.
 *
 * OpenSpec cannot express this: an artifact's `requires` may name only other artifacts, so authors
 * point such an artifact at the last planning artifact and state the ordering in prose instead.
 *
 * An artifact qualifies when it is **outside** the closure of `apply.requires` and its own closure
 * **covers** all of it — it cannot become available before apply, and apply does not need it. That
 * is a bound on when it can happen, not a reading of intent, so the caller must present the edge as
 * derived; see `design.md` for the survey behind that (~82% precise, two classes it misreads).
 *
 * Two guards, each for an input a real schema produced:
 * - **A resolvable requirement**, or the superset test is vacuously true and flags everything.
 * - **An acyclic graph**, or levels are declaration order and there is no ordering to derive from.
 *
 * Undetectable by construction: a post-implementation artifact declaring `requires: []`. Nothing
 * links it to the flow — and it levels first, so it never reads as apply's peer anyway.
 */
export function postApplyArtifacts(
  artifacts: SchemaArtifactDef[],
  apply: { requires: readonly string[] } | null,
): string[] {
  if (!apply) return [];
  const { requiresOf, resolved, beforeApply } = applyContext(artifacts, apply.requires);
  if (resolved.length === 0 || levelArtifacts(artifacts).cyclic) return [];

  return artifacts
    .filter((a) => {
      if (beforeApply.has(a.id)) return false;
      const needs = closureOf([a.id], requiresOf);
      return resolved.every((id) => needs.has(id));
    })
    .map((a) => a.id);
}

/** Where a step's ordering relative to implementation came from. */
export type OrderingSource = "declared" | "derived";

/**
 * Which steps follow implementation, and on whose authority.
 *
 * The single seam between "what is this schema's shape" and "how did we work that out". Callers
 * branch on the source, never on which step an edge connects, so an ordering that arrives declared
 * renders as an ordinary edge with no further change. **Precedence is per step**, so a schema that
 * states the ordering for one artifact and leaves another implicit needs no mode switch — which is
 * what makes adopting a declared source (OpenSpec #1456) a branch here rather than a rework.
 *
 * Today the only thing a schema can state is a `requires` entry naming the apply step. The CLI
 * rejects that, so nothing in the wild uses it, but it is the shape a legalised declaration takes.
 *
 * The apply step is a **parameter**, not the literal id `"apply"`: a schema may declare an artifact
 * of that name (`superspec` does), and matching on the string would confuse the two.
 */
export function resolveImplementationOrdering(
  artifacts: SchemaArtifactDef[],
  applyStep: RequiresNode | null,
): Map<string, OrderingSource> {
  const ordering = new Map<string, OrderingSource>();
  if (!applyStep) return ordering;

  // Skipped when an artifact claims that id: there the declared-artifact reading is the one
  // OpenSpec itself takes, so reading it as the phase would invent an edge the author never wrote.
  if (!artifacts.some((a) => a.id === applyStep.id)) {
    // And never for a step apply already waits on. The CLI rejects such a schema but spek parses
    // `schema.yaml` directly, so it arrives here, and at face value it is a cycle through apply —
    // which drops the *whole* schema to positional levels and draws one edge running backwards.
    const { beforeApply } = applyContext(artifacts, applyStep.requires);
    for (const a of artifacts) {
      if (a.requires.includes(applyStep.id) && !beforeApply.has(a.id)) {
        ordering.set(a.id, "declared");
      }
    }
  }

  for (const id of postApplyArtifacts(artifacts, applyStep)) {
    if (!ordering.has(id)) ordering.set(id, "derived");
  }

  return ordering;
}

/**
 * How many artifacts a schema declares.
 *
 * **`artifact` is OpenSpec's own word** — the `artifacts:` key in `schema.yaml`, the field in
 * `openspec schemas --json`, `planningArtifacts` in `status`. Naming it anything else would make a
 * reader who opens the schema translate our noun back into theirs to check the number.
 *
 * Two artifacts that share a dependency level are two artifacts: both are work, and neither stops
 * being work because the other could be produced alongside it. The count says how much a schema
 * asks for; the diagram says the shape, by drawing a shared level side by side. It follows that the
 * count needs no `requires` — which is what lets it come from the CLI's enumeration, so a list of
 * schemas costs one CLI call rather than one per row.
 *
 * Excludes `apply` and archiving, by one rule: both belong to every schema alike, so counting them
 * would add the same constant everywhere and distinguish nothing. `apply` is also the only work a
 * schema declares outside `artifacts:` — surveying every available schema, the sole top-level keys
 * are `name`, `version`, `description`, `artifacts`, `apply` and `format` (parsing config, not a
 * step) — so nothing else goes uncounted.
 */
export function schemaArtifactCount(artifacts: SchemaArtifactDef[]): number {
  return artifacts.length;
}

/** The shape this module needs of a workflow step: an id and what it declares it requires. */
export interface RequiresNode {
  id: string;
  requires: readonly string[];
}

/** One connection into a step, and whose authority it rests on. */
export interface OriginEdge {
  from: string;
  origin: OrderingSource;
}

/** The shape this module needs of a step whose edges carry provenance. */
export interface OriginNode {
  id: string;
  incoming: readonly OriginEdge[];
}

/**
 * `drawableRequires` for a graph whose edges carry provenance: the edges worth drawing, per step,
 * each survivor keeping the origin it will be drawn with.
 *
 * A plain transitive reduction: an edge is dropped when some other path already implies it,
 * **declared and derived hops counted alike**. A derived edge is subject to the same reduction as a
 * declared one, so a post-implementation step whose declared dependency the apply step already
 * covers draws a single incoming connection rather than two: in `anvil`, `verify` declares
 * `requires: [tasks]` and is derived to follow apply, which already requires `tasks`, so
 * `tasks → apply ⇢ verify` carries the dependency and the direct `tasks → verify` edge is not drawn.
 * `verify` keeps one edge, from apply.
 *
 * This is a **bound the derivation accepts, not a fact it hides**: on the ~18% of steps the
 * post-implementation rule misreads, the surviving edge is the derived one — dashed and captioned as
 * derived, never asserted — so the reader is told it is an inference. The alternative, keeping the
 * declared edge alongside, drew every such node with two lines saying the same ordering; the diagram
 * is a reduction, and the panel is where the exact `requires` still lives.
 */
export function drawableEdges(steps: readonly OriginNode[]): Map<string, OriginEdge[]> {
  const declared = new Set(steps.map((s) => s.id));
  const childrenOf = new Map<string, OriginEdge[]>();
  for (const step of steps) {
    for (const edge of step.incoming) {
      if (!declared.has(edge.from)) continue;
      childrenOf.set(edge.from, [
        ...(childrenOf.get(edge.from) ?? []),
        { from: step.id, origin: edge.origin },
      ]);
    }
  }

  // Reachable from `from` without the direct hop?
  const impliedBy = (from: string, to: string): boolean => {
    const seen = new Set<string>();
    const stack = (childrenOf.get(from) ?? []).filter((e) => e.from !== to);
    while (stack.length > 0) {
      const current = stack.pop() as OriginEdge;
      if (current.from === to) return true;
      if (seen.has(current.from)) continue;
      seen.add(current.from);
      stack.push(...(childrenOf.get(current.from) ?? []));
    }
    return false;
  };

  return new Map(
    steps.map((step) => [
      step.id,
      step.incoming.filter((edge) => declared.has(edge.from) && !impliedBy(edge.from, step.id)),
    ]),
  );
}

/**
 * Each step's `requires` with the entries a longer path already implies removed — the graph's
 * **transitive reduction**.
 *
 * `super-spec-driven` declares that `design` requires `proposal` *and* `specs`, but `specs` already
 * requires `proposal`, so the direct entry states only what the chain states. Surveying eleven
 * community schemas, every such entry was of this kind, and drawing them was worse than redundant:
 * each had to detour around the very step that implied it, producing curves that crossed the column
 * they belonged to.
 *
 * A **graph fact, not a drawing one**, which is why it sits beside `computeArtifactLevels` rather
 * than in the view's geometry: it reads ids and `requires`, never coordinates. Anything wanting to
 * know what a step *really* adds — a diagram, or an annotation saying a requirement is already
 * implied — asks here.
 *
 * **Levelling must keep using the full `requires`.** Removing an implied edge never shortens the
 * longest path, so levels are unchanged either way, but computing them from the reduction would make
 * that a coincidence rather than a guarantee.
 *
 * Not mirrored in Kotlin, deliberately: no Kotlin host draws the diagram — the IntelliJ tool window
 * loads the same React SPA — so nothing on that side has a use for it.
 */
export function drawableRequires(steps: readonly RequiresNode[]): Map<string, string[]> {
  const declared = new Set(steps.map((s) => s.id));
  const childrenOf = new Map<string, string[]>();
  for (const step of steps) {
    for (const parent of step.requires) {
      if (declared.has(parent)) childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), step.id]);
    }
  }

  // Reachable from `from` without taking the direct hop to `to`? Then the direct hop adds nothing.
  const impliedByALongerPath = (from: string, to: string): boolean => {
    const seen = new Set<string>();
    const stack = (childrenOf.get(from) ?? []).filter((id) => id !== to);
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (current === to) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...(childrenOf.get(current) ?? []));
    }
    return false;
  };

  const out = new Map<string, string[]>();
  for (const step of steps) {
    out.set(
      step.id,
      step.requires.filter((id) => declared.has(id) && !impliedByALongerPath(id, step.id)),
    );
  }
  return out;
}
