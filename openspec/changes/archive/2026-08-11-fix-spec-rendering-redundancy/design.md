## Context

Two presentation defects reported against v1.12.0 (issue #42), both in spec-shaped content: the
`Requirement:` / `Scenario:` format keyword repeated on every heading, and a section extent rule that
runs across the boundaries it should be marking.

Four places display heading text, and they are reached by two different paths:

| Surface | Text comes from | Component |
|---|---|---|
| Rendered spec content | the markdown itself, via hast | `MarkdownRenderer` (h3 / h4) |
| Spec detail TOC | `extractHeadings(content)` | `SpecToc` ← `SpecDetail` |
| Change detail TOC (Specs tab) | `extractHeadings(content)`, slug topic-prefixed | `SpecToc` ← `ChangeDetail` |
| VS Code sidebar spec headings | `extractHeadings(content)` | `SpecHeadingItem` |

`SpecToc` is shared by both TOCs, but `ChangeDetail` also uses it for a change's proposal / design /
tasks artifacts, which are not spec-shaped. So "which surfaces elide" is not the same question as
"which components elide".

The extent rule is one CSS pair on `details[data-spek-fold][open]` — `padding-left` plus a
`border-left` in `--color-fold-rule` — applied at every fold level.

**The abutting is measured, not impressionistic.** In the reporter's screenshot the rule occupies
column 21; scanning that column gives a single unbroken 685px run from y=49 to the bottom of the crop,
across three consecutive requirements, with no gap anywhere. Since each requirement's `<details>` draws
its own border, the boxes must be meeting exactly. Each section's first child is an `h3` carrying
`mt-5`, so if that margin collapsed out of the box there would be a ~20px gap — there is none.

The reason is the `<summary>`, which the renderer gives `flex` so the disclosure triangle can sit beside
the heading. A flex container establishes a formatting context, so the `h3`'s top margin cannot collapse
out through it; the current `padding-left` / `border-left` pair would not have stopped it on its own.
Worth recording precisely, because the fix below rests on it: **the space between two sections cannot be
made by the headings inside them** — and if that `flex` is ever removed, this whole analysis has to be
redone.

## Goals / Non-Goals

**Goals:**

- Requirement and scenario headings display without their format keyword, on every surface that shows
  them, from a rule stated once.
- Heading identity — element, level, `id`, `Heading.text`, `Heading.slug` — is byte-for-byte what the
  author wrote, so every anchor, deep link, scrollspy target and sidebar jump resolves exactly as before.
- An open section's extent mark ends where the section ends, and does not double up on a nested one.

**Non-Goals:**

- Changing what a `schema.yaml` or a `spec.md` must contain. spek renders; OpenSpec's format is
  unchanged.
- The TOC's ranking of the operation heading above requirements (issue #42's recorded gap).
- Search result excerpts, which quote file text.
- A second, lighter colour for the nested rule — see D5, that option is what this design removes.
- Any Kotlin change. The IntelliJ tool window loads the same SPA and its Kotlin tree has no heading
  nodes.

## Decisions

### D1. The elision is a rehype step, and it runs *after* heading ids are assigned

`MarkdownRenderer` already composes two hast plugins in a fixed order, with the ordering constraint
written into the code: ids first (the dedup counter needs a flat tree), folding second. The elision
becomes a third, between them.

Order is load-bearing, and in one direction only: **`rehypeSpekHeadingIds` derives each id from the
heading's text content.** Elide first and every requirement's id changes — while `extractHeadings`,
which parses the raw markdown for the TOC and the sidebar, keeps producing the authored slug. The two
would silently disagree and every existing link into a requirement would land nowhere. Ids first, always.

*Alternative considered:* transform in the `h3` / `h4` component renderers, on React children. Rejected —
children arrive as strings mixed with elements (a heading may carry inline code), so the leading-text
case would be picked out of a `ReactNode` tree by hand, which is the shape of the existing BDD keyword
code and the part of this file that is hardest to reason about. On hast the leading text node is
unambiguous and the transform is a pure tree function testable the way `foldSections` already is.

### D2. The matching rule lives in core, on the `headings` subpath, as display-only

`@spekjs/core/headings` gains one function taking a heading's text and returning what to display —
provisionally `specHeadingLabel(text: string): string`, returning the input unchanged when nothing
matches.

