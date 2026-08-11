import { MarkdownRenderer } from "./MarkdownRenderer";
import { SchemaGraph } from "./SchemaGraph";
import { isFilePattern, type FlowLevel, type FlowStep } from "../utils/schemaView";

/**
 * The schema workflow: a diagram of the steps and their dependencies, with the selected step's
 * guidance beside it — or below it, once the viewport is too narrow to hold both.
 *
 * The diagram replaced a stack of cards in rows. Rows could show that two steps sat at the same
 * depth, but never which step fed which — `tasks` requiring both `specs` and `design`, or `design`
 * reaching across a level to get there — and that structure is the thing a reader is here to learn.
 * It also read as list markup rather than as a picture, next to the graph and timeline views.
 *
 * Detail sits outside the diagram rather than inside it: instruction text runs past a screen
 * (`superpowers-bridge`'s `retrospective` is ~6k characters), which no node can hold. At most one
 * is open, so the page cannot become a wall of stacked instructions, and it renders through the
 * shared MarkdownRenderer rather than a second Markdown path.
 */

function IconFile() {
  return (
    <svg
      className="w-3 h-3 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * The one open detail region. Never more than one, so the page cannot become a wall of text.
 *
 * It carries its own header — id, output, requirements — because it no longer sits directly under
 * the step it describes. Beside the diagram there is nothing adjacent to identify it, and on a
 * narrow viewport it lands below a diagram the reader may have scrolled away from.
 */
export function SchemaStepDetail({ step, onClose }: { step: FlowStep; onClose: () => void }) {
  return (
    <div
      id="schema-step-detail"
      className="animate-fade-in bg-bg-secondary border-accent/40 rounded border p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-text-primary font-medium">{step.id}</span>
            {step.generates &&
              // Apply does not *produce* this file, it tracks progress in one an artifact already
              // produced — `spec-driven`'s apply tracks the same `tasks.md` its `tasks` step wrote.
              // Showing it behind a file icon like every other step claims authorship it does not
              // have.
              (step.isApply ? (
                <span className="text-text-muted text-xs">
                  tracks <code className="bg-bg-tertiary text-accent rounded px-1.5 py-0.5">{step.generates}</code>
                </span>
              ) : (
                <span className="text-text-muted inline-flex items-center gap-1 text-xs">
                  <IconFile />
                  <code className="bg-bg-tertiary text-accent rounded px-1.5 py-0.5">{step.generates}</code>
                  {isFilePattern(step.generates) && <span>— one file per match</span>}
                </span>
              ))}
            {step.requires.length > 0 && (
              <span
                className="text-text-muted text-xs"
                // What `requires` actually buys you, stated where it is shown: openspec reports a
                // step as blocked until these exist. It is the graph's whole meaning, and knowing
                // it is what stops a reader mistaking the diagram for a recommended order.
                title="openspec reports this step as blocked until these artifacts exist"
              >
                requires{" "}
                <code className="bg-bg-tertiary text-accent rounded px-1.5 py-0.5">{step.requires.join(", ")}</code>
              </span>
            )}
          </div>
          {step.description && (
            <p className="text-text-secondary mt-1 text-sm">{step.description}</p>
          )}
          {/* Where the reader meets the derived edge and can act on it: the diagram says *that* the
              order was derived, this says what from. Stated as spek's own reasoning, and explicit
              that openspec does not enforce it — the schema's `requires` above is what does.

              No chip follows a possessive here. A chip's `px-1.5` padding stacks on the word space,
              and after a possessive — which ends tight — the pair reads as a double space even
              though only one space is there. Each chip sits after a dash or a plain word instead,
              where the extra air looks deliberate. The chip utilities are the app's shared
              vocabulary and are not the thing to adjust. */}
          {step.incoming.some((edge) => edge.origin === "derived") && (
            <p className="text-text-muted border-accent/30 mt-2 border-l-2 pl-2 text-xs">
              spek places this after implementation: it depends on everything the apply step depends
              on, and apply depends on none of it. The schema cannot say so —{" "}
              <code className="bg-bg-tertiary text-accent rounded px-1.5 py-0.5">requires</code> can
              name only other artifacts — so this order is spek&rsquo;s reading, not something{" "}
              <code className="bg-bg-tertiary text-accent rounded px-1.5 py-0.5">openspec</code>{" "}
              blocks on.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${step.id} details`}
          className="text-text-muted hover:text-accent shrink-0 transition-colors"
        >
          <IconClose />
        </button>
      </div>

      {step.isArchive ? (
        // Archive has no schema instruction to show and never will — saying "this schema declares
        // no instructions" would imply an omission rather than the fact that archiving belongs to
        // OpenSpec, not to any schema. This copy is spek's own, and says so.
        <p className="border-border text-text-muted border-t pt-3 text-sm">
          Archiving is an OpenSpec operation that every change ends with, whatever schema it was
          authored under — no schema declares it, so there is no schema guidance for it. Run{" "}
          <code className="bg-bg-tertiary text-accent rounded px-1.5 py-0.5">openspec archive &lt;change&gt;</code>.
        </p>
      ) : step.instruction ? (
        <div className="border-border border-t pt-3">
          <MarkdownRenderer content={step.instruction} />
        </div>
      ) : (
        <p className="border-border text-text-muted border-t pt-3 text-sm">
          This schema declares no instructions for this step.
        </p>
      )}
    </div>
  );
}

/**
 * The framed workflow panel: the diagram and its legend, nothing else.
 *
 * Selection state and the page layout live in `SchemaDetail`. Owning the two-column grid here made
 * the right column part of the Workflow section, which forced anything else that belonged beside
 * the diagram — provenance, usage — to nest under a heading it has nothing to do with.
 */
export function SchemaFlow({
  steps,
  levels,
  selectedKey,
  onSelect,
}: {
  steps: FlowStep[];
  levels: FlowLevel[];
  /** Step *key*, never a declared id — two steps may share an id, and both must be selectable. */
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  if (steps.length === 0) {
    return <p className="text-text-muted">This schema declares no workflow steps.</p>;
  }

  const hasDerivedEdge = steps.some((step) =>
    step.incoming.some((edge) => edge.origin === "derived"),
  );

  return (
    // Framed, like the Graph and Timeline views. Both wrap their visualisation in this exact
    // surface; ours floated loose on the page background, which is most of why it read as less
    // finished than they do.
    <div className="bg-bg-secondary border-border rounded border p-4">
      <SchemaGraph levels={levels} selectedKey={selectedKey} onSelect={onSelect} />

      {/* One row of labels, no prose. Every caveat here was defensible on its own and together
          they had grown into a paragraph nobody would read. What survives is what a reader cannot
          work out from the picture:
          - the two node marks,
          - that a shared row means no ordering between those steps,
          - that the arrows are the schema's declared `requires`, which is what openspec blocks on.
          The nuance behind that last one — instructions can impose ordering the graph does not —
          is a tooltip rather than a sentence, and the wildcard rule went entirely: the detail panel
          already says "one file per match" beside the output of the step you selected.

          Left-aligned, not centred: with wrapping, centring each row independently staggers them
          so the marks never line up into a column you can scan. The width cap keeps this from
          setting the panel's width. */}
      <div className="border-border text-text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="bg-accent inline-block h-2 w-2 shrink-0 rounded-full" />
          implementation
        </span>
        <span className="flex items-center gap-1.5">
          {/* A miniature of the archive node. At 12x8 with a 1px dash this was present in the DOM
              and invisible on screen — a legend mark has to read as the thing it stands for. */}
          <span className="border-text-secondary inline-block h-3.5 w-6 shrink-0 rounded-[3px] border border-dashed" />
          not declared by this schema
        </span>
        <span>same row = either order</span>
        <span
          title="openspec blocks a step until its requires exist. A step's instructions may add ordering the graph does not state."
          className="underline decoration-dotted underline-offset-2"
        >
          solid arrows = declared requires
        </span>
        {/* Only when the diagram actually contains one. A legend entry for a mark that is not on
            screen teaches a distinction the reader then goes looking for and cannot find, and most
            schemas declare nothing after implementation, so most diagrams have no dashed edge. */}
        {hasDerivedEdge && (
          <span
            title="OpenSpec cannot express an artifact produced after implementation, so schemas that have one point it at the last planning artifact and say the rest in prose. spek places it after the apply step because it depends on everything apply depends on, and apply depends on none of it. openspec does not block on this."
            className="flex items-center gap-1.5 underline decoration-dotted underline-offset-2"
          >
            <svg width="24" height="8" viewBox="0 0 24 8" aria-hidden="true" className="shrink-0">
              <path
                d="M 0 4 H 16"
                stroke="var(--color-border)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                fill="none"
              />
              <path d="M 16 0.5 L 23 4 L 16 7.5 z" fill="var(--color-border)" />
            </svg>
            dashed = order spek derived, not declared
          </span>
        )}
      </div>
    </div>
  );
}
