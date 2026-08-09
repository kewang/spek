## Context

`MarkdownRenderer` is one component behind four surfaces (Web, the VS Code webview, IntelliJ's JCEF
panel, the static demo). It hands `react-markdown` a `components` map, which is a **node-for-node**
mapping: the `h3` renderer receives an `h3` and knows nothing about what follows it. Nothing in the
current pipeline has a concept of a *section*, so folding cannot be expressed as a component or a class
— the tree has to be regrouped before React sees it.

Two facts found while reading the code narrow the problem more than the proposal assumed:

- `rehypeSpekHeadingIds` assigns ids to **h2 and h3 only**. `#### Scenario:` headings have no id today,
  are not in the TOC, and are not reachable by any link. Folding them therefore cannot break an existing
  anchor.
- `SearchDialog.navigateToResult` navigates to `/specs/<topic>` with **no hash**. Search has never been
  anchor navigation, so it imposes no constraint here. The three real entry points into a heading are a
  TOC click, a `#hash` on load, and VS Code's `spek.navigateTo`.

The reader-facing constraint that remains is find-in-page. There is no in-app find; Ctrl+F is what a
reader uses inside a spec, and collapsed content is invisible to it.

The web test suite is `node --test` over `src/**/*.test.ts` — no jsdom, no `.tsx` tests, no component
tests at all. Existing tests are pure functions (`scrollspy`, `refreshTracker`, `aggregationLevel`,
`artifact-sort`) plus `TaskText.test.ts`, which renders React through `renderToStaticMarkup`. That is
the shape any test for this change has to fit.

## Goals / Non-Goals

**Goals:**

- A spec's first screen shows every Requirement and its normative sentence, with Scenario bodies folded
  away — an outline made of the document itself, not a second pane.
- Expand all / Collapse all, with the choice persisted across specs and sessions.
- Navigating to a heading always reveals it, whatever the fold state.
- Every BDD mark is readable in the light theme, and the spec says so for both themes rather than for
  dark alone.
- One implementation, no per-host code.

**Non-Goals:**

- Folding in any other markdown artifact (proposal, design, tasks) or in the spec diff view.
- Giving `#### Scenario:` an anchor id or a TOC entry — Scenarios stay non-linkable, as today.
- Per-section fold state that survives navigation.
- Any change to the visual treatment — the hues, the pill fills and the dark theme stay as they are.
  A re-tiering was designed and rejected on cost; decision 7 records it and the two findings worth
  keeping.
- The IntelliJ TOC / heading-tree gap.
- The app-wide contrast defects the palette audit surfaced outside spec rendering — error-message red,
  `--color-text-muted`, and the amber link's light-theme ratio (see decision 7).

## Decisions

### 1. Fold with native `<details>` / `<summary>`, not React-controlled visibility

The proposal framed this as the change's biggest fork — `<details>` with `hidden="until-found"` versus
React state — on the grounds that it decides whether Ctrl+F survives. Working it through, **the fork
dissolves, because the options are not comparable**: React state hides content by unmounting it or by
`display: none`, and find-in-page cannot see either. Native `<details>` is the only mechanism that can
*ever* be found in, whether or not a given embedding auto-expands it. There is no trade-off to weigh —
one option dominates.

It also brings, for free, what the other would have had to reimplement: `summary` is focusable,
Enter/Space toggles it, the open/closed state is exposed to assistive technology, and the browser's own
print and find behaviours apply.

**Consequence for the risk register**: if an embedding turned out not to auto-expand on find, the
degradation would be "Ctrl+F misses folded Scenario bodies until the reader clicks Expand all" — one
click, not a dead end. In the event it does auto-expand, so the budgeted degradation never applies (see
Resolved).

### 2. Section the tree in a rehype plugin, beside the existing one

A new `rehypeSpekFoldSections` transforms the hast tree: a heading at a fold level and every node up to
the next heading of that level *or shallower* become one `<details>`, with the heading moved inside a
`<summary>`. h4 sections nest inside their h3 section by construction.

