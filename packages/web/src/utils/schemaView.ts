import type {
  SchemaApplyDef,
  SchemaArtifactDef,
  SchemaDegradedReason,
  SchemaSource,
} from "@spekjs/core";
// The levelling lives in core as facts about the `requires` graph, kept apart from this file's
// geometry. Imported from the `/schema-flow` subpath, not the root: this file is bundled into the
// browser and the root entry reaches for child_process.
import { applyStepLevel, computeArtifactLevels } from "@spekjs/core/schema-flow";
import { plural } from "./plural";

/**
 * Pure view logic for the schema pages, kept out of the components so it can be tested without a
 * DOM — the same split the rest of this package uses.
 */

/** One rendered step of a schema's workflow. */
export interface FlowStep {
  /** Artifact id, or "apply" for the implementation step. */
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
  requires: string[];
  instruction: string | null;
  /** The apply step, which is styled as implementation rather than an authored artifact. */
  isApply: boolean;
  /** The archive step: a universal OpenSpec operation, not something the schema declares. */
  isArchive: boolean;
}

/**
 * Every step of a schema's workflow — its artifacts plus the apply step — each carrying the
 * dependency level it sits at. Apply is levelled from its own `requires` like anything else, so a
 * schema with post-implementation steps (verify, retrospective) shows them after it.
 */
export function buildFlowSteps(
  artifacts: SchemaArtifactDef[],
  apply: SchemaApplyDef | null,
): FlowStep[] {
  const levels = computeArtifactLevels(artifacts);

  const steps: FlowStep[] = artifacts.map((artifact) => ({
    id: artifact.id,
    level: levels.get(artifact.id) ?? 1,
    generates: artifact.generates,
    description: artifact.description,
    requires: artifact.requires,
    instruction: artifact.instruction,
    isApply: false,
    isArchive: false,
  }));

  if (apply) {
    steps.push({
      id: "apply",
      // Levelled by its own `requires` — see applyStepLevel. Never pinned last.
      level: applyStepLevel(levels, apply) ?? 1,
      generates: apply.tracks,
      description: apply.tracks
        ? `Implement the change. Progress is tracked in ${apply.tracks}.`
        : "Implement the change.",
      requires: apply.requires,
      instruction: apply.instruction,
      isApply: true,
      isArchive: false,
    });
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
 * alone; in `superpowers-bridge` it is `apply` and `retrospective` both, since neither feeds
 * anything else.
 */
export function withArchiveStep(steps: FlowStep[]): FlowStep[] {
  if (steps.length === 0) return steps;

  const leaves = steps.filter((step) => !steps.some((other) => other.requires.includes(step.id)));

  return [
    ...steps,
    {
      id: "archive",
      level: Math.max(...steps.map((s) => s.level)) + 1,
      generates: null,
      description:
        "Folds the change's delta specs into openspec/specs/ and moves the change under archive/.",
      requires: leaves.map((s) => s.id),
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