It goes in core rather than in each host because four call sites in two packages would otherwise each
carry their own regex. This repo has already paid for the same rule written twice (the task parser, in
two languages, diverging on line terminators and blank-line definitions); this one is smaller but the
failure mode is identical and quieter — the content and the sidebar disagreeing about what a heading is
called.

It sits next to `extractHeadings` and `slugifyHeading` **and is deliberately not wired into either**.
`Heading.text` and `Heading.slug` stay identity: `text` is what the file says, `slug` is derived from
`text`, and the display label is a third thing that no other value is derived from. Making
`extractHeadings` return elided text instead would have been the smaller diff and would have changed
what identity means for every consumer, including published ones.

*Alternative considered:* return `{ keyword, label }` so a host could style the keyword rather than drop
it. Rejected as speculative generality — that shape exists to support demoting the keyword, which is the
option this change rejects. A string keeps the call sites trivial, and the richer shape is an additive
change later if it is ever wanted.

### D3. Matching is strict, and failing to match is the safe outcome

- Keywords are exactly `Requirement` and `Scenario`, case-sensitive, followed by `:`.
- Whatever follows must be non-empty after trimming, or the text is returned unchanged — a heading whose
  entire content is the keyword would otherwise render as nothing.
- No level restriction anywhere — not in core, and not in the callers either. An earlier draft left the
  level to each caller; the callers then disagreed, because the surfaces do not show the same levels
  (rendered content shows every heading, `extractHeadings` returns levels 2 and 3). A `## Requirement: X`
  would have been elided in the sidebar and kept in the content. What makes a heading a requirement is
  the keyword, so the keyword is the whole condition.
- The decision is made over the **complete** heading text. `### Requirement: \`@spekjs/ui\` package
  exports …` — two of which exist in this repo — begins with a text run that is exactly `Requirement: `
  and then leaves plain text for a code span. Judging that run alone finds an empty remainder and keeps
  the keyword, while the TOC, reading the file's line, drops it: the two surfaces disagree on the first
  real document, which is the failure this design exists to prevent. The renderer therefore decides from
  the same concatenated text the id plugin already builds, and only then removes the prefix from the
  leading text node — declining if the keyword does not lie wholly inside it, since eliding across
  markup would delete part of the author's structure.
- Exactly the keyword, colon and following spaces are removed, with **no trim at the end**. Slicing then
  trimming a partial run turns `Requirement: The \`foo\` flag` into a heading with no space before the
  code span.

Strictness is the point: a lowercase or spaced variant is not OpenSpec's format, and spek is a viewer —
quietly normalising something the CLI would reject makes the rendering claim the file is well-formed
when it is not. Every non-match falls back to showing exactly what the author wrote, which is also what
happens under a custom schema whose `format` uses different keywords: no match, no elision, nothing
misrepresented.

### D4. Elision is gated on the spec-shaped declaration, never inferred

`markdown-renderer` already carries the rule that the renderer is *told* its content is spec-shaped and
must not decide by matching text. The elision inherits that gate: the plugin is only installed when
`specShaped` is set.

The same reasoning reaches `SpecToc`, which is shared between the spec detail page (always spec content)
and the change detail page (spec content on the Specs tab, prose artifacts on the others). It therefore
takes the same declaration as a prop from its caller rather than deciding for itself — otherwise a
proposal that happens to contain a heading beginning `Requirement:` would have it stripped, which is the
exact inference the existing requirement forbids.

### D5. Only the outermost open section draws the extent rule

A nested open section keeps its inset and drops its border. Depth still reads from position, and the
nested section's extent is bounded by the requirement rule already enclosing it.

Expressed structurally — a fold inside another fold — rather than by matching `data-spek-fold="4"`. The
fold levels are configuration passed in by the caller; a rule keyed to the number silently stops
applying the day another level folds.

*Alternative considered:* keep both rules and make the nested one lighter. Rejected on the constraint
already recorded for this token: `--color-fold-rule` is one mid-gray chosen to clear 3:1 in **both**
themes, because marking a section's extent is a stated requirement rather than decoration. A lighter
nested rule needs a second pair of measured values and reopens a contrast question that was closed one
release ago — to draw something the reporter described as duplication.

### D6. The gap is made on the section box, not by the headings inside it

From the measurement in Context: the first child's top margin is contained by the section box. So the
mark starts above its heading and ends at the following section's first pixel, and *no adjustment to
heading margins can separate two sections* — the spacing has to be block margin on the fold element
itself.

