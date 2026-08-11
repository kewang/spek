## 1. The display-label rule in core

- [x] 1.1 Add `specHeadingLabel(text: string): string` to `packages/core/src/headings.ts`, taking a heading's text **in full** — elide a leading `Requirement:` / `Scenario:`, matched case-sensitively at the start, removing exactly the keyword, its colon and the spaces or tabs immediately after it
- [x] 1.2 Do not trim the result at either end beyond that. Slicing and trimming closes up the space before a code span, turning `Requirement: The \`foo\` flag` into a heading with the words glued together
- [x] 1.3 Return the input unchanged on any non-match, and when what follows the colon is empty after trimming — evaluated over the whole text, so a heading named after a code span still elides
- [x] 1.4 Export it from `src/index.ts` alongside `extractHeadings` / `slugifyHeading`, so it is reachable both from the package root and from the browser-safe `@spekjs/core/headings` subpath the webview imports
- [x] 1.5 Leave `extractHeadings` untouched — nothing derives `Heading.text` or `Heading.slug` from the label. Document at the function why: the slug feeds every anchor, and a label-derived slug would silently unmake every existing link
- [x] 1.6 Note the new export in `packages/core/README.md` beside the other heading utilities. This one is not release-time: npm only re-reads the README when the package publishes, which is the same push as the version bump, so the file tracks master exactly as `CLAUDE.md` does

## 2. Renderer elision

- [x] 2.1 Add a rehype step to `MarkdownRenderer.tsx` that decides from the heading's **concatenated** text — the same `hastToText` the id plugin already uses — and, when `specHeadingLabel` shortens it, removes exactly that many leading characters from the heading's first text node
- [x] 2.2 Guard the case where those characters do not lie wholly inside that first text node (a heading opening with markup): leave the heading untouched rather than deleting part of the author's structure
- [x] 2.3 Apply it at every heading level, with no level condition. The surfaces do not show the same levels — rendered content shows all of them, `extractHeadings` returns 2 and 3 — so a level gate elides `## Requirement: X` in the sidebar while the content keeps it
- [x] 2.4 Install it **after** `rehypeSpekHeadingIds` and extend that file's existing ordering comment to say why: ids are derived from the heading's text, so eliding first changes every requirement id while `extractHeadings` — parsing the raw markdown for the TOC and the sidebar — keeps producing the authored slug, and the two stop addressing the same anchors
- [x] 2.5 Gate it on the existing `specShaped` prop, not on `fold` and not on any inspection of the content — the capability already requires that spec-shapedness is declared by the caller rather than deduced

## 3. TOC surfaces

- [x] 3.1 Give `SpecToc` a caller-supplied declaration prop mirroring the renderer's, and apply `specHeadingLabel` to the entry label only when it is set. The component is shared with a change's prose artifacts, so deciding inside it would strip a proposal heading that happens to begin `Requirement:`
- [x] 3.2 Pass it from `SpecDetail.tsx` (always spec content)
- [x] 3.3 Pass it from `ChangeDetail.tsx` for the Specs tab only, leaving the proposal / design tabs' TOC labels authored-verbatim
- [x] 3.4 Leave every slug alone, including the Specs tab's `<topic>--` prefixing — the hash a TOC entry links to must not move

## 4. VS Code sidebar

- [x] 4.1 In `tree-provider.ts`, label `SpecHeadingItem` with `specHeadingLabel(heading.text)` while leaving `this.tooltip = heading.text` and the `spek.navigateTo` argument (built from `heading.slug`) exactly as they are

## 5. Section extent mark

