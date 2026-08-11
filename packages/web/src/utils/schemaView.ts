import type {
  SchemaApplyDef,
  SchemaArtifactDef,
  SchemaDegradedReason,
  SchemaSource,
} from "@spekjs/core";
// The levelling lives in core as facts about the `requires` graph, kept apart from this file's
// geometry. Imported from the `/schema-flow` subpath, not the root: this file is bundled into the
// browser and the root entry reaches for child_process.
import {
  levelArtifacts,
  resolveImplementationOrdering,
  type OrderingSource,
} from "@spekjs/core/schema-flow";
import { plural } from "./plural";

/**
 * Pure view logic for the schema pages, kept out of the components so it can be tested without a
 * DOM — the same split the rest of this package uses.
 */

/**
 * One connection into a step, and whose authority it rests on.
 *
 * `derived` means spek worked the ordering out because the schema had no way to state it, and the
 * view must draw it so a reader can tell. `declared` covers both an ordering the schema states and
 * one that follows definitionally — archiving waits for every leaf whatever the schema says, and
 * that cannot be wrong in the way an inference about intent can.
 */
export interface FlowEdge {
  /** `key` of the step this edge comes from — never a declared id. */
  from: string;
  origin: OrderingSource;
}

/** One rendered step of a schema's workflow. */
export interface FlowStep {
  /**
   * Unique within the flow, and **not** the declared id.
   *
   * A schema may declare an artifact named `apply` — `superspec` does, as an implementation
   * receipt — which is a different step from the phase declared under the schema's `apply:` key.
   * Identifying steps by declared id alone let one silently replace the other in every map that
   * keyed by it, so connections resolved to whichever won.
   */
  key: string;
  /** Artifact id as declared, or "apply" / "archive". What the reader sees. */
  id: string;
  /**
   * Dependency level, 1-based — **not** the position in the list.
   *
   * A step's level is one past the deepest thing it requires, so two steps that depend on the same
   * prerequisite share a level. In `spec-driven`, `specs` and `design` both require only
   * `proposal`, so both are level 2: nothing in the schema orders them relative to each other, and
   * numbering them 2 and 3 would claim a constraint that does not exist.
   */
  level: number;
  generates: string | null;
  description: string | null;
  /** Declared `requires`, as authored — what the tooltip and detail region name. */
  requires: string[];
  /** Connections into this step, by step key. The graph the diagram actually draws. */
  incoming: FlowEdge[];
  instruction: string | null;
  /** The apply step, which is styled as implementation rather than an authored artifact. */
  isApply: boolean;
  /** The archive step: a universal OpenSpec operation, not something the schema declares. */
  isArchive: boolean;
}

/** The id a schema would use if it could name the apply phase in a `requires`. */
const APPLY_ID = "apply";

/**
 * Hands out step keys, giving each step its declared id unless something already holds it.
 *
 * So for every schema without a collision the key *is* the id, and the diagram's graph reads in the
 * schema's own vocabulary. Only where two steps genuinely claim one name does a key diverge —
 * `superspec` declares an artifact called `apply` alongside its apply phase — and then the later
 * claimant is suffixed rather than either being dropped. Prefixing every key by kind would also
 * work and would make every id in the graph a translation of the schema's.
 */
function keyAllocator(): (preferred: string) => string {
  const taken = new Set<string>();
  return (preferred) => {
    let key = preferred;
    for (let n = 2; taken.has(key); n++) key = `${preferred}#${n}`;
    taken.add(key);
    return key;
  };
}

/**
 * Every step of a schema's workflow — its artifacts plus the apply step — each carrying the
 * dependency level it sits at and the connections into it.
 *
 * **Apply is levelled as a node of the graph**, not placed once the artifacts are levelled. That is
 * what lets a step depend on it: OpenSpec cannot express an artifact produced after implementation,
 * so a schema that has one points it at the last planning artifact and says the rest in prose, and
 * spek recovers the ordering from the graph (`resolveImplementationOrdering`). Levelling apply
 * afterwards could only ever put such a step beside it.
 *
 * Levelling uses the **full** set of connections, not the transitive reduction the diagram draws.
 * Dropping an implied edge never shortens the longest path, so the levels are the same either way —
 * but computing them from the reduction would make that a coincidence rather than a guarantee.
 */
