## 1. The contract: one new member, one stale default

- [x] 1.1 Re-author `--spek-text-muted` from `#64748b` to `#8595aa` in `packages/ui/src/styles.css` and in
  `theme.ts`'s `FALLBACKS`. It is the host's old failing value: under the package's own defaults it carries the
  tooltip body, the timeline's empty state, its section labels and its axis ticks, all at 3.90:1 against the
  package's `--spek-bg-secondary`
- [x] 1.2 Add `--spek-node-active` to the `:root` defaults (`#22c55e`, 6.41:1 at the node's fill-opacity against the
  package's own background) and to `CSS_VARS` + `FALLBACKS`, with an English comment recording that an added member
  is **not** inherited by a host that overrode only the names it knew, and that the name is scoped to the graph node
  because the timeline draws the same "active" fact from the accent
- [x] 1.3 Replace `theme.ts`'s two `?? "#94a3b8"` last-resort returns with `FALLBACKS[CSS_VARS.textSecondary]` —
  they are literals outside the contract, and 4.1 will fail on them
- [x] 1.4 Map the new member in the host: `--spek-node-active: var(--color-status-success)` in
  `packages/web/src/styles/global.css`, beside the eight already there (7.16:1 dark / 4.74:1 light at the node's
  fill-opacity)

## 2. SpecGraph draws from the contract

- [x] 2.1 Spec node — `fill` from `--spek-accent` instead of `#f59e0b`, `stroke` the same colour instead of
  `#fbbf24`, `fill-opacity` 0.85 unchanged (1.85:1 → 4.74:1 light)
- [x] 2.2 Change nodes — active from `--spek-node-active`, archived from `--spek-text-muted`, each stroke taking its
  own fill's colour instead of `#4ade80` / `#94a3b8`. The archived node is failing in the **dark** theme (2.93:1 →
  4.37:1): its literal is a copy of the muted token's former value and did not follow when the token moved
- [x] 2.3 Edges — `edgeColor` from `--spek-text-muted` instead of `--spek-border`, `stroke-opacity` 0.6 → 0.85, in
  **both** the initial draw and the hover reset (`SpecGraph.tsx:138` and `:204`). Border cannot carry an edge at any
  opacity: 1.22:1 dark / 1.13:1 light at full strength. 0.85 gives 4.37:1 / 3.81:1; 0.75 would be 3.24:1 light
- [x] 2.4 Legend swatches in `styles.css` — `var(--spek-accent)` / `var(--spek-node-active)` /
  `var(--spek-text-muted)` instead of the three literals
- [x] 2.6 Give node labels a `--spek-bg-primary` halo (`paint-order: stroke`). Found during 5.2: a label crossing
  another node's fill is 1.06–1.84:1, and this change made the light case worse (a spec node's label went 3.91:1 →
  1.48:1) by giving the fills their missing saturation. With the halo a label is read against the page — 7.64:1 dark,
  7.24:1 light — wherever the layout puts it
- [x] 2.5 Leave the hover dimming at 0.1, and leave the `--spek-text-primary` edge highlight alone. The dimming is a
  stated exemption in `graph-view` and `theme-toggle`, not an oversight — a conforming value exists (α ≈ 0.81) but
  no reader would perceive it as dimming

## 3. Timeline stops encoding with opacity

- [x] 3.1 `timeline/TimelineBar.tsx` — drop `fillOpacity` 0.75 / 0.45; status stays carried by fill colour alone
  (active 7.85:1 / 6.47:1, archived 5.52:1 / 5.17:1). The two colours are only 1.42:1 / 1.25:1 apart, so the open
  arrow on the active bar is now carrying more of the distinction — leave it in place
- [x] 3.2 `timeline/TimelineAxis.tsx` — the "today" label loses `fillOpacity` 0.8 (4.39:1 light, under the text
  floor) and the today line loses `strokeOpacity` 0.5 (2.35:1 light). Leave the **grid** lines (`:39` minor at 0.4,
  the major line at full strength) untouched: they are border-coloured decoration, and the dates they help read are
  stated by the axis labels
- [x] 3.3 `styles.css` — replace `.spekui-tooltip-ongoing`'s `opacity: 0.8` with `font-style: italic`. The opacity
  composites the muted colour its parent already sets (4.32:1 dark / 3.68:1 light, and 2.94:1 under the package's
  current default); because the colour is the parent's, removing it alone would delete the distinction rather than
  move it. Italic is the one substitute that costs nothing in contrast — a lighter weight would buy the distinction
  back by dimming the smallest text in the product

## 4. The guard, split where the package cannot see

- [x] 4.1 `packages/ui/src/__tests__/no-colour-literals.test.ts` — assert no hex or `rgb(`/`hsl(` value and no CSS
  named colour appears in `src/**` outside the `:root` block in `styles.css` and `FALLBACKS` in `theme.ts`. It must
  not fire on what is legitimately there: `transparent` in four `color-mix(…, transparent)` declarations and one
  `fill="transparent"` (a colour that renders nothing cannot be theme-wrong), `rgb(0 0 0 / 0.3)` in a box-shadow
  (decide it explicitly — either allow a shadow's black or convert it), and the substring `white` inside
  `white-space: nowrap`, which means named colours match as whole CSS values, never as substrings
- [x] 4.2 `packages/ui/src/__tests__/default-contrast.test.ts` — parse the same `:root` block (do **not** hard-code
  hexes, or 4.1 fires on this file) and assert each default against the package's own surfaces: 4.5:1 where it
  carries text, 3:1 where it carries a graphic. Note the runner globs `src/**/__tests__/*.test.ts`, so a `.test.tsx`
  would be silently skipped
- [x] 4.3 `packages/web/src/styles/contrast.test.ts` — three additions, because none of the eight `--spek-*` names is
  measured today: parse the `:root` mapping block into `--spek-*` → `--color-*`; add a table of `{spekVar, alpha,
  floor}` for what the package draws (node fills and edges 0.85, bars and today marker 1.0); and assert
  `contrast(over(fg, α, surface), surface)` — a fill *over* a background, which is different maths from the existing
  `tints` (text on a tint of itself) and fits neither existing table

## 5. Verification

- [x] 5.1 `npm run build -w @spekjs/ui` first — web imports the built package, so tests run against the previous
  build without it — then `npm run type-check`, `npm run lint`, `npm test`
- [x] 5.2 Look at `/graph` and `/timeline` in **both** themes: node fills and rims, the legend against the nodes it
  explains, edge weight at the new opacity, both bar states side by side (they are close in lightness now), and the
  today marker. If the edges read too heavy, the answer is a thinner stroke width, not a lower opacity
- [x] 5.3 Confirm the un-themed case: render a component with none of the contract properties defined and check it
  draws the package's defaults. It is the one case the package answers for on its own, and the case task 1.1 changes
- [x] 5.4 Rebuild the webview bundles (`npm run build:webview -w @spekjs/web`, `npm run build:intellij`) and confirm
  the new values reach them — this change edits CSS that ships inside both
