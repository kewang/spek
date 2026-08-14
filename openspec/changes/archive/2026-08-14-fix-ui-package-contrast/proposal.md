## Why

`fix-theme-contrast` re-authored the app's palette and stated the obligation in `theme-toggle`: every colour applied
to text clears 4.5:1 in every theme, a graphic that is the only carrier of its information clears 3:1, and neither may
be undone by opacity. `/graph` and `/timeline` are pages of that app, and they do not meet it — the change said so and
deferred them here, because they are drawn by `@spekjs/ui`, which is a separate release line.

The package's colour contract is **8 `--spek-*` variables that the host overrides**, and it works: nothing in the last
change touched this package, yet its tooltip's active status went from 2.37:1 to 4.75:1 and its in-progress timeline
bar from 2.29:1 to 3.94:1, purely by inheriting the host's new light values.

What fails is the colour that never entered the contract. Nine hex literals sit outside it — in `SpecGraph`'s node
fills and strokes and in the legend swatches — and a literal cannot follow a theme it cannot see. **Five of the nine
are copies of a contract value that already exists**, which is the whole shape of this change: they are not missing
colours, they are colours that stopped going through the one mechanism the package has.

## What Changes

- **The literals that duplicate a contract value use it instead.** `#f59e0b` (spec node, legend) is `--spek-accent`;
  `#64748b` (archived node, legend) is `--spek-text-muted`; `#94a3b8` (`theme.ts`'s two last-resort returns) is
  `--spek-text-secondary`. This is the largest part of the fix and it needs **no new API and no host change** — the
  values become the host's, so the light theme repairs itself: the spec node goes 1.85:1 → 4.74:1 and the archived
  node 3.32:1 → 3.81:1. The archived node was failing in the **dark** theme too, at 2.93:1, because its literal is a
  copy of `--spek-text-muted`'s *former* value: the token was re-authored to 4.37:1 and the copy did not follow.
  Node strokes are handled by the rule below, not by this one.
- **The package's own defaults are re-authored where they fail.** `--spek-text-muted` is still `#64748b` — the value
  the host re-authored *because it measured failing* — and under the package's defaults it carries the tooltip body,
  the timeline's empty state, its section labels and its axis ticks, all at 3.90:1. Every un-themed consumer reads
  that today. It becomes `#8595aa`.
- **One colour is genuinely absent from the contract and gains a variable.** The active-change green (`#22c55e` fill,
  `#4ade80` stroke) has no contract equivalent; at 1.96:1 in the light theme it is the worst remaining graph value.
  It becomes a new `--spek-*` variable with a dark default, mapped by the web host, and named for the mark it draws
  rather than for the state — the timeline draws the same "active" fact from the accent.
  **An added variable is not inherited the way a reused one is**: an existing host — the downstream Electron app —
  overrides the eight names it knows and will silently take the new default. That is the same defect in a new place,
  so the count of new variables is kept to what cannot be derived, and the addition is called out for consumers.
- **The two decorative strokes stop being independent colours.** `#fbbf24` and `#4ade80` are a lighter step of their
  own fill, which is a dark-theme assumption: on a light page the rim must go *darker*, not lighter. They derive from
  the fill rather than naming a third and fourth colour.
- **The timeline's marks stop being opacities.** The archived bar (`--spek-text-muted` at `fillOpacity` 0.45) measures
  1.91:1 light and 2.17:1 dark **after** the host's fix; the "today" label at 0.8 is 4.39:1 light, under the text
  floor; the "today" line at `strokeOpacity` 0.5 is 2.35:1 light. Same lesson as the completed task row: the multiply
  happens after the colour is chosen, so no token value reaches the floor. Each of those colours clears its floor at
  full strength.
- **The graph's edges are measured and decided.** `--spek-border` at `stroke-opacity` 0.6 is 1.10:1 light / 1.20:1
  dark, and 1.13:1 / 1.22:1 even at full strength — no opacity of it draws a visible edge. `fix-theme-contrast`
  deliberately left `--color-border` alone as a decorative panel edge, and that judgement does not transfer: a graph
  edge *is* the relationship it draws. The timeline's three other border marks — both grid lines and the topic
  separator — are measured here too and **kept**, because a bar's dates come from the axis labels and the tooltip,
  and the separator divides groups that are already labelled.
- **`.spekui-tooltip-ongoing`'s `opacity: 0.8` goes.** It composites the muted colour its parent sets — 4.32:1 dark
  and 3.68:1 light, a live failure, and 2.94:1 under the package's current default. Because the colour is already the
  parent's, removing the opacity **deletes** the de-emphasis rather than relocating it: "(ongoing)" will read like the
  text beside it, distinguished only by its parentheses.
- **The exemption the hover interaction needs is written where the rule lives.** `theme-toggle` permitted exactly one
  exception to the opacity clause (inactive components), and `graph-view`'s mandated `opacity` 0.1 on non-connected
  nodes is not it. Rather than leave one spec contradicting another, that requirement gains a second, narrow
  exception for a reader-caused emphasis state that ends when the reader stops, restores everything, and hides
  nothing.
- **The contract's own obligation is stated.** The package has no theme concept by design: it holds one set of
  defaults and the host maps its tokens onto the variables. So "per-theme token" cannot be the rule here — the rule is
  that **every colour the package renders is expressible by the host**, i.e. no colour literal outside the contract.
  That is what stops the next `#22c55e`, and it is checkable without knowing anything about a host's themes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-package`: "The package defines an explicit colour contract" says which variables exist and that the host
  overrides them; it does not say that they are the *only* source of colour, which is exactly how nine literals grew
  beside it. Adds that obligation, and the contract's new member.
- `graph-view`: "Node visual encoding" and "Graph legend" name the colours; they are restated in terms of the
  contract rather than hues that only exist in one theme. "Edge rendering" gains the floor or the exemption.
  **"Hover highlight interaction" mandates `opacity` 0.1 on non-connected nodes** — 1.08:1 light, 1.14:1 dark, on
  labelled nodes, which contradicts the clause `theme-toggle` now carries. This change is where that is resolved:
  either a transient focus interaction is exempt and the spec says so, or the dimming gets a floor.
- `timeline-view`: "Timeline visualizes change lifecycle as bars" describes the archived bar's appearance; the
  mechanism moves from opacity to colour, and the floors are stated where the bars and the today marker are specified.
- `theme-toggle`: its opacity clause admits "inactive user interface components as the **only** exception", which the
  graph's hover dimming is not. The clause gains a second, narrowly drawn exception rather than this change resolving
  the contradiction on one side and leaving it in the specs.

## Impact

- **`packages/ui/src`** — `SpecGraph.tsx` (node fills, strokes, edges), `styles.css` (legend swatches, the contract
  block including the re-authored muted default, the tooltip's opacity), `theme.ts` (the new variable, its fallback,
  the re-authored default, and the two last-resort literals), `timeline/TimelineBar.tsx` (fill opacity),
  `timeline/TimelineAxis.tsx` (the today label and line). `timeline/ChangeTimeline.tsx` is **read and left alone** —
  its topic separator is one of the border marks judged decoration.
- **`packages/web/src/styles/global.css`** — maps the new variable, alongside the eight already there.
- **`@spekjs/ui` is a published package on its own version line.** The contract gains a member, so this is **additive
  — a minor bump**, not a patch, and consumers who override the contract need to know a new name exists. The version
  and CHANGELOG belong to whoever cuts that release, not to this change; the fact that it is minor-not-patch is
  recorded here for them.
- **The web app is the only in-repo consumer** and resolves the package by workspace, so nothing waits on the
  release; VS Code and IntelliJ ship the same SPA and follow from a webview rebuild.
- **The contrast guard does not extend here.** `packages/web/src/styles/contrast.test.ts` parses the *app's*
  `global.css` and scans the app's class literals; the package has neither. Whether the rule "no colour outside the
  contract" gets its own check in `packages/ui`, and what it can see given d3 writes colours into SVG attributes, is
  a design question this change has to answer rather than assume.
