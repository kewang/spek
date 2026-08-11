## Why

`fix-spec-visual-hierarchy` shipped in v1.12.0 and the reporter came back a third time (issue #42) with
what the corrected hierarchy exposed. Both observations are about the same thing: chrome that was
carrying structure before the structure itself was visible, and is now repeating it.

**The format keyword is repeated once per heading and says nothing.** Every requirement heading opens
with `Requirement:` and every scenario with `Scenario:`. Inside `## ADDED Requirements` every level-3
heading *is* a requirement and every level-4 heading inside one *is* a scenario, so the keyword restates
what position already establishes — for the whole column of headings a reader scans. It is removable only
now: before v1.12.0 the operation heading was typeset as the section's quietest element, so the prefix
was the only thing naming what these sections were. The cost is largest exactly where the reporter is
reading, an IntelliJ tool window a few hundred pixels wide, where twelve characters of boilerplate are
taken off the front of every heading and the distinguishing part is what gets truncated.

**The extent rule does not mark an extent.** `spec-section-folding` requires an open section's vertical
extent to be marked so a reader can see where it ends. In practice consecutive open requirements draw
rules that meet, forming one unbroken line down the entire operation section — so the mark brackets the
page rather than the requirement, which is the one thing it exists to do. And an open scenario draws its
own rule parallel to its requirement's at the same weight, which reads as a single ornament repeated
rather than as two nested brackets; the reporter's words were "a little noisy/duplicitous".

## What Changes

- **Spec-shaped content renders requirement and scenario headings without the format keyword.**
  `### Requirement: Single YAML manifest as source of truth` renders as *Single YAML manifest as source
  of truth*. Presentation only: the heading element, its level and its `id` are untouched, because level
  decides where a folded section ends and the `id` is an addressable anchor that deep links, the
  scrollspy and the TOC all resolve against.
- **The rule is applied wherever heading text is displayed, and stated once.** Rendered content, the
  spec-detail TOC, the change-detail Specs-tab TOC and the VS Code sidebar's spec headings all show the
  same text. Restating it per host is how the two components end up disagreeing — which is the shape of
  complaint this issue has already produced twice — so it is one function exported from core rather than
  a regex per surface.
- **Stripping is conservative by construction.** It applies only under the existing spec-shaped
  declaration, only to the keyword OpenSpec's format defines, and never when it would leave a heading
  with no text of its own.
- **An extent rule is drawn only by the outermost open section.** A nested open section keeps its inset —
  depth still reads from position — but draws no second rule; its extent is bounded by the requirement
  rule already containing it.
- **Adjacent open sections are separated, so the rule breaks at every requirement boundary.** A mark that
  spans the boundary it should be marking is worse than none: it asserts that everything under it is one
  section.

Deliberately unchanged:

- **Search result excerpts and the spec diff view.** Both quote file text — the diff view prints raw
  lines in a `<pre>` — and the file does contain the keyword. A diff that elided it would no longer be a
  diff of the file.
- **The TOC's ranking of the operation heading above the requirements** — the known gap recorded when
  v1.12.0 shipped. Same complaint, one component over; still navigation chrome rather than rendered spec
  content, and still out of scope here.
- **The authored format.** spek is a read-only viewer: `### Requirement:` remains what OpenSpec requires
  and what the file holds. The trade-off accepted is that the keyword is no longer learnable by reading a
  rendered spec in spek, and that copying a rendered heading yields the title without it.

No API, scan, or stored-preference behaviour changes.

## Capabilities

### New Capabilities

None. This change modifies requirements of six existing capabilities.

### Modified Capabilities

- `core-module`: the heading utilities gain a companion that returns a heading's *display* text, stated
  as strictly separate from `text` and `slug` — those are identity and stay verbatim. The capability
  currently specifies extraction and slugification only, so there is no place a host is told that
  display text is a distinct thing.
- `markdown-renderer`: a **new** requirement covering the keyword elision — under the spec-shaped
  declaration, and only there, requirement and scenario headings render without their format keyword
  while their element, level and `id` stay as authored. Deliberately its own requirement rather than an
  edit to the spec-shaped typography one: that requirement is about prominence, this is about content,
  and folding them together would put the elision two paragraphs from the sentence forbidding the
  renderer to *decide spec-shapedness* by matching text — a proximity that invites the wrong reading.
- `spec-section-folding`: the extent-mark requirement is modified. Today it requires every open section
  to mark its extent, which is what produces both the doubled rule and the rule that runs across
  requirement boundaries. It becomes: the outermost open section marks its extent, a nested one insets
  without marking, and sections that are siblings are separated so the mark ends where the section does.
- `spec-browsing`: the spec-detail TOC gains a requirement that its entries show the same text as the
  content they point at, while continuing to navigate by the unchanged slug.
- `change-browsing`: the same for the change-detail TOC over a delta spec's headings, where the slug is
  additionally topic-prefixed and stays so.
- `vscode-sidebar`: the same for the Specs TreeView's heading children.

## Impact

**Code** — `packages/core/src/headings.ts` and its `@spekjs/core/headings` subpath export (+ tests);
`packages/web/src/components/MarkdownRenderer.tsx` (the elision belongs in the rehype step, beside the
heading-id and fold plugins, where it operates on text nodes rather than on React children);
`packages/web/src/components/SpecToc.tsx` (where a TOC entry's label is actually rendered) with the
declaration passed from `packages/web/src/pages/SpecDetail.tsx` and `ChangeDetail.tsx`;
`packages/web/src/styles/global.css` (the `details[data-spek-fold][open]` rules);
`packages/vscode/src/tree-provider.ts`.

**Surfaces** — the renderer is shared, so the content change reaches Web, VS Code and IntelliJ together,
and the demo page and the GitHub Action's HTML snapshot inherit it by bundling the same SPA. That is
correct, and `docs/demo.html` still must not be rebuilt here: it is published as committed, so a rebuilt
demo would put an unreleased change on the live page. It moves at release time.
**No Kotlin change**: the IntelliJ tool window loads the same SPA, and its Kotlin tree lists specs and
changes without heading children, so this rule is not mirrored into a second language. (The
`intellij-tree-view` capability's overview sentence claims heading children that the implementation does
not have — a pre-existing documentation defect, noted here, not fixed here.)

**Verification** — the abutting rule is reported from a real render and needs confirming in the app
before it is fixed, not deduced from the stylesheet: `<details>` carries no top or bottom border here, so
whether adjacent sections already collapse a margin between them decides whether the fix is spacing or
something else. It must be checked in the IntelliJ tool window as well as a browser, since that is the
width the report came from.

**For whoever cuts the release** — a new export on `@spekjs/core/headings` is additive, so core's line
takes a **minor** bump, not a patch. The product line gets a user-visible presentation change to spec
content on all three surfaces. The README's screenshots show rendered spec headings and will need
retaking in the same release, per the release-time rule.