Why the hast layer and not React: it is the only place the sibling run is visible at once, and it makes
the whole of the sectioning a **pure tree-in / tree-out function** — the shape the repo already tests
(`TreeRefreshGate`, `refreshTracker`, `scrollspy` are all pure logic extracted for exactly this reason).

**Plugin order matters**: `rehypeSpekHeadingIds` runs **first**, over the still-flat tree, so its
dedup counter sees precisely the document order it sees today and no id changes. Sectioning runs second.

The heading element keeps its own `id` and stays inside the `<summary>`, so `getElementById`,
`scroll-mt-20` and `useScrollspy`'s `getBoundingClientRect` all keep working unchanged. (`<summary>`
permits a single heading element as its content — this is spec-legal HTML, not a hack.)

Fold levels are **3 and 4**. h2 (`## Purpose`, `## Requirements`, `## ADDED Requirements`) stays a plain
separator: folding it would put the entire document behind one control and defeat the point. Prose
before the first h3 is left unfolded where it is.

### 3. Opt in per call site, not per renderer

`MarkdownRenderer` gains a `foldSections` prop, default off. `SpecDetail` and `SpecsTabContent` pass it;
proposal / design / tasks rendering is untouched by omission rather than by a check somewhere. A change's
delta specs have the same `###`/`####` shape as a main spec, so the Specs tab needs no separate rule.

### 4. Uncontrolled `<details>` + a remount generation for bulk actions

`<details>` is rendered with its initial `open` attribute set from the current mode, and React does not
control it afterwards. Per-section toggling is then entirely the browser's, which is what keeps
find-in-page auto-expansion (and any future platform behaviour) from fighting a controlled `open` prop.

Expand all / Collapse all changes the mode and bumps a generation counter used as a `key` on the
renderer's container, remounting it so every `<details>` picks up its new initial state. Bulk actions are
rare and reader-initiated, so a remount is cheap and its one visible effect — ad-hoc per-section toggles
are discarded — is exactly what the reader just asked for.

Rejected: controlled `open` + `onToggle` per section. It needs state keyed by a synthetic section id for
every Scenario in the document, and it puts React in the middle of the one interaction the browser is
supposed to own.

### 5. Fold mode is a global tri-state in `localStorage`, not per-section state

`spek:spec-fold` holds `default | expanded | collapsed`, read through a `useSpecFold` hook modelled
directly on `useArtifactSort` (same key prefix, same silent fallback when `localStorage` throws in an
embedded host). `default` means h3 open, h4 closed.

Rejected: persisting which individual sections are open. It is unbounded (per spec, per Scenario), and
returning to a spec to find a half-open state from three sessions ago is worse than either extreme.

Not routed through the `ApiAdapter`. That indirection exists for aggregation scope because it maps onto
real VS Code *settings*; a display preference has no settings counterpart, and `useArtifactSort` already
sets the precedent of going straight to `localStorage` on every host.

### 6. Expand-before-scroll walks `<details>` ancestors in the DOM

Before scrolling to an id, open every `<details>` ancestor of the target element. Because the elements
are uncontrolled (decision 4), setting `.open = true` is the sanctioned way to do it — there is no React
state to desynchronise.

This is one helper, called from the single place that already exists for this: `scrollToAnchorId` in
`utils/scrollOffset.ts`, which both hash effects and `SpecToc` already route through. Putting it there
means the TOC, the `#hash` retry loops in `SpecDetail` / `ChangeDetail`, and VS Code's `spek.navigateTo`
are all covered without touching any of them.

The target heading itself is always present and visible — it lives in a `<summary>` — so the existing
"element not found, retry next frame" loop keeps its current meaning.

### 7. Colour: fix the light-theme defect, change nothing else

The visual treatment does not change. The hues, the pill fills, the badges and the entire dark theme
stay as they are; what changes is that each mark's text colour becomes theme-scoped, and the light
theme gets values that are actually readable.

