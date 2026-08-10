## Context

`MarkdownRenderer` is shared by every artifact spek displays: a spec, a change's delta specs, a
proposal, a design, a tasks list, and the diff view. It applies one set of heading styles to all of
them. That is fine for `h3`/`h4`, which mean the same thing everywhere, but not for `h2`: in a
**spec-shaped** document every `h2` is a structural separator (`## Purpose`, `## Requirements`,
`## ADDED Requirements`), while in a proposal or design document `h2` carries the actual content
headings (`## Why`, `## What Changes`, `## Decisions`). One style cannot serve both, and the style
currently chosen — `text-xl font-bold` with a full-width bottom rule — is the right one for the second
group and the reason the first group reads inverted.

The Specs tab compounds it. `SpecsTabContent` supplies its own topic header as chrome around each
rendered spec, at `text-sm` in an `h3` element, so the container is both lighter and deeper in the
outline than the `h2` the markdown emits inside it.

Folding, shipped in the previous change, made both problems visible rather than causing them: an
outline is where ranking is read.

## Goals / Non-Goals

**Goals:**

- Prominence in rendered spec content matches structure: the spec topic is the heaviest element in its
  section, the delta operation label the lightest of the structural elements.
- A folded section's extent is legible spatially, at a horizontal cost a ~460px tool window can pay.
- Every delta operation is marked, not an arbitrary two of them.

**Non-Goals:**

- Changing the heading *levels* the markdown emits. `rehypeSpekHeadingIds`, `extractHeadings` and
  `slugifyHeading` form a contract over `h2`/`h3` that the TOC, URL hashes and the VS Code sidebar tree
  all consume. Re-levelling to make the outline nest perfectly would break anchors that are specified
  behaviour, to fix a defect that is presentational.
- Re-tiering the BDD keyword emphasis. Declined once already in issue #42 for stated reasons, and
  unchanged by this report.
- Any change to scanning, the API, or persisted preferences.

## Decisions

### 1. Spec typography is a caller-declared variant, not inferred from content or borrowed from `fold`

`MarkdownRenderer` gains an explicit prop declaring that its content is spec-shaped; the `h2` demotion
applies only under it.

*Why not infer from the text* (matching `/^(ADDED|MODIFIED|REMOVED|RENAMED) Requirements$/`): the
established grain in this renderer is the opposite. `spec-section-folding` states that folding "SHALL be
requested by the caller rather than inferred from the content", for the same reason — content sniffing
makes rendering depend on wording that authors control.

*Why not reuse the existing `fold` prop.* Today it would work: of the four call sites, `fold` is passed
at exactly the two spec-shaped ones (spec detail, delta specs) and omitted at the two that are not
(a change's markdown artifacts, a schema step's instruction), and `foldOptionsFor` always returns an
object, so the correlation is total. It is rejected on what the two props *mean*, not on current
behaviour: `fold` carries a **user-toggleable view state**, driven by `FoldControls` and persisted per
reader, while spec-shapedness is a **fact about the document** the reader has no say in. Tying the
second to the first means any future mode expressing "do not fold" restyles the headings as a side
effect — a document silently changing its typography because of a display preference, found long after
the preference was added.

The diff view is worth naming because it is *not* the counterexample it appears to be: it renders a
line-based textual diff (`SpecDiffViewer`, via `diffLines`) and never passes through this renderer at
all, so it takes neither prop and is unaffected either way.

### 2. The operation heading is demoted in place, and keeps its heading element

It renders as a small uppercase label using the operation's own badge colour, without the bottom rule.
It stays an `h2` element: it holds a heading id, and the fold transform's boundary rule ("up to the next
heading of the same level or shallower") reads heading levels off the tree. Demoting it to a paragraph
would silently change where sections end — the one class of failure that capability calls out as
reading like content loss rather than a layout bug.

Merging it into the topic header instead was rejected in the proposal: a delta spec may carry several
operations at once, and this repo's own changes contain all four kinds.

### 3. The section inset is CSS on `details`, not a wrapper element in the transform

`foldSections.ts` spreads a section's body as direct siblings of `<summary>`, so there is no element to
inset. The two ways to get one:

- **Add a wrapper** in the transform. Rejected: the capability requires the boundary rule to be "a pure
  transformation over the document tree and verified directly", and its tests assert the output shape.
  Changing that shape to carry styling would put presentation inside the one piece of this feature whose
  correctness is load-bearing, and churn its tests for a visual reason.
- **Style the existing `details`** — chosen. `details[data-spek-fold]` already carries a marker
  attribute. Put the indent and the hairline rule on the `details` itself and pull `<summary>` back by
  the same amount with a negative margin, so the heading stays on the parent's left edge while the body
  is inset.

A side benefit decided the shape: because the rule is on the section element, it spans the section's
full height and reads as a bracket around its extent, which is more information than an indent alone.