export function buildFlowSteps(
  artifacts: SchemaArtifactDef[],
  apply: SchemaApplyDef | null,
): FlowStep[] {
  const ordering = resolveImplementationOrdering(
    artifacts,
    apply ? { id: APPLY_ID, requires: apply.requires } : null,
  );

  const nextKey = keyAllocator();
  // Declared id to step key. First claimant wins, which is what a `requires` naming it would mean.
  const keyOf = new Map<string, string>();
  const artifactKeys = artifacts.map((artifact) => {
    const key = nextKey(artifact.id);
    if (!keyOf.has(artifact.id)) keyOf.set(artifact.id, key);
    return key;
  });
  const applyKey = apply ? nextKey(APPLY_ID) : null;

  const steps: FlowStep[] = artifacts.map((artifact, i) => {
    const incoming: FlowEdge[] = artifact.requires
      .map((id) => keyOf.get(id))
      .filter((key): key is string => key !== undefined)
      .map((key) => ({ from: key, origin: "declared" as const }));

    const source = ordering.get(artifact.id);
    if (source && applyKey) incoming.push({ from: applyKey, origin: source });

    return {
      key: artifactKeys[i],
      id: artifact.id,
      level: 1,
      generates: artifact.generates,
      description: artifact.description,
      requires: artifact.requires,
      incoming,
      instruction: artifact.instruction,
      isApply: false,
      isArchive: false,
    };
  });

  if (apply && applyKey) {
    steps.push({
      key: applyKey,
      id: APPLY_ID,
      level: 1,
      generates: apply.tracks,
      description: apply.tracks
        ? `Implement the change. Progress is tracked in ${apply.tracks}.`
        : "Implement the change.",
      requires: apply.requires,
      incoming: apply.requires
        .map((id) => keyOf.get(id))
        .filter((key): key is string => key !== undefined)
        .map((key) => ({ from: key, origin: "declared" as const })),
      instruction: apply.instruction,
      isApply: true,
      isArchive: false,
    });
  }

  const { levels } = levelArtifacts(
    steps.map((step) => ({ id: step.key, requires: step.incoming.map((edge) => edge.from) })),
  );
  for (const step of steps) step.level = levels.get(step.key) ?? 1;

  // Apply requiring nothing the schema declares has no dependency to place it by, so it goes after
  // every artifact rather than sharing the first level with the roots. Skipped when something
  // depends on apply, which would otherwise be ranked above the step it follows.
  const applyStep = steps.find((step) => step.isApply);
  const hasDependent = steps.some((step) => step.incoming.some((e) => e.from === applyKey));
  if (applyStep && !hasDependent && !apply?.requires.some((id) => keyOf.has(id))) {
    applyStep.level = Math.max(0, ...steps.filter((s) => !s.isApply).map((s) => s.level)) + 1;
  }

  return steps;
}

/**
 * Append the archive step — the terminal stage every OpenSpec workflow ends at.
 *
 * Kept out of `buildFlowSteps` because it is **not schema content**: no `schema.yaml` declares an
 * `archive` key, and the OpenSpec authority returns no instruction, requirements or tracked file
 * for it. It is a property of OpenSpec itself, so it is composed on rather than parsed out, and the
 * view marks it as distinct from the steps the schema does declare.
 *
 * It depends on every *leaf* — each step nothing else requires. That is the honest dependency: a
 * change is archived once everything it declares is finished. In `spec-driven` that is `apply`
 * alone. In `superpowers-bridge` it is `retrospective` alone, because `verify` follows apply, so
 * apply is no longer a step nothing else requires — a consequence of the leaf rule rather than a
 * change to it.
 *
 * Leaves are found through the drawn connections rather than through declared `requires`, so an
 * ordering spek derived counts exactly as a declared one does. Its own edges are `declared`: the
 * archive step is already marked as spek's rather than the schema's, and "everything is finished"
 * is definitional, not an inference about the author that could turn out wrong.
 */
export function withArchiveStep(steps: FlowStep[]): FlowStep[] {
  if (steps.length === 0) return steps;

  const leaves = steps.filter(
    (step) => !steps.some((other) => other.incoming.some((edge) => edge.from === step.key)),
  );

  const nextKey = keyAllocator();
  for (const step of steps) nextKey(step.key);

  return [
    ...steps,
    {
      key: nextKey("archive"),
      id: "archive",
      level: Math.max(...steps.map((s) => s.level)) + 1,
      generates: null,
      description:
        "Folds the change's delta specs into openspec/specs/ and moves the change under archive/.",
      requires: leaves.map((s) => s.id),
      incoming: leaves.map((s) => ({ from: s.key, origin: "declared" as const })),
      instruction: null,
      isApply: false,
      isArchive: true,
    },
  ];
}

/** One dependency level: the steps that become available at the same point in the workflow. */
export interface FlowLevel {
  level: number;
  steps: FlowStep[];
}

/**
 * Group steps into dependency levels, so the view can render each level as a row and the steps
 * within it side by side. Parallelism becomes structural — you can see that `specs` and `design`
 * sit together — rather than something a connector label has to explain.
 *
 * This is a **deliberate departure from the schema's declared order**: a level-1 artifact declared
 * after a level-2 one moves up into the first row. Declared order is only one linearisation of the
 * dependency graph; the levels are the graph. Within a level the declared order is preserved, so
 * the schema still decides the order of anything it actually constrains.
 */