**The defect.** Every BDD colour is a hard-coded Tailwind 400 shade applied identically in both themes.
Against light's `#f8fafc`, **8 of 8 tokens fail WCAG AA and 7 are below even 3:1** (THEN 1.43, ADDED
1.84, AND 1.95, WHEN/GIVEN 1.99, MODIFIED 1.99, SHALL 2.76, inline code 2.91; links 3.04 is the only
one above 3, and still fails). Across all 26 Tailwind v4 families, **no** 400-shade reaches even 3:1 on
that background — this was never going to work, and it passed unnoticed only because dark passes
everywhere.

**Only the text colour needs a token.** The pill fills keep their `/20` alpha, which composites over
whichever page colour is active, so the same class produces the right tint in both themes. That reduces
the change to seven text colours.

| Token | Dark (unchanged) | Light (new) |
|---|---|---|
| `--color-kw-when` (`WHEN` / `GIVEN`) | `#51a2ff` — 5.96 | `#1447e6` — 5.17 |
| `--color-kw-then` (`THEN`) | `#05df72` — 7.98 | `#016630` — 5.74 |
| `--color-kw-and` (`AND`) | `#99a1af` — 6.25 | `#45556c` — 5.66 |
| `--color-kw-normative` (`MUST` / `SHALL`) | `#ff6467` — 6.78 | `#c10007` — 6.14 |
| `--color-badge-added` | `#ff8904` — 6.39 | `#9f2d00` — 5.70 |
| `--color-badge-modified` | `#51a2ff` — 5.96 | `#1447e6` — 5.17 |
| `--color-code-text` | `#f59e0b` — 7.85 | `#92400e` — 6.47 |

Ratios are computed against each mark's own composited background, not against the page. Light values
were chosen as the *lightest* candidate in the same hue family that still clears 4.5:1, so the light
theme stays as close to the dark theme's character as the contrast floor allows.

**A free improvement taken while choosing.** `THEN` (green) against `MUST`/`SHALL` (red) is the classic
deuteranopia confusion pair. Since light values had to be picked anyway, they were picked to widen it:
worst-case ΔE00 across deuteranopia, protanopia and tritanopia is **8.5** in light, against **6.8** in
dark, which is left alone. This cost nothing — it only ruled out some candidates that were equally
valid on contrast.

`--color-code-text` covers both inline code and the spec-topic reference, which are already the same
colour today and distinguished by the reference's dotted underline. Ordinary hyperlinks keep
`--color-accent` and remain below AA in light; that is an app-wide problem, filed as issue #43, and
pulling it in here would change every link in the product.

**Rejected — re-tiering the visual hierarchy.** A full redesign was worked through: drop the pill fills,
neutralise the step keywords, keep one hue on `SHALL`, move inline code off amber. The supporting
evidence is real — arousal tracks saturation rather than hue (Valdez & Mehrabian's regression has no
hue term; Wilms & Oberfeld 2018 find the hue effect vanishes at low saturation), and the ecosystem does
not differentiate the step keywords at all (one TextMate scope, one JetBrains attribute key, colour
delegated to the theme). It was rejected on cost, not on evidence: it is a taste judgement backed by a
single report, and folding already does most of its work, since collapsing Scenario bodies removes the
pills from the default view without any colour changing.

Two findings from that exercise are worth keeping in the record:

- **`THEN` green → violet, which this design originally proposed, is a defect and must not ship.**
  Violet against `WHEN`'s blue is ΔE00 **0.36** under deuteranopia — indistinguishable. It is also a
  hue swap at nearly constant chroma (79.9 → 62.2), so it changes the variable the evidence says is not
  driving the complaint.
- **Neutralising the step keywords to body colour plus weight is close to a no-op.** Specs write these
  keywords as `- **WHEN** …`, so markdown emphasis already bolds them; removing the colour leaves the
  highlight contributing letter-spacing and nothing else, which retires the capability rather than
  re-tiering it. Any future attempt has to add a non-chromatic *shape* — the old pill's visibility came
  from its chroma, not from its 1.2:1 luminance step.

