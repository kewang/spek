## 1. Light-theme contrast fix

Independent of folding, no visual change in dark, so it goes first and can be verified on its own.
The visual treatment does not change — hues, pill fills and badges all stay.

- [x] 1.1 Add `--color-kw-when` `#51a2ff`, `--color-kw-then` `#05df72`, `--color-kw-and` `#99a1af`, `--color-kw-normative` `#ff6467`, `--color-badge-added` `#ff8904`, `--color-badge-modified` `#51a2ff` and `--color-code-text` `#f59e0b` to the `@theme` block in `packages/web/src/styles/global.css` — the dark values are exactly what ships today
- [x] 1.2 Add the light overrides in the `[data-theme="light"]` block: `#1447e6` / `#016630` / `#45556c` / `#c10007` / `#9f2d00` / `#1447e6` / `#92400e`
- [x] 1.3 Point `BDD_KEYWORDS` in `packages/web/src/components/MarkdownRenderer.tsx` at those tokens, leaving the `bg-*-500/20` fills, padding, rounding and text sizes untouched — the fills composite over each theme's page on their own and need no token
- [x] 1.4 Move the keyword font weights out of `BDD_KEYWORDS` into a separate map, and suppress them inside `<strong>` so a keyword in `**bold**` inherits bold instead of being rendered lighter
- [x] 1.5 Point inline code and the spec-topic reference at `--color-code-text`; ordinary hyperlinks keep `--color-accent` (issue #43)

## 2. Section transform

- [x] 2.1 Add a `rehypeSpekFoldSections` plugin beside `rehypeSpekHeadingIds` that groups the hast tree into sections at heading levels 3 and 4, emitting `<details>` with the heading moved inside a `<summary>`
- [x] 2.2 Implement the boundary rule: a section holds every node up to the next heading of the same level or shallower; level-4 sections nest inside their level-3 section
- [x] 2.3 Handle the edge cases the spec names — a document with no `###`/`####`, a `####` before any `###`, and content preceding the first `###`
- [x] 2.4 Register the plugin **after** `rehypeSpekHeadingIds` so heading ids are assigned over the still-flat tree and stay byte-identical to today

## 3. Renderer wiring

- [x] 3.1 Add a `foldSections` prop to `MarkdownRenderer`, default off, gating the new plugin
- [x] 3.2 Add `details` / `summary` entries to the `components` map: fold handle styling, disclosure marker, and heading styles preserved inside the summary
- [x] 3.3 Set each `<details>` initial `open` attribute from the current fold mode and leave it uncontrolled thereafter

## 4. Fold state, controls and persistence

- [x] 4.1 Add a `useSpecFold` hook backed by `localStorage["spek:spec-fold"]` holding `default | expanded | collapsed`, modelled on `useArtifactSort` including its silent fallback when storage throws
- [x] 4.2 Add the Expand all / Collapse all control
- [x] 4.3 Bump a generation counter used as the renderer container's `key` on a bulk action, so every `<details>` remounts with its new initial state

## 5. Navigation reveal

- [x] 5.1 Add a helper that opens every `<details>` ancestor of a target element, and call it from `scrollToAnchorId` in `packages/web/src/utils/scrollOffset.ts` before scrolling — this covers the TOC, both hash retry effects and the VS Code navigate command in one place

## 6. Call sites

- [x] 6.1 `packages/web/src/pages/SpecDetail.tsx` — pass `foldSections` and render the bulk controls
- [x] 6.2 `packages/web/src/components/SpecsTabContent.tsx` — pass `foldSections`; surface the bulk controls on the Specs tab only, in `packages/web/src/pages/ChangeDetail.tsx`
- [x] 6.3 Confirm the spec diff view still renders unfolded

## 7. Tests

- [x] 7.1 Pure tests for the section transform: nesting, both boundary cases, no-headings, `####` before `###`, content before the first `###`
- [x] 7.2 `renderToStaticMarkup` tests in the style of `TaskText.test.ts` — folding on produces `<details>`/`<summary>` with the heading and its id intact inside the summary; folding off produces markup identical to today
- [x] 7.3 Tests for the fold-mode read/write/fallback logic, in the style of `artifact-sort.test.ts`

## 8. Docs

- [x] 8.1 Add folding to `CLAUDE.md` (Key Design Decisions), and note there that the BDD colours are now theme-scoped tokens rather than hard-coded palette classes — the hue names in that line stay correct
- [x] 8.2 Add folding to the feature descriptions in `docs/prd.md`
- [x] 8.3 Correct `CLAUDE.md`'s archive step, which listed the READMEs among the docs a change updates

The READMEs and the `screenshots/` they reference are deliberately **not** listed here. They describe
what an installed build actually has, so they move with the CHANGELOG and the version bump at release
time. A caption changed without its image retaken leaves the README contradicting itself.

## 9. Cross-surface verification

- [x] 9.0 Light and dark spec rendering after the contrast fix, captured side by side against the previous build
- [x] 9.1 Web, both themes: folding, bulk controls, persistence across navigation and reload, TOC and hash navigation into collapsed sections
- [x] 9.2 VS Code webview — driven through the extension's own panel over CDP: 27 folds, 5 requirements open, 0 scenarios open, Expand/Collapse all working (0 ↔ 27), dark token values, `summary` focusable
- [x] 9.3 IntelliJ tool window — the surface the issue was filed against, and the narrowest viewport; treat this as the acceptance test. Verified in a sandbox IDE at a **461×575** viewport: same 27/5/0 counts, controls working, all five requirement headings on one screen. Confirms the TOC never appears there (`toc: false`, it needs ≥1280px), so folding is the only structural affordance that surface has
- [x] 9.4 Rebuild the demo with `NODE_ENV=production` and confirm it inherits folding and the new colours — then **revert `docs/demo.html`**: `pages.yml` uploads the committed `docs/` verbatim, so committing it would publish the unreleased feature to the live demo
- [x] 9.5 Resolve the design's open question: find-in-page **does** auto-expand a closed `<details>` — confirmed by hand with the Ctrl+F gesture. No `hidden="until-found"` wrapper is needed
- [x] 9.6 Check `useScrollspy` under Collapse all, where the compressed page can change which heading reads as active

## 10. Gates

- [x] 10.1 `npm run type-check`
- [x] 10.2 `npm run lint`
- [x] 10.3 `npm test`