**The `[open]` scoping covers the summary's negative margin too, not only the inset.** Both halves are
one adjustment and must switch together: `details[data-spek-fold][open]` takes the padding and the rule,
`details[data-spek-fold][open] > summary` takes the matching negative margin. Applying the margin
unconditionally would pull *closed* sections' headings a step left of open ones — and the default mode
opens requirements while leaving scenarios closed, so that misalignment would be the **first thing
rendered**, not an edge case. It would also contradict this change's own requirement that headings stay
aligned regardless of open state.

**The rule needs its own token; `--color-border` cannot carry it.** The obvious choice was the existing
border colour, on the reasoning that a hairline is decorative and a new token would mean defending a
contrast value. That reasoning does not survive the requirement being written down: this change makes
marking a section's extent normative, and a marker nobody can see does not mark anything. Measured,
`--color-border` gives **1.4:1** dark (`#2a2d35` on `#0a0c0f`) and **1.2:1** light (`#e2e8f0` on
`#f8fafc`) — the light value is effectively invisible, and the target host is a ~460px tool window. So a
dedicated per-theme token is chosen up front at **≥3:1**, the non-text contrast threshold, rather than
discovered during implementation. Thickening the line instead was rejected: width is the scarce resource
here.

### 4. Nesting cost is bounded by insetting only at fold boundaries

Only `details` sections inset, so depth is at most two (requirement → scenario) before the markdown's
own list indentation, which is unchanged. At the ~460px width the reporter is using, two levels of a
small indent are affordable; a third would not be, which is why the topic header does **not** inset its
spec's content.

### 5. The demoted label is neutral; the keyword vocabulary is completed separately

These look like one job and are two, which an earlier draft of this design got wrong by proposing that
the operation's badge colour also paint the demoted heading — "one definition, both uses". It cannot:
keyword marking runs through `processChildren`, which is called from `p`, `li` and `strong` **only**, so
no heading has ever been marked. Reaching the heading would mean matching its text against
`/^(ADDED|MODIFIED|REMOVED|RENAMED)/`, which is precisely the content sniffing decision 1 rejects.

So the two are kept apart:

- **The demoted operation label takes a neutral muted token**, not an operation colour. It is a
  structural label, and its job in this change is to stop shouting; colour-coding it would be new
  emphasis where the complaint was too much emphasis.
- **`REMOVED` and `RENAMED` join `BDD_KEYWORDS`** for the prose case, each with a text colour and the
  plain `bg-*-500/20` pill fill the existing marks use. This fixes no visible symptom today — every
  occurrence of these two words in the repo is a heading — and is done for vocabulary completeness, so
  the next author who writes one in a sentence is not told by its rendering that it is an ordinary word.

`REMOVED` does not take the red already assigned to `MUST`/`SHALL` (`--color-kw-normative`). Red means
"normative" in this renderer; spending it on a second meaning makes both weaker. Each new value is
defined in both themes at ≥4.5:1, per the `markdown-renderer` contrast requirement.

### 6. The spec detail page gets the same typography, though it is not the reported defect

Both screenshots in the report are of the Specs tab. On the spec detail page nothing is inverted today:
the page already renders the topic as its own `h1` above the markdown, so ranking runs h1 → h2 → h3
correctly.

The demotion is applied there anyway, because the alternative is worse: the same document would be
typeset one way when read on its own and another way when read inside a change. What changes there is
that `## Purpose` and `## Requirements` become quiet labels — which is what they are. The rank they
currently hold is carried by the `h1` above them, not lost.

## Risks / Trade-offs

- **The outline still does not nest.** With the topic header promoted and the operation heading left at
  `h2`, the two are siblings rather than parent and child. → Accepted: the reported defect is that the
  topic is *outranked and terminated* by the heading it introduces, and sibling ranking with the topic
  visually dominant removes that. Making it true nesting requires re-levelling the markdown, excluded
  above as a Non-Goal.

- **The table of contents is untouched, and still ranks the operation heading above the requirements.**
  `extractHeadings` returns h2 and h3, and the TOC indents by level, so `ADDED Requirements` remains a
  top-level entry above the requirements it groups — after this change, the content's quietest heading
  is the sidebar's loudest entry. → Accepted as a remainder, not fixed here: the TOC is navigation
  chrome rather than rendered spec content, and pulling it in widens the change past what was reported.
  Named so the next reader finds it as a known gap rather than as a new bug.

- **`details[open]` scoping means the bracket appears and disappears as the user toggles.** → Intended:
  a closed section has no extent to show. Worth a look in motion, since every requirement toggling at
  once via Expand all / Collapse all is the visible case.

- **Four operation colours is four more things to keep readable**, in two themes, and the palette is
  already carrying eight marks. → The contrast obligation is already specified and applies
  automatically; the risk is hue crowding, not compliance. `RENAMED` is rare (2 occurrences here), so if
  hues run out it is the one to render neutrally rather than to force a colour.

## Open Questions

None blocking. The exact hue values are chosen at implementation against the measured contrast, not
fixed here.
