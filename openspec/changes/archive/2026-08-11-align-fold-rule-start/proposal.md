## Why

The extent mark drawn down an open section's left edge starts about 20px above the heading it marks, so
two consecutive requirements read as one interrupted line rather than as two brackets. The separation
between sibling sections was added in v1.13.0 precisely so the mark would stop where a section stops
(`spec-section-folding`: "two marks that touch draw a single line spanning both sections"), but most of
the gap it opens is immediately filled by the next section's mark running up past its own heading —
what a reader sees is a notch in a continuous line, not an ending and a beginning.

The cause is that a heading's leading space falls inside the section that contains it. The spec already
says this, and uses it to argue that separation must come from the section rather than from the
heading's spacing — it does not yet say that the same leading space must not be marked. Reported on
issue #42 (fourth round, against v1.13.0).

## What Changes

- The extent mark SHALL begin at the top of its section heading's text, not at the top of the space
  above that heading. The heading's leading space stays inside the section's box but outside what the
  mark claims.
- Consequently the space above a folded heading has to be held by the section rather than by the
  heading. Three separations that a reader can compare directly are in scope and must come out
  unchanged: between two requirement sections (28px), between an operation heading and the first
  requirement below it (32px), and between two scenario sections (16px). The present rules deliberately
  spend only `margin-bottom` for the first of those, in order not to disturb the second; moving the
  heading's space out of the section reopens that.
- One case does change: a scenario section with no requirement before it — a shape the spec already
  covers — reserves the space of a top-level section rather than of an `h4`, moving it and everything
  below it down by 4px. Accepted deliberately, and made normative rather than left as a side effect:
  the alternative is to key the spacing to heading level, which is what the surrounding rules are
  written to avoid, since which levels fold is the caller's choice.
- No change to which sections fold, to heading levels or ids, to the mark's colour, weight, or nesting
  behaviour.
- Incidentally fixes an existing violation: today an open section's heading and disclosure marker sit
  1px right of a closed one's, which the spec's "same left edge" scenario forbids. The 1px is the
  border being replaced.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `spec-section-folding`: the requirement "An open section's body is inset from its heading" gains a
  rule for where a mark starts, and the sibling-separation rule tightens from "the marks do not meet"
  to "the separation between them is empty" — a gap that is mostly mark satisfies the present wording
  while failing what it is for.

## Impact

- `packages/web/src/styles/global.css` — the `details[data-spek-fold]` rules (inset, sibling spacing,
  `display: flow-root`).
- `packages/web/src/components/MarkdownRenderer.tsx` — not edited, but its `h3` / `h4` spacing classes
  become a value the stylesheet restates, since a folded heading's own margin is neutralised. That pair
  needs a test holding it together; nothing else about the component changes.
- Tests: `MarkdownRenderer.hierarchy.test.ts` and `MarkdownRenderer.keyword.test.ts` assert these rules
  as text against `global.css`, so they move with the rules. Geometry is invisible to jsdom — the
  measurement is a headless-Chrome pixel-column scan of the rendered component against the built
  stylesheet, as when the mark was introduced.
- Presentation only: no core, API, or adapter surface changes, and nothing for the `@spekjs/*` version
  lines. Ships on the product line (Web, VS Code, IntelliJ share the renderer).
