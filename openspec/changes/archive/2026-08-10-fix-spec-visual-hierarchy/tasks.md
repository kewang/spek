## 1. Spec-shaped typography in the renderer

- [x] 1.1 Add a caller-declared spec-shaped prop to `MarkdownRenderer`, documented as a fact about the document rather than a view state, and explicitly independent of `fold`
- [x] 1.2 Under that prop, render `h2` as a subordinate label — less prominent than the `h3` requirement headings below it but not less prominent than the `h4`s nested within them, and without the full-width bottom rule — leaving the element level and any `id` untouched
- [x] 1.3 Colour the demoted label from a neutral muted token. It is deliberately **not** tinted per operation: reaching the operation would mean matching the heading's text, which this design rejects, and `processChildren` (the keyword highlighter) is not wired to headings at all
- [x] 1.4 Pass the prop from the two spec-shaped call sites (`SpecsTabContent.tsx`, `SpecDetail.tsx`); leave `ChangeDetail.tsx` (proposal/design artifacts) and `SchemaFlow.tsx` (schema step instructions) rendering `h2` as content headings

## 2. Delta operation vocabulary

- [x] 2.1 Add `REMOVED` and `RENAMED` to `BDD_KEYWORDS` in `MarkdownRenderer.tsx`, each with a text colour and the plain `bg-*-500/20` pill fill the existing marks use
- [x] 2.2 Add `--color-badge-removed` and `--color-badge-renamed` to **both** theme blocks in `styles/global.css`, each measured at ≥4.5:1 against its own composited background, and neither reusing `--color-kw-normative`'s red
- [x] 2.3 Leave `ADDED` orange and `MODIFIED` blue as they are — the delta keeps those assignments normative, so this task must not drift them

## 3. Specs tab topic header

- [x] 3.1 Promote the delta spec topic header in `SpecsTabContent.tsx` to the dominant element of its section, at a heading level no deeper than the headings it encloses, so it is no longer outranked and terminated by the first `h2` of its own content

## 4. Section inset

- [x] 4.1 Add a per-theme fold-rule colour token to `global.css` at ≥3:1 against the background — `--color-border` measures 1.4:1 dark and 1.2:1 light and cannot carry a marking the spec now makes normative
- [x] 4.2 Style `details[data-spek-fold][open]` with a small indent plus a hairline left rule in that token, and `details[data-spek-fold][open] > summary` with the matching negative margin. **Both selectors carry `[open]`**: an unscoped margin would pull closed sections' headings a step left of open ones, which the default mode (requirements open, scenarios closed) would show on first render
- [x] 4.3 Confirm the inset applies only at fold boundaries — content outside any section is not inset, and depth stops at requirement → scenario — leaving `foldSections.ts` and its transform tests untouched

## 5. Tests

- [x] 5.1 `MarkdownRenderer`: `h2` is demoted under the spec-shaped prop, renders as a content heading without it, and heading levels and `id`s are identical in both renderings
- [x] 5.2 `MarkdownRenderer`: all four delta operations render a badge, `ADDED` and `MODIFIED` keep their existing hues, each of the four is distinct, and none uses the normative colour
- [x] 5.3 `SpecsTabContent`: the topic header's level is no deeper than the levels of the headings in the rendered spec content
- [x] 5.4 Fold rendering: requirement headings share one left edge whether their section is open or closed — the regression guard for task 4.2's `[open]` scoping

## 6. Verification and gates

- [x] 6.1 Measure, don't eyeball: the fold rule at ≥3:1 and the two new badge colours at ≥4.5:1, in both themes
- [x] 6.2 Verify at ~460px width — the reported case — in both themes, that the bracket reads correctly while toggling via Expand all / Collapse all and no horizontal overflow appears
- [x] 6.3 Rebuild the IntelliJ webview (`npm run build:intellij`) before checking the tool window, so the verification is not reading a stale bundle
- [x] 6.4 `npm run type-check` (build `@spekjs/core` and `@spekjs/ui` first)
- [x] 6.5 `npm run lint`
- [x] 6.6 `npm test`