**What building it changed about this decision.** The predicted trade against the heading's `mt-5` never
arose: a bottom margin alone separates the sections, because that heading's margin sits at the *top* of
the box and the mark had always started above the heading. What did arise was the reverse problem at the
other edge — the body's *last* margin collapses **out** of the section, so the gap became whatever was
larger, the section's own margin or its final paragraph's. Measured: 8px between sections with scenarios
closed, 16px with them open, i.e. opening a scenario pushed every following requirement down by another
8px, which the specs forbid in as many words. The fix is to stop the escape rather than to balance
against it: the fold element is `display: flow-root`, so its interior margins stay interior and the gap
is exactly the one margin declared on it. Two further consequences worth keeping: the marker offset and
the separation are both stated **unscoped**, because anything keyed to `[open]` moves the layout as a
reader toggles — the very thing being prevented.

### D7. The VS Code tree label is elided; its tooltip is not

`SpecHeadingItem` already sets `tooltip = heading.text`. Applying the label rule to the visible label
and leaving the tooltip alone costs nothing and leaves the authored form reachable in the one host that
already has a place to put it. No equivalent is added to the web content: a tooltip that disagrees with
the visible text is a second, hidden rendering, and inventing one to reassure a reader about text we
just decided carries no information would argue against the change itself.

## Risks / Trade-offs

- **Elision lands before id assignment** (the one change here that breaks links) → plugin order is fixed
  in `MarkdownRenderer` where the ordering constraint is already commented; covered by a test asserting
  that an elided heading's rendered `id` still equals `slugifyHeading` of the *authored* text.
- **The rule drifts between the four surfaces** → one exported function, no second copy; the surfaces
  differ only in whether they call it.
- **Over-eager matching hides a heading's name** → non-empty-remainder guard plus case-sensitive
  matching, both tested; every non-match renders the authored text.
- **The gap fix changes vertical rhythm, or the page shifts when a scenario is toggled** → D6: settle the
  interior and exterior spacing together, verify open and closed, verify in the IntelliJ tool window as
  well as a browser. The webview cannot be checked from a browser alone — the host injects its own
  stylesheet, which is how a previous styling defect reached a release.
- **A reader can no longer tell a requirement heading from any other level-3 heading** → accepted. In
  spec-shaped content under an operation heading, every level-3 heading is a requirement; that is the
  premise of the change, and the operation heading (restored to visibility in v1.12.0) is what names
  them.
- **`@spekjs/core` consumers** → additive export only; `Heading` and `extractHeadings` are untouched, so
  nothing an existing consumer reads changes meaning.

## Migration Plan

No data, no persisted state, no API shape changes — deploying is shipping the release. Rollback is a
revert, and because ids and slugs are untouched in both directions, no link minted under either version
breaks under the other.

## What the tests do not reach

- **The layout in D5/D6.** jsdom measures nothing, so the automated guards assert the *shape* of the
  CSS rules (a nested fold silences its mark; the separation is not `[open]`-scoped and carries the
  BFC). Whether the result actually reads as one bracket per requirement was settled by rendering the
  real component with the real built stylesheet in headless Chrome and measuring the rule's column in
  the pixels: before, one unbroken 2160px run across every requirement; after, one run per requirement
  with an 8px break, in `default` / `expanded` / `collapsed` and in both themes. Re-running that is
  a rebuild plus a screenshot, not a test suite.
- **The VS Code tree.** That package has no test setup, so the label/tooltip split is checked by hand in
  an Extension Development Host.

## Notes for whoever archives this

`CLAUDE.md`'s spec-section-folding paragraph states, as a hard-won rule, that **both** fold selectors
carry `[open]`, and describes the extent rule as applying to every open section. D5 and D6 make that
description wrong in two ways: the rule becomes outermost-only, and a spacing rule joins the pair. The
paragraph describes master's implementation, so it is the archive step's to update — recorded here so
it is not left to be noticed.

## Resolved during implementation

- **Does the block spacing apply to closed sections too?** Yes, and it is not optional: any part of this
  keyed to `[open]` changes the layout when a reader toggles a section. The separation, the marker
  offset, and the containment are all declared unscoped for that reason.
- **How wide is the inset?** `1rem`, with the summary's negative offset matched to it, and the marker
  given `0.25rem` of clearance so it is not drawn against the mark. Both settled by looking at the
  running app rather than in advance; the offset-matches-inset invariant is now a test, since changing
  one without the other is what makes headings drift.