**Also fixed here, because it is the same span**: the keyword `<span>` sets `font-semibold`, which wins
on specificity inside a `<strong>` and silently renders an author's `**SHALL**` *lighter* than the
emphasis around it. The highlight now omits its own weight inside emphasis and inherits instead — every
weight involved is ≤ bold, so inheriting is always correct.

## Risks / Trade-offs

- **Ctrl+F cannot see folded Scenario bodies in an embedding that does not auto-expand on find** →
  Expand all is one click away and its choice persists, so a reader who wants find-first sets it once.
  Decision 1 already picked the only mechanism that can do better than this.
- **Four surfaces move at once, and the narrowest one is where the issue came from** → verify by hand on
  Web, VS Code and IntelliJ before archiving; IntelliJ is the acceptance test, not an afterthought.
- **Light-theme users see their marks change colour** → unavoidable: the current values are unreadable,
  so any fix is visible to exactly the people who could not read them. Dark-theme users see nothing
  change except keywords inside `**bold**`, which stop being rendered lighter than the emphasis around
  them.
- **`markdown-renderer` has a `Dark theme styling` requirement and no light-theme counterpart** → that
  gap is *why* the light palette rotted unnoticed: nothing in the spec ever asserted a light value, so
  nothing could fail. The delta must state contrast obligations for both themes, or the same drift
  recurs the next time a colour is touched.
- **`useScrollspy` under Collapse all** → it measures h2/h3 elements, which are always rendered, so the
  default state is untouched. Collapse all compresses the page enough that a different heading may read
  as active. Check it; do not redesign scrollspy for it.
- **A remount on bulk toggle discards per-section state** → intended (decision 4), but it also resets
  scroll position if the container's height changes under the viewport. Worth a look during
  verification; the fix, if needed, is to preserve the anchor heading, not to abandon the remount.
- **Sectioning is the one part that can silently produce wrong output** → a mis-scoped boundary swallows
  a following Requirement into the previous one, which looks like content loss. This is why the
  transform is pure and directly tested rather than verified by eye.

## Resolved

- **Find-in-page does auto-expand a closed `<details>`.** Checked by hand in the browser: Ctrl+F on a
  string that exists only inside a collapsed scenario finds it and opens the fold. So **no
  `hidden="until-found"` wrapper is needed** — the native element already carries the behaviour, and the
  degradation decision 1 budgeted for does not arise. Feature detection agrees (Chromium 145 reports
  both `beforematch` and `hidden="until-found"`), but the gesture is what was actually tested.
- **The demo inherits folding.** Rebuilt with `NODE_ENV=production` and opened: 27 folds, five
  requirements open, no scenario open, and the light-theme keyword token resolving to `#1447e6`. The
  built file is then reverted rather than committed — `pages.yml` uploads the committed `docs/`
  verbatim, so it would publish ahead of the release.
- **`useScrollspy` survives Collapse all.** Probed at five scroll positions in both states: the active
  TOC entry matched the topmost heading every time. Two measurement traps if this is ever re-run — the
  spy updates inside `requestAnimationFrame`, so a synchronous read after dispatching `scroll` reports
  the previous state; and the fold preference persists, so a previous run leaves the page in whatever
  state it ended in and mislabels the baseline.

- **Both embedded hosts render folding identically to the Web.** Driven over CDP against the real
  panels: the VS Code webview and IntelliJ's JCEF page each reported 27 folds, five requirements open,
  no scenario open, working Expand/Collapse all, the dark token values, and a focusable `summary`.
- **IntelliJ confirms the diagnosis the change was built on.** Its tool window renders at **461×575**,
  and the spec-detail TOC is absent there (`toc: false` — it is gated at 1280px). On the surface issue
  #42 was filed from, folding is the *only* structural affordance available, which is why a TOC was
  never going to answer that report. All five requirement headings now fit on one screen of a 461px
  panel.
