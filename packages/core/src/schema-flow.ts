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

/**
 * The artifacts a schema produces only after implementation, in declared order.
 *
 * OpenSpec cannot express this. An artifact's `requires` may name only other artifacts — the CLI's
 * build-order pass dereferences each entry as a declared artifact, so `requires: [apply]` throws
 * rather than parsing — and there is no post-apply concept anywhere in its model: `status` treats
 * every artifact as a planning artifact and tells you to run apply once *all* of them exist. So
 * authors point such an artifact at the last planning artifact and state the real ordering in
 * prose: `superpowers-bridge`'s `verify` declares `requires: [plan]` while its instruction says the
 * step must run on a completed implementation, and `anvil`'s opens "Produced AFTER apply completes."
 *
 * An artifact qualifies when it is **outside** the transitive closure of `apply.requires` and its
 * own closure **covers** everything apply requires. Together: it cannot become available before
 * apply does, and apply does not need it. That is a bound on when it can happen, not a reading of
 * the author's intent — which is why the caller must present the resulting edge as derived. Over
 * the 88 schemas discoverable on GitHub the rule is a no-op on every built-in, correct on all three
 * artifacts it flags across the official catalog, and about 82% precise overall; it misreads
 * planning artifacts that happen to depend on everything apply requires, and schemas that model
 * implementation as an ordinary artifact instead of through `apply`. Nothing declared separates
 * those from a genuine post-implementation step — `tracks` and `generates` look identical across
 * both — so there is no filter to add here, only honesty in how the edge is drawn.
 *
 * Two guards, each for an input the survey produced rather than for tidiness:
 * - **A resolvable requirement.** The superset test is vacuously true against an empty set, so a
 *   schema whose `apply.requires` names only undeclared artifacts would report every artifact.
 * - **An acyclic graph.** Levels are declaration order under a cycle, so there is no graph ordering
 *   to derive against, and layering one over the fallback would reason about the wrong thing.
 *
 * Not detected, and not detectable: a post-implementation artifact declaring `requires: []`. The
 * schema links it to nothing, so nothing follows from it — and it levels first, so it never reads
 * as apply's peer in the first place.
 */
export function postApplyArtifacts(
  artifacts: SchemaArtifactDef[],
  apply: { requires: readonly string[] } | null,
): string[] {
  if (!apply) return [];

  const requiresOf = new Map<string, readonly string[]>(artifacts.map((a) => [a.id, a.requires]));
  const applyRequires = apply.requires.filter((id) => requiresOf.has(id));
  if (applyRequires.length === 0) return [];
  if (levelArtifacts(artifacts).cyclic) return [];

  const beforeApply = closureOf(applyRequires, requiresOf);
  return artifacts
    .filter((a) => {
      if (beforeApply.has(a.id)) return false;
      const needs = closureOf([a.id], requiresOf);
      return applyRequires.every((id) => needs.has(id));
    })
    .map((a) => a.id);
}

/** Where a step's ordering relative to implementation came from. */
export type OrderingSource = "declared" | "derived";

/**
 * Which steps follow implementation, and on whose authority.
 *
 * The single seam between "what is this schema's shape" and "how did we work that out". Callers ask
 * here and branch on the source, never on which step an edge happens to connect — so an ordering
 * that arrives declared renders as an ordinary edge with no further change.
 *
 * **Precedence is per step.** A schema stating the ordering for one artifact and leaving another
 * implicit is served without a mode switch: the stated one is `declared` and the rest go to the
 * derivation. That matters because the format is expected to gain a way to say this (OpenSpec #1456
 * is deciding where phase configuration lives), and adoption should be a branch here rather than a
 * rework of the graph, the edge model, or the view.
 *
 * Today the only thing a schema can state is a `requires` entry naming the apply step. The CLI
 * rejects that — its build-order pass dereferences every entry as a declared artifact — so nothing
 * in the wild uses it, but it is the shape a legalised declaration would take, and reading it costs
 * one lookup.
 *
 * The apply step is a **parameter**, not the literal id `"apply"`: a schema may declare an artifact
 * of that name (`superspec` does, as an implementation receipt), and matching on the string would
 * confuse the two.
 */
export function resolveImplementationOrdering(
  artifacts: SchemaArtifactDef[],
  applyStep: RequiresNode | null,
): Map<string, OrderingSource> {
  const ordering = new Map<string, OrderingSource>();
  if (!applyStep) return ordering;

  // Only when no artifact claims that id. `superspec` declares an artifact called `apply`, so there
  // a `requires: [apply]` names that artifact — which the schema *does* declare and the CLI *does*
  // resolve — and reading it as the phase would invent an edge the author did not write. The
  // declared-artifact reading wins because it is the one OpenSpec itself would take.
  const claimedByArtifact = artifacts.some((a) => a.id === applyStep.id);
  if (!claimedByArtifact) {
    for (const a of artifacts) {
      if (a.requires.includes(applyStep.id)) ordering.set(a.id, "declared");
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
