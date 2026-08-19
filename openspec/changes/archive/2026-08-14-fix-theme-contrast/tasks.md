## 1. Palette tokens

- [x] 1.1 Add `--color-status-error` / `--color-status-success` / `--color-status-warning` to `@theme` in
  `packages/web/src/styles/global.css` with the dark values `#ff6467` / `#05df72` / `#ffb900` (the shades the
  hard-coded classes already named), with a comment stating what each value was measured against
- [x] 1.2 Re-author the dark `--color-text-muted` from `#64748b` to `#8595aa` — the one dark token measured failing
  (3.54:1 on `bg-tertiary`), noting the value is bounded below by its use on `bg-text-muted/10`
- [x] 1.3 Add the light values in the `[data-theme="light"]` block: status `#c10007` / `#016630` / `#bb4d00`,
  `--color-text-muted: #576882`, `--color-accent: #92400e`, `--color-accent-hover: #7b3306`, with a comment recording
  that the accent's binding constraint is `bg-accent/20`, not plain link text

## 2. Replace the hard-coded palette classes

- [x] 2.1 `components/SpecDiffViewer.tsx` — the `--- ` / `+++ ` labels and the added/removed row text to
  `text-status-error` / `text-status-success`, and the row fills to `bg-status-error/10` / `bg-status-success/10` so
  the tint and the text on it come from one value
- [x] 2.2 The ten `Error: {error}` lines to `text-status-error` — `pages/SpecDetail.tsx` (×2), `SchemaList.tsx`,
  `SchemaDetail.tsx`, `TimelinePage.tsx`, `GraphView.tsx`, `Dashboard.tsx`, `ChangeList.tsx`, `ChangeDetail.tsx`,
  `SpecList.tsx`
- [x] 2.3 `pages/SelectRepo.tsx` — "OpenSpec detected" and the tick icon to `text-status-success`, "No openspec/
  directory found" to `text-status-warning` (it was `text-yellow-400`, the only one), the two error paragraphs and
  the cross icon to `text-status-error`, and `hover:text-red-400` on the remove button to `hover:text-status-error`
- [x] 2.4 `pages/SpecDetail.tsx` — the timeline's active status pill (`bg-green-400/10 text-green-400`) to the
  success token
- [x] 2.5 `pages/ChangeList.tsx` — the jj "conflicts with" badge text and its `/40` border to
  `text-status-warning` / `border-status-warning/40`
- [x] 2.6 `components/Sidebar.tsx` — the offline notice to `text-status-warning`, dropping the `/90` alpha that was
  lowering an already-failing value
- [x] 2.7 `pages/ChangeDetail.tsx` — the completed-task checkmark icon to `text-status-success`

## 3. The two failures no token replacement covers

- [x] 3.1 `components/TaskProgress.tsx` — the complete state's `bg-green-500` to `bg-status-success` (2.02:1 against
  its track in the light theme, under the 3:1 a graphical object needs)
- [x] 3.2 `pages/ChangeDetail.tsx` — remove `opacity-60` from the task row and change the completed text from
  `text-text-secondary` to `text-text-muted`, keeping the strikethrough and the icon; nothing in that row passed in
  either theme while the opacity was applied to it

## 4. The regression guard

- [x] 4.1 `packages/web/src/styles/contrast.test.ts` — parse `global.css` into the dark map (`@theme`) and the light
  map (`[data-theme="light"]` layered over it), with the sRGB contrast maths kept in the test
- [x] 4.2 Assert the declared table: every text token against each of its theme's three surfaces, plus each token
  against its own tint at the alphas actually used — accent `/10` `/15` `/20`, success `/10`, error `/10`,
  muted `/10` — in both themes
- [x] 4.3 Assert that no `text-<family>-<shade>` class (including `hover:` / `focus:` / `group-hover:` variants)
  appears anywhere under `packages/web/src`, leaving the pill fills legal
- [x] 4.4 Assert that every `bg-<token>/<alpha>` literal found in the source has an entry in 4.2's table, scoped by
  an allowlist of the **text** tokens (the table's own row keys), so a new tinted usage cannot slip in unmeasured
  without failing on the 11 literals that must never be in it — the two `bg-black/*` scrims, the three
  surface-on-surface alphas, and the eight BDD pill fills
- [x] 4.5 Assert that no bare `opacity-<n>` class appears under `packages/web/src`, allowing `disabled:`-prefixed
  ones — after 3.2 there is exactly one left and it is `disabled:opacity-50`

## 5. Verification

- [x] 5.1 `npm run type-check`, `npm run lint`, `npm test`
- [x] 5.2 Look at the light theme in the browser (`npm run dev`): spec diff, an error state, the changes list, the
  Tasks tab with completed tasks, and the `/graph` + `/timeline` pages, which inherit `--spek-text-muted` /
  `--spek-accent` from these tokens with no package change
- [x] 5.3 Rebuild both webview bundles (`npm run build:webview -w @spekjs/web`, `npm run build:intellij`) and confirm
  the new token values reach them. Looking at the real VS Code webview and IntelliJ tool window was **deliberately
  skipped** — see the design's Risks for what that leaves unverified