export function groupIntoLevels(steps: FlowStep[]): FlowLevel[] {
  const byLevel = new Map<number, FlowStep[]>();
  for (const step of steps) {
    const bucket = byLevel.get(step.level);
    if (bucket) bucket.push(step);
    else byLevel.set(step.level, [step]);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, levelSteps]) => ({ level, steps: levelSteps }));
}

/**
 * How each source reads to a person, in one place.
 *
 * Three sources, in the resolver's precedence order: the repo's own `openspec/schemas/`, the
 * machine's global data directory, then the schemas shipped inside the openspec package. Keeping
 * the wording here means a fourth source is one edit, not a hunt through three components — the
 * `user` source had already gone missing once because it was spelled out in each of them.
 */
/** The same distinction as a tooltip, for the compact badge. */
export function sourceTitle(source: SchemaSource): string {
  switch (source) {
    case "project":
      return "Defined in this repo under openspec/schemas/ — takes precedence over machine and built-in schemas of the same name";
    case "user":
      return "Defined for this machine in OpenSpec's global data directory — takes precedence over built-in schemas of the same name";
    case "package":
      return "Shipped with the OpenSpec package";
  }
}

/**
 * Whether a `generates` value is a file pattern rather than one named file.
 *
 * This matters for honesty about counts: `specs/**\/*.md` is a single declared artifact that
 * produces however many delta files a change needs. A count of artifacts is therefore never a
 * count of files.
 */
export function isFilePattern(generates: string | null): boolean {
  return generates !== null && generates.includes("*");
}

/**
 * Why no schemas are listed, in the user's terms. Each reason is worded separately because only one
 * of them is the user's to fix — installing the CLI resolves the first and nothing else.
 *
 * These say *no* schemas rather than "built-in schemas", and promise nothing is shown in their
 * place: the list comes from the CLI alone, including for the repo's own `openspec/schemas/`, so a
 * CLI that cannot answer leaves nothing to fall back on.
 */
export function degradedMessage(reason: SchemaDegradedReason): string {
  switch (reason) {
    case "cli-unavailable":
      return "Schemas could not be listed because the OpenSpec CLI is not available. Installing it would resolve this.";
    case "cli-timeout":
      return "Schemas could not be listed because the OpenSpec CLI did not respond in time.";
    case "cli-failed":
      return "Schemas could not be listed because the OpenSpec CLI reported an error.";
    case "cli-unparsable":
      return "Schemas could not be listed because the OpenSpec CLI returned output spek could not read.";
  }
}

/** Why one schema could not be shown. "Does not exist" and "could not look" stay distinct. */
export function schemaUnavailableMessage(
  reason: "not-found" | SchemaDegradedReason,
  name: string,
): string {
  if (reason === "not-found") return `No schema named "${name}" was found for this repo.`;
  if (reason === "cli-unavailable") {
    // Not "if it is a built-in schema": a name is resolved through the CLI whatever its source, so
    // a schema in this very repo is just as unreadable without it.
    return `"${name}" could not be read because the OpenSpec CLI is not available. Installing it would resolve this.`;
  }
  if (reason === "cli-timeout") {
    return `"${name}" could not be read because the OpenSpec CLI did not respond in time.`;
  }
  if (reason === "cli-unparsable") {
    return `"${name}" could not be read because the OpenSpec CLI returned output spek could not read.`;
  }
  return `"${name}" could not be read because the OpenSpec CLI reported an error.`;
}

/**
 * The usage label on a schema row. Says "active" explicitly: the count comes from the active
 * changes only, and archived changes declaring the same schema are not in it. "1 change using it"
 * would read as the total.
 */
export function usageLabel(count: number): string {
  if (count === 0) return "No active changes";
  return `${count} active ${plural(count, "change")}`;
}

/**
 * What the list view is entitled to say about how many schemas the repo has.
 *
 * Both pieces of copy — the header count and the empty state — are claims about the *repo*, and a
 * degraded enumeration has established nothing about it: the list is empty because we could not
 * look. Rendering either beneath "schemas could not be listed" contradicts the line above it.
 *
 * They are decided together rather than at their two call sites because that is the way they broke:
 * the empty state was suppressed for a reason that applied to the count just as much, in a smaller
 * font a few lines up.
 */
export function schemaCountClaims(
  schemaCount: number,
  degradedReason: SchemaDegradedReason | null | undefined,
): { showCount: boolean; showEmptyState: boolean } {
  if (degradedReason != null) return { showCount: false, showEmptyState: false };
  return { showCount: true, showEmptyState: schemaCount === 0 };
}
