## 1. Raise the marks that carry meaning

- [x] 1.1 In `packages/web/src/components/SchemaGraph.tsx`, draw the unselected edge stroke and the
  `schema-arrow` marker in `--color-text-muted` at opacity 0.85 instead of `--color-border`. The
  `schema-arrow-active` marker and the connected-edge stroke keep `--color-accent`.
- [x] 1.2 In the same file, give the **archive** node's resting outline `--color-text-muted` at 0.85,
  leaving every other step's resting outline at `--color-border`. The dash pattern is unchanged.
- [x] 1.3 Move the hovered-node outline from `--color-text-muted` to `--color-text-secondary`, for every
  node, so hover stays a visible step on a node whose resting outline is already legible.
- [x] 1.4 In `packages/web/src/components/SchemaFlow.tsx`, draw both legend swatches — the archive
  miniature and the derived-edge miniature, line and arrowhead alike — in the same colour and opacity as
  the marks they explain, so the two cannot drift apart again.
- [x] 1.5 Express the opacity so it is visible to a reader of the element (a `strokeOpacity` /
  `fillOpacity` attribute beside the colour), not folded into a pre-composited literal — the guard in
  group 2 reads the pair, and a literal would defeat the token.
- [x] 1.6 Share the mark's **colour** through a `MARK_COLOR` constant beside `MARK_OPACITY`, and use it
  at all six sites. The dash and the opacity were already shared and the colour was not, so "the swatch
  is drawn in the colour of the mark it explains" held by coincidence — one edit in `SchemaGraph` away
  from the legend stating a colour the diagram is not using, which is the drift the legend was last
  fixed for.

## 2. Fix the text the diagram already draws below its floor

- [x] 2.1 Draw the `generates` sub-label (`SchemaGraph.tsx`) in `--color-text-secondary` rather than
  `--color-text-muted`. On a **selected** step the sub-label sits on the accent wash at `fillOpacity`
  0.10, where `--color-text-muted` measures 4.45:1 in the light theme — under the 4.5 text floor, in the
  ordinary case of selecting a step that declares an output. This predates the change and is fixed here
  because the scan in group 3 is the first thing able to see it, and the change's own rule is that what
  the scan surfaces is resolved rather than deferred.
- [x] 2.2 Leave the wash at 0.10. Lightening it to ~0.06 also clears the floor but leaves ~0.2 of
  margin, because `--color-text-muted` measures 5.17 against the bare node fill in the light theme and
  that is its ceiling — see `design.md`.

## 3. Let the guard see the mechanism

- [x] 3.1 In `packages/web/src/styles/contrast.test.ts`, enumerate SVG colour as a **token-resident**
  mechanism: every `var(--color-*)` in a non-test `.tsx` source must be measured in the declared table or
  listed as owing nothing with its reason. Do **not** scope the match to `stroke=` / `fill=` attributes —
  the arrowhead colours live in an object literal (`{ id: "schema-arrow", color: "var(--color-border)" }`,
  `SchemaGraph.tsx:89-90`) and reach the element as `fill={color}`, so an attribute-scoped scan misses the
  first call site this change exists for while claiming to cover it. It also avoids matching a six-line
  ternary across element boundaries.
- [x] 3.2 Treat a companion `strokeOpacity` / `fillOpacity` on the same element as part of the colour, as
  the table already does for `bg-<token>/<alpha>`. Include the pairing of a text token over the selected
  step's accent wash — a token over a tint of a **different** token, which the existing tint column
  cannot express.
- [x] 3.6 **Surface** an unaccounted alpha, not merely declare the accounted ones — the `bg-<token>/<alpha>`
  parallel in 3.2 is a scan, and declaring without scanning leaves `strokeOpacity={0.25}` (1.43:1 dark /
  1.39:1 light, fainter than the hairline this change replaces) passing every check in the file. Judge
  numeric literals only; an identifier is a pass-through, since a named constant is measured where the
  table imports it and its definition is an `opacity:` property the same scan reads.
- [x] 3.7 Have the tables take `MARK_COLOR` and `MARK_OPACITY` from the source rather than restating
  them, so re-authoring either re-measures instead of leaving the table describing a diagram that moved.
- [x] 3.3 Account for every occurrence the scan surfaces — **16** before this change (13 in
  `SchemaGraph.tsx`, 3 in `SchemaFlow.tsx`) and **17** after, the extra one being the hovered outline the
  colour split adds. Count tokens, not attribute sites, or `fill={color}` and the two literals it reads
  get counted as three. Node label fills answer to the text floor; the selected
  node's accent wash is measured as the tint it is, per 3.2.
- [x] 3.4 Update the stated limits beside the scan. SVG `stroke` / `fill` carrying a `--color-*` token
  moves out of the "not covered" list. What replaces it must name **a bare `opacity` / `fill-opacity` /
  `stroke-opacity` attribute on an element whose colour is not a token, `currentColor` included** — the
  checkmark disc at `ChangeDetail.tsx:71` and the two marks at `Layout.tsx:97-98` are exactly that, and
  the disc is the occurrence the original exclusion was written about, so omitting it leaves it unscanned
  under a heading claiming coverage. Alongside it: a literal colour value, `style` attributes, and colour
  reaching SVG through a CSS class.
- [x] 3.5 Assert the new mechanism the way the existing ones are asserted: an occurrence that is neither
  measured nor declared fails the check.

## 4. Verify

- [x] 4.1 `npm run build:core && npm run build -w @spekjs/ui`, then `npm run type-check`, `npm run lint`
  and `npm test` — the same commands CI runs, so a gate that fails there fails here first.
- [x] 4.2 Confirm the declared table reproduces the figures the design rests on, computed from
  `global.css` rather than copied from this change: `--color-text-muted` at 0.85 over the worst surface
  of each theme (4.37 dark / 3.82 light), `--color-text-secondary` at full strength (6.58 / 6.92), and
  `--color-text-secondary` over the accent wash (5.53 / 5.96).
- [x] 4.3 Look at the diagram in a browser in **both** themes, against a schema that exercises every mark
  — a post-implementation step (dashed derived edge), a declared edge, and the archive step. The repo's
  own schemas have no post-implementation step, so this needs one shaped like `anvil` (`verify` requiring
  `tasks`, `apply.requires: [tasks]`, a `retrospective` after `verify`). Contrast is geometry-free but
  legibility at a swatch's size is not, and jsdom renders neither.
- [x] 4.4 Keep that fixture schema **out of the repo** — an untracked or user-scoped schema, in a scratch
  directory pointed at through the repo picker. `build-demo`'s `filterPublishableSchemas` drops
  `source: "user"` and *untracked* project schemas, so a committed one under `openspec/schemas/` would
  change what the published demo contains.
- [x] 4.5 Select a step that declares an output, in the light theme, and confirm the `generates` line is
  readable against the wash — the defect in group 2 is the one no test can see and no unselected screen
  shows.
- [x] 4.6 Hover the archive step in both themes and confirm the outline still visibly responds.
- [x] 4.7 No webview rebuild check is needed, unlike the earlier contrast changes: no token *value*
  moves, so the VS Code and IntelliJ bundles carry the same `global.css` they already did, and both load
  this SPA's source. Recorded rather than omitted, since the precedent changes each ran one.
