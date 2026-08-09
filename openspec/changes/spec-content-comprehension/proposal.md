## Why

A spec renders as one undifferentiated wall. Every Requirement's prose and every Scenario's WHEN/THEN
bullets are on screen at once. Issue #42 reports this from the IntelliJ plugin: "you are asked to read
all these fine details, but you don't even really know the shape of the thing first."

- **Everything is disclosed at once.** The reader cannot see the document's shape before its detail.
  Measured over this repo's own `openspec/specs/`, Scenario blocks are **59%** of the character volume
  (2.8 Scenarios per Requirement) — the majority of the page is detail the first-time reader has no
  frame for yet.

Investigating the same report's aside that "the colours are distracting" turned up a separate and more
serious problem that has nothing to do with anyone's taste:

- **Every BDD mark fails contrast in the light theme.** The colours are hard-coded Tailwind 400 shades
  applied identically to both themes. Against light's `#f8fafc`, all 8 of them fail WCAG AA and 7 are
  below even 3:1 — `THEN` sits at **1.43:1**. This is not a near miss: across all 26 Tailwind v4
  families, no 400-shade reaches even 3:1 on that background. It went unnoticed because the dark theme
  passes everywhere and hides it, and because the `markdown-renderer` spec states obligations for the
  dark theme only, so nothing could ever fail.

The reported complaint about colour is **not** addressed by this change, deliberately — see below.

**A table of contents is not the answer to either.** One already exists — `/specs/:topic` renders a
sticky h2/h3 TOC, and the change Specs tab has one too — and it does not address this report, because a
TOC is a *parallel* index: it tells the reader where they are, not what the document is, and reading it
means leaving the content. It also never appears on the surface the issue was filed against: the TOC is
gated at `xl` (≥1280px) and an IntelliJ tool window is not that wide. Making it visible there is a real
gap against VS Code (whose sidebar does expand specs into headings) but it is a **separate change**, and
it would not have satisfied this report.

What this change deliberately does **not** fix: the reporter's worst example is a single paragraph
holding five rules in four sentences. No disclosure scheme helps one paragraph — that is the spec
author's prose, and a viewer must not reflow an author's content into something the repo does not
contain. The reporter says as much ("you can't rewrite the text.. but you can own the rendering").

Nor is the visual hierarchy redesigned. A full re-tiering was designed and rejected on cost: it is a
taste judgement supported by exactly one report, and folding already does most of its work — with
Scenario bodies collapsed by default, the pills largely disappear from the first screen without any
colour changing. The hues, the pill fills and the dark theme therefore stay exactly as they are; only
the light theme's unreadable values are corrected.

## What Changes

- **Fold spec-shaped content in place.** `### Requirement:` renders expanded — heading *and* its lead
  SHALL paragraph — while each `#### Scenario:` renders as a visible heading with its body collapsed.
  The first screen therefore becomes a contents page **with substance**: every Requirement and what it
  requires, with ~59% of the volume folded away. This is in-place progressive disclosure, not a second
  navigation pane; the outline *is* the document.
- **Expand all / Collapse all**, with the reader's choice persisted in `localStorage` (the existing
  `spek:artifact-sort` preference is the precedent).
- **Programmatic navigation to a heading must expand its enclosing sections before scrolling.** Three
  entry points: a TOC click (`SpecToc`), a `#hash` present on load (the retry loops in `SpecDetail` and
  `ChangeDetail`), and VS Code's `spek.navigateTo` with a hash. Today's hash targets are h2/h3 only, and
  those stay visible in the default state — but Collapse all and the persisted preference can hide a
  Requirement's body, so arriving at a heading whose content is folded is reachable and must not
  silently show nothing.
- **Applies only to spec-shaped content**: the spec detail page and the change Specs tab. `MarkdownRenderer`
  is shared with proposal / design / other markdown artifacts, so folding is opt-in per call site rather
  than a property of the renderer.
- **Give the BDD marks theme-scoped colours.** Each mark's text colour moves into a `--color-kw-*` /
  `--color-badge-*` / `--color-code-text` token. Dark keeps its current values byte for byte; light gets
  values in the same hue families that clear AA (5.17–6.47:1). The pill fills need no token at all —
  their `/20` alpha already composites over whichever page colour is active.
