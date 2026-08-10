## Why

`spec-section-folding` made a spec open as an outline instead of a wall of text. The reviewer who asked
for it came back (issue #42) with what the outline then exposed: inside rendered spec content,
prominence runs opposite to structure.

In a change's Specs tab, the spec topic naming the section is the smallest text in it, while
`## ADDED Requirements` — a grouping label repeated once per spec, carrying no content of its own — is
the heaviest thing in the tab's content. The outline is inverted too, though not by nesting: the topic
header is an `h3` rendered as a *sibling* of the `h2`s the markdown emits, so rather than containing
them it is terminated by the first one. The requirements below end up attributed to no topic at all.

And because a folded section's body is not inset from its heading, every level from the topic name down
to a scenario's prose sits on one left edge, leaving type size as the only carrier of hierarchy — the
same axis that is already inverted.

The reporter reached both observations from the rendered page alone, which is the point: hierarchy is
what tells a reader which spec they are looking at when several are stacked in one view.

## What Changes

- **A delta spec's topic outranks the content under it.** The topic name becomes the dominant header of
  its section in the Specs tab, and the document tree stops nesting a heavier heading inside a lighter
  one.
- **The delta operation heading is demoted in place.** `## ADDED Requirements` and its siblings render as
  a small label rather than as the section's loudest element. Demoted *in place*, not merged into the
  topic header: a delta spec may carry several operations at once, and a merged header would be correct
  only for the single-operation case while needing a second layout for the rest.
- **A folded section's body is inset from its heading**, so nesting is reinforced spatially rather than
  by type size alone. Inset is carried by a hairline rule plus a small indent rather than by indent
  alone — indent compounds with nesting depth (requirement → scenario → list) and the narrowest host,
  the IntelliJ tool window, is around 460px wide, where an indent large enough to read as hierarchy
  costs more line width than it returns.
- **The marked vocabulary covers every delta operation, not an arbitrary two.** `REMOVED` and `RENAMED`
  have no entry alongside `ADDED` and `MODIFIED`, so where they appear in prose they render as ordinary
  words. This is completeness of the vocabulary rather than a fix for a visible symptom: keyword marking
  applies to paragraphs, list items and bold runs only, and all five occurrences of these two words in
  this repo's changes are section headings, which no operation is marked in today. A vocabulary with
  holes in it says the unmarked words are ordinary prose, which is the opposite of what an unhandled
  operation is.

No behaviour outside rendering changes: no API, no scan, no stored preference.

## Capabilities

### New Capabilities

None. This change adjusts requirements of three existing capabilities.

### Modified Capabilities

- `change-browsing`: the Specs tab gains a requirement that each delta spec's topic header ranks above
  the content it contains, both visually and in the document outline. Today the capability specifies the
  tab's slug prefixing and folding but says nothing about the topic header's rank.
- `spec-section-folding`: gains a requirement that a folded section's body is inset from its heading.
  The capability currently specifies boundaries, disclosure semantics and default state, but nothing
  about how a section's extent is shown.
- `markdown-renderer`: the existing keyword-highlighting requirement is modified so its badge vocabulary
  covers every delta operation, and a new requirement is added covering spec-shaped typography — that
  the renderer is *told* its content is spec-shaped rather than deducing it, and that under that
  declaration a level-2 heading does not outrank the requirements it groups.

## Impact

**Code** — `packages/web/src/components/SpecsTabContent.tsx` (topic header), `MarkdownRenderer.tsx`
(heading styles, `BDD_KEYWORDS`), `utils/foldSections.ts` and/or `styles/global.css` (body inset; the
transform currently spreads body nodes as direct siblings of `<summary>`, so there is no element to
style), plus new per-theme colour tokens in `global.css`.

**Surfaces** — the renderer is shared, so one fix reaches Web, VS Code and IntelliJ together. No Kotlin
change: IntelliJ renders this content through the same webview bundle.

**Constraints carried from `CLAUDE.md`** — any colour added needs a value in *both* themes and at least
4.5:1 contrast; `--color-badge-*` is the existing family to extend.

**For whoever cuts the release** — user-visible presentation change to spec content on all three
surfaces, worth a CHANGELOG entry; no public API of `@spekjs/core` or `@spekjs/ui` is touched, so
neither package line moves. The README's screenshots show rendered spec content and will need retaking
in the same release, per the release-time rule.
