## Why

The schema workflow diagram (`/schemas/:name`) draws every line it has in `--color-border` — edges,
arrowheads, the archive node's outline, and both legend swatches. That token measures **1.22:1 dark and
1.13:1 light** against the surfaces those marks sit on. It is a panel hairline, and in this diagram the
lines are not hairlines: an arrow is the only thing stating that `specs` depends on `proposal`, and a dash
is the only non-colour cue separating "declared, `openspec` blocks on this" from "derived, spek guessed"
(shipped in #48) and from "not declared by this schema".

The identical question was settled for the `/graph` page with the identical measurements — `graph-view`
already states that an edge "SHALL meet at least 3:1" and names `--color-border` as the value it may not
be, "so no opacity of it helps". `@spekjs/ui` was re-authored accordingly. The schema diagram was written
later and never inherited any of it.

It regressed unseen because the palette guard's enumeration declares SVG presentation attributes as
outside its coverage. That declaration was defensible when the only such attribute was decorative; it
stopped being defensible once the diagram began stating its meaning through them.

## What Changes

- The schema diagram's meaning-carrying marks take `--color-text-muted` (5.52:1 dark / 5.17:1 light at
  full strength) instead of `--color-border`: the edge stroke, the arrowhead marker, the archive node's
  outline, and both legend swatches.
- Ordinary step nodes keep `--color-border`. Their outline states nothing their fill and label do not —
  it is the archive node that is different, because its dash is the sole carrier of "not declared by this
  schema".
- The legend swatches continue to take the same value as the marks they explain, so the key cannot come
  to state something the diagram is not drawing.
- The `generates` sub-label takes `--color-text-secondary`. On a selected step it is drawn over an accent
  wash where `--color-text-muted` measures **4.45:1 in the light theme** — under the text floor, in the
  ordinary case of selecting a step that declares an output. This predates the change and violates a
  requirement `theme-toggle` already states; it is fixed here because the new scan is the first thing
  able to see it.
- The palette guard enumerates SVG colour, matching the `--color-*` token wherever it appears in a `.tsx`
  source rather than only inside a `stroke` / `fill` attribute — the arrowhead colours live in an object
  literal and would otherwise go unscanned beneath a claim of coverage. Each occurrence is measured or
  declared as owing nothing with its reason, and the stated limits are updated to match, including the
  bare `opacity` attributes on non-token colours that the scan still does not reach.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `schema-browsing`: the workflow diagram's marks gain a stated contrast obligation — an edge, an
  arrowhead and the archive node's dash each carry information no text on the page repeats, and the
  legend swatches take the value of the marks they explain. The spec currently requires the archive step
  to be "drawn differently … with the legend naming that difference" without requiring that either mark
  be visible.
- `theme-toggle`: declaring a mechanism outside the enumeration ceases to be an unconditional option. It
  is available while the application does not use that mechanism to carry meaning, and a mechanism that
  begins to carry meaning must be enumerated. Today's wording — "added to the enumeration **or** declared
  as outside it" — is satisfied by a declaration that has gone stale, which is the failure this change
  is fixing.

## Impact

- `packages/web/src/components/SchemaGraph.tsx` — arrowhead marker colour, edge stroke, archive node
  outline, hovered outline, and the `generates` sub-label.
- `packages/web/src/components/SchemaFlow.tsx` — the archive and derived-edge legend swatches.
- `packages/web/src/styles/contrast.test.ts` — a new scanned mechanism, its declaration table, and the
  stated limits. Every `--color-*` token in a `.tsx` source is in those two components — 16 occurrences —
  so the scan forces no decision outside the files already being edited. One of the 16 was already under
  its floor, which is resolved here rather than left to the next person.
- `CLAUDE.md` names SVG presentation attributes among what the guard does not cover, and this change
  makes that false. Doc updates land at archive time by convention, but it is named here because a stale
  declaration about what is covered is the exact defect this change exists to retire.
- No change to `@spekjs/core`, `@spekjs/ui`, or any published API. No CLI call, no filesystem read, no
  Kotlin mirror — the IntelliJ tool window loads the same React SPA.
- Visual only: no route, endpoint, or data shape moves.