- **Stop the highlight lowering the author's font weight.** A keyword inside `**bold**` currently
  renders at `font-semibold`, so the emphasised word comes out *lighter* than the emphasis around it.

Not in scope, stated so the boundary is explicit: the hues, the pill fills and the whole dark theme are
unchanged; the TOC stays h2/h3 (890 Scenario headings would swamp it); `#### Scenario:` gains no anchor
id, so Scenarios remain non-linkable exactly as today; the app-wide contrast defects the audit also
surfaced are filed as issue #43; and the IntelliJ TOC / heading-tree gap is left to its own change.

## Capabilities

### New Capabilities

- `spec-section-folding`: in-place progressive disclosure for spec-shaped markdown — which heading
  levels fold and which are open by default, that a folded Scenario keeps its heading visible as the
  fold's handle, the Expand all / Collapse all controls and the persistence of that choice, the
  obligation that any programmatic navigation to a heading expands whatever encloses it before
  scrolling, and the restriction that folding applies to spec content only and never to a change's
  other artifacts.

### Modified Capabilities

- `markdown-renderer`: **BDD keyword highlighting** keeps every existing scenario verbatim — the visual
  treatment does not change — and gains one obligation: the highlight must not reduce the font weight
  the surrounding markup already applies. A new requirement states the contrast obligation for *both*
  themes, closing the gap that let the light values rot: the capability currently specifies
  **Dark theme styling** and has no light counterpart, so no light value was ever asserted and none
  could fail.
- `spec-browsing`: **Spec detail display** — spec content renders folded by default. (Its wording still
  says the raw markdown is shown with "react-markdown rendering deferred to Phase 3", which has been
  false for a long time; the delta corrects it while rewriting the requirement.)
- `change-browsing`: the Specs tab renders its delta specs folded on the same rules as the spec detail
  page, so a change's specs and the specs they modify read identically.

## Impact

- **Modified**: `packages/web/src/components/MarkdownRenderer.tsx` (the substance of the change),
  `styles/global.css` (the new colour tokens), `SpecsTabContent.tsx`, `SpecToc.tsx`
  (expand-then-scroll), `pages/SpecDetail.tsx` and `pages/ChangeDetail.tsx` (the hash retry effects),
  plus a new fold-state hook and its persistence helper alongside the existing preference utilities.
- **The renderer change is structural, not cosmetic.** `react-markdown` maps nodes one-for-one and has
  no notion of a section; the component list in `MarkdownRenderer` sees an `h3` with no idea what
  follows it. Folding requires regrouping a flat node sequence into a section tree — an h3 owns
  everything until the next h3, an h4 everything until the next h4-or-higher — which is the main
  implementation risk and the reason this is one change rather than a CSS tweak.
- **All four surfaces move together**: Web, the VS Code webview, IntelliJ's JCEF panel and the static
  demo all render through this one component, so there is no per-host code — but each needs to be
  looked at, and IntelliJ especially, since it is both the narrowest viewport and the reporting surface.
- **Docs**: `CLAUDE.md` and `docs/prd.md` describe master's implementation and move with this change.
  The READMEs do **not**: they describe what an installed build has, so folding reaches them at release
  time along with the CHANGELOG and the retaken screenshots. Their colour enumerations stay correct
  either way — the hue names do not change.
- **Not affected**: `@spekjs/core`, `@spekjs/ui`, every API endpoint, the Kotlin scan/read logic, and the
  badge generator. No published package's contract changes, so neither npm version line moves.
- **Open question for design, and the biggest fork in the change**: whether native `<details>` /
  `<summary>` (with `hidden="until-found"`) delivers browser find-in-page auto-expansion consistently
  across Chromium in all three embeddings, or whether the fold must be React state with an explicit
  expand-on-find path. It decides whether Ctrl+F stays usable while content is collapsed — the single
  behaviour a read-only viewer can least afford to lose — and it must be verified against the actual
  embeddings, not assumed from the platform's documentation.
- **Risk to watch**: `useScrollspy` measures h2/h3 elements that stay in the DOM, so the default state
  leaves it untouched — but Collapse all shortens the page enough to change which heading it reports as
  active. That needs checking, not redesigning.
