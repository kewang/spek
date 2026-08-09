import type { SchemaApplyDef, SchemaArtifactDef } from "./types.js";

/**
 * The shape of a schema's workflow: which steps can be reached only after which others.
 *
 * Its own module, exported at the `@spekjs/core/schema-flow` subpath, for the same reason `headings`
 * is: the frontend needs this and must not pull in `child_process` to get it. In core rather than in
 * the web package because the schemas list and the detail diagram both need the same answer.
 */

/**
 * Dependency level per artifact id: 1 + the deepest level among the artifacts it requires.
 *
 * A `requires` entry naming something the schema does not declare cannot be ranked, so it is
 * ignored. A cycle has no valid levelling, so the whole schema falls back to positional levels
 * rather than looping or inventing a rank.
 */
export function computeArtifactLevels(artifacts: SchemaArtifactDef[]): Map<string, number> {
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
  if (cyclic) return new Map(artifacts.map((a, i) => [a.id, i + 1]));
  return levels;
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

/**
 * Distinct dependency levels the schema's steps occupy, apply included — what a schema row reports
 * instead of a count of declared artifacts, which is exact but reads as a count of files: one
 * artifact declaring a glob output produces as many files as the change needs.
 *
 * Excludes archiving, which belongs to OpenSpec rather than to any schema.
 */
export function schemaStageCount(
  artifacts: SchemaArtifactDef[],
  apply: SchemaApplyDef | null,
): number {
  const levels = computeArtifactLevels(artifacts);
  const stages = new Set(levels.values());
  const applyLevel = applyStepLevel(levels, apply);
  if (applyLevel !== null) stages.add(applyLevel);
  return stages.size;
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
 * Not mirrored in the Kotlin `SchemaFlow.kt`, deliberately: no Kotlin host draws the diagram — the
 * IntelliJ tool window loads the same React SPA — so nothing on that side has a use for it.
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