- [x] 5.1 Confirm the mechanism in the running app before changing anything: the section's first heading margin is contained because `MarkdownRenderer.tsx`'s `<summary>` is a flex container, not because of the `padding-left` / `border-left` pair. Check in devtools — task 5.3 is only correct while that holds
- [x] 5.2 Scope the `border-left` on `details[data-spek-fold][open]` to the outermost open section — expressed as *a fold inside another fold draws no rule*, not as a match on `data-spek-fold="4"`, since which levels fold is passed in by the caller. Keep `padding-left` on nested sections so depth still reads from position
- [x] 5.3 Separate sibling sections with block spacing on the fold element itself, so the mark ends where the section does
- [x] 5.4 If that spacing has to be traded against the heading's existing top margin, do it in a rule scoped to a fold's own summary — **not** by changing `h3`'s className, which is shared by every rendered document in the app and would re-space every proposal, design and diff along with it
- [x] 5.5 Check the result in both states: opening and closing a scenario must not move the requirement sections around it
- [x] 5.6 Update the two CSS-shape assertions in `MarkdownRenderer.hierarchy.test.ts` (the `[open]`-scoping guard and the fold-rule-colour guard) to match the new rule shape, **preserving what each one protects**: that the inset and the summary offset stay `[open]`-scoped, and that the extent rule uses `--color-fold-rule` rather than the panel border. They read `global.css` as text and match the *first* rule of each shape, so several plausible ways of writing tasks 5.2/5.3 turn them red for reasons unrelated to what changed — relaxing a regex there deletes a guard `fix-spec-visual-hierarchy` put in deliberately
- [x] 5.7 Leave `foldSections.ts` and its transform tests untouched — this is styling, and that transform is the one piece of folding that can silently lose content

## 6. Tests

- [x] 6.1 `packages/core`: `specHeadingLabel` over the spec's cases — both keywords elided, no-keyword text unchanged, keyword-only and keyword-plus-whitespace unchanged, case variant unchanged, keyword not at the start unchanged
- [x] 6.2 `packages/core`: the two shapes the review caught — a name beginning with a code span elides, and a trailing space survives (`"Requirement: The "` → `"The "`)
- [x] 6.3 `packages/core`: `extractHeadings` still returns `text` and `slug` carrying the keyword, as the guard that the label was not wired into extraction
- [x] 6.4 `MarkdownRenderer`: under `specShaped`, `### Requirement: Foo` renders as `Foo` **and** keeps the id `requirement-foo` — the regression guard for task 2.4's ordering
- [x] 6.5 `MarkdownRenderer`: a heading from this repo's own `ui-package` spec (``### Requirement: `@spekjs/ui` package exports …``) renders elided with its code span and the space before it intact — the end-to-end guard for tasks 2.1/2.2
- [x] 6.6 `MarkdownRenderer`: without `specShaped` the same heading renders verbatim; `## ADDED Requirements` and `## Purpose` are unaffected in both renderings
- [x] 6.7 `SpecToc`: entries elide under the declaration and render authored text without it
- [x] 6.8 Record in the change what tests do not reach: the *layout* in group 5 (jsdom measures nothing, so 5.6 guards the rules' shape and only the eye confirms the spacing) and the VS Code tree (that package has no test setup). Both are verified by hand in group 7

## 7. Verification and gates

- [x] 7.1 Build `@spekjs/core` before running the web tests — the web package imports core's `dist`, so an unbuilt change passes against the previous build
- [x] 7.2 Verify at ~460px in both themes, since the report came from the IntelliJ tool window: headings read without their keyword, the mark brackets one requirement at a time, and Expand all / Collapse all leaves the layout stable
- [x] 7.3 Open this repo's own `/specs/ui-package` — it holds the only two headings whose name begins with a code span — and confirm the content and the TOC agree on what those headings are called
- [x] 7.4 Rebuild the IntelliJ webview (`npm run build:intellij`) before checking the tool window, so the check is not reading a stale bundle
- [x] 7.5 Rebuild the VS Code webview (`npm run build:webview`) before checking the sidebar, for the same reason — the bundle in `packages/vscode/webview/` is gitignored and whatever is on disk may predate this change
- [x] 7.6 Check the VS Code sidebar in an Extension Development Host: heading labels elided, tooltips authored, clicking a heading still lands on it
- [x] 7.7 Follow a deep link minted before this change (`/specs/<topic>#requirement-<slug>`) and confirm it still resolves — the single failure this change could cause silently
- [x] 7.8 `npm run type-check` (build `@spekjs/core` and `@spekjs/ui` first)
- [x] 7.9 `npm run lint`
- [x] 7.10 `npm test`
