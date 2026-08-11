## Context

The extent mark is `border-left` on the `<details>` element itself. A border is drawn down the whole
border box, so it necessarily starts at the top of whatever is inside — and what is at the top is the
heading's leading space, not the heading. The heading sits in a `<span>` that is a flex item of
`<summary>`, so that span is an independent formatting context and the heading's `margin-top` cannot
escape it; `<details>` carries `display: flow-root` besides, added in v1.13.0 so the body's last margin
could not escape either. Both seals are working as intended.

Measured in Chromium against the built stylesheet: a top-level section's box starts at y=60 and its
`h3` box at y=80, so 20px of mark is drawn above the heading. The painted runs down the mark's pixel
column are 60–253, 262–407, 416–513 — of the 28px separating one requirement section from the next
heading, 20px is painted and 8px is not. The mark's start is therefore not a separate defect from the
sibling gap: the gap exists, and is invisible because the following section's mark fills three quarters
of it.

Three separations are what a reader compares, and all three must survive unchanged (measured today, in
this order: 28px, 32px, 16px):

- between two requirement sections — 8px of section margin plus 20px of leading space;
- between an operation heading and the first requirement below it — `h2`'s 12px of trailing space plus
  the same 20px;
- between two scenario sections — 16px, from `h4`'s smaller leading space.

These are separations between boxes, not distances between heading baselines; the verification step has
to measure the same quantity or it will not reproduce these numbers.

## Goals / Non-Goals

**Goals:**

- The mark starts where its heading's first line box starts, so that the space separating two sections
  is empty of any mark.
- Every separation a reader can compare comes out of this change identical to v1.13.0, with one stated
  exception (see the nesting decision below) — this is a change to what is drawn, not to the rhythm of
  the page.
- The mark's start and the space it must clear cannot drift apart, by construction rather than by a
  test watching two numbers.

**Non-Goals:**

- Changing the gap between sections. If the gap still reads as too small once the mark stops filling
  it, that is a separate judgement made against the fixed version.
- Changing colour, weight, nesting behaviour, or which sections fold.
- The table of contents ranking `ADDED Requirements` above the requirements (known gap, issue #42).

## Decisions

### The mark becomes an absolutely positioned pseudo-element, not a border on the section

`border-left` cannot start below the top of its box. Every way of keeping it on the section involves
lying about the box: padding the border must not cover, or a gradient painting a border-coloured
stripe. A pseudo-element states the mark's extent directly — `top` is where it starts, `bottom: 0` is
where the section's content ends — and that is exactly what the requirement is about.

**The pseudo-element draws the mark with `border-left` and `width: 0`, not with a background.** In
forced-colors mode a background is dropped and a border is forced to `CanvasText`; the spec requires
the mark to be perceivable, and the VS Code webview can be viewed under a Windows high-contrast theme.
Painting it as a border keeps a mark that survives there, and keeps it out of the "background graphics
off" hole when printing. The choice costs nothing — same one pixel, same custom property.

*Alternative — keep the border and push the section down with `margin-top`.* Sibling margins collapse,
so the gap between sections and the leading space above a heading stop being two numbers that add and
become one that takes the max. A uniform value cannot give both 28px and 32px — measured, 28px uniform
drops the operation-heading separation from 32px to 28px. Splitting it (a base value plus a larger one
after an `h2`) does reproduce all three numbers, so this is a coupling argument rather than an
impossibility one: the section's gap and its heading's leading space would become the same declaration,
and every future adjustment to one would have to be reasoned about as an adjustment to the other.

*Alternative — drop `flow-root` so the heading's margin escapes upward.* It would also un-seal the
bottom, restoring the v1.13.0 defect where the distance between sections depended on which element
happened to be last inside one, and expanding a scenario pushed everything below it down by 8px.
Rejected: it trades a drawing defect for a layout defect.

*Alternative — a `linear-gradient` background offset by the leading space.* It works and needs no
positioned ancestor, but it states the mark as a paint operation with the geometry encoded in a
background shorthand, where the pseudo-element states it as a box with a top and a bottom. Rejected on
legibility, not correctness.

### The heading's leading space moves onto the section, and one custom property feeds both

The heading inside a `<summary>` gets `margin-top: 0`; the section carries that space as `padding-top`
instead. The pseudo-element's `top` and the section's `padding-top` both read `--color-fold-lead`, so
the mark starts exactly where the space ends and cannot be half-updated. The property is named in the
app's own `--color-*` family beside `--color-fold-rule`; `--spek-*` is `@spekjs/ui`'s published colour
contract and is not ours to extend.

`padding-top` rather than `margin-top` for the reason above — padding does not collapse, so the number
in the stylesheet is the number on screen, and the three separations stay decomposable.

The padding applies **open or closed**. A closed section has no extent to mark, but it does have a
heading, and if only open sections reserved the leading space the headings of open and closed siblings
would sit at different heights — the default state (requirements open, scenarios closed) puts that on
screen immediately. This is the same rule the existing `> summary` padding follows, and for the same
reason.

Two things about the neutralising rule are easy to get wrong and are worth stating:

- **The heading is not a child of `<summary>`.** The renderer wraps it in a flex `<span>`, so the
  selector must be a descendant one. Every existing fold rule uses `> summary`, and copying that shape
  produces a rule that matches nothing and fails silently.
- **Only `margin-top` is neutralised.** The heading's `margin-bottom` sits between it and its own body,
  inside the summary box, and is not part of any separation being preserved.
- The rules must stay **unlayered**, as they are today; that is what lets them beat Tailwind's utility.

### The mark's end is the same problem as its start, and gets the same treatment

Found while testing the fix: with the start corrected, the mark still ran 20px past the last thing it
enclosed, consistently across every section (measured: mark ends at 405, 635, 741 against last content
pixels at 385, 615, 720). The section is a BFC, so the trailing margin of its last paragraph or list —
`mb-4`, 16px — is sealed inside the box, exactly as the heading's leading margin was at the top. A
border, and equally a pseudo-element pinned to `bottom: 0`, draws to the box.

So the box is wrong at *both* ends, and for one reason: it holds two spaces the content does not. The
mark's `bottom` clears the trailing space from `--color-fold-trail`, mirroring the `top`. Only the mark
reads that property — the section's own spacing is untouched, so no separation moves and the box stays
where it was.

*Alternative — move the trailing margin out of the section, as was done for the heading's leading
space.* Symmetric in principle, but it does not survive the closed state: a collapsed section has no
trailing content to move, so the compensating outer margin would have to differ between open and
closed, which is precisely what "opening or closing a section SHALL NOT change the spacing between the
sections around it" forbids. The leading space has no such asymmetry — every section has a heading.

This leaves a second restated constant (`--color-fold-trail` against the renderer's `mb-4`), pinned by
a test in the same way, including that paragraphs and lists still agree on that margin: if they ever
diverge, "where the content ends" stops being a single distance and this rule needs rethinking.

### The nested value is keyed on nesting, not on a heading level

Two leading values exist because two heading levels are folded and their spacing differs (20px, 16px).
The nested value is selected by "a fold inside a fold", matching how the nested section already
suppresses its own mark. Keying it to `[data-spek-fold="4"]` would silently stop applying the day the
caller folds a different level — which levels fold is given to the renderer by its caller, and that is
already the stated reason the mark-suppression rule is written this way.

**This has a cost, and it lands on a shape the spec already covers.** A scenario section with no
requirement before it is top-level, so it takes the top-level leading value: measured, 16px becomes
20px and everything below it shifts down 4px. Keeping it at 16px would mean deciding the spacing from
the heading's level, which is the coupling this rule exists to avoid — and it would be decided from a
level the caller is free to change. The 4px is accepted, and stated in the spec as spacing that follows
the section's nesting rather than its heading, so that it reads as the rule working rather than as an
oversight.

### One duplication remains, and it needs a test rather than a mechanism

`--color-fold-lead` restates `h3`'s `mt-5`, and the nested value restates `h4`'s `mt-4`, while those
utilities become dead for folded headings — neutralised by the rule above. Changing `mt-5` to `mt-6`
would then move unfolded content and leave folded specs where they are, with nothing failing. This is
the same class of defect this change removes from the mark's start, and it cannot be removed the same
way: CSS cannot read a descendant's margin. It is pinned by a test asserting the component's class
still carries the value the stylesheet restates, in the manner of the existing test that the summary's
negative offset cancels the section's inset exactly.

### Removing the border removes a 1px inconsistency, and moves what is inside by 1px

With the border gone, an open and a closed section's heading sit on exactly the same left edge.
Measured: the open one's `h3` moves from x=21 to x=20, the closed one is at 20 in both. That is not
merely a tidy-up — the spec's "a closed section's marker sits on the same left edge as an open one's"
is violated today, by exactly this pixel, and this change satisfies it.

The mark's painted column is unchanged at x=0. Everything inside the section moves 1px left with the
border's removal, so the disclosure marker's clearance from the mark goes from 4px to 3px. The two are
the same pixel: the inconsistency cannot be removed from the heading while the marker keeps its
distance. 3px still separates them, which is what the requirement asks.

## Risks / Trade-offs

- **The geometry is invisible to jsdom.** → Verified as it was when the mark was introduced: render the
  real component against the built stylesheet in headless Chrome and scan the mark's pixel column,
  asserting where the painted run starts relative to the heading's **line box** — not its text, which
  sits ~5px lower inside a 28px line box and would fail a scan written to the literal word — and that
  consecutive sections leave an entirely unpainted run between them.
- **The existing text-level tests match the first rule block of a given shape**, so where the new
  declarations are placed decides whether they pass. The lead belongs in the existing unscoped block
  (the one asserted to carry `margin-bottom` and `flow-root`), not in a new block above the `[open]`
  one — placed there, the `[open]` assertion fails against the wrong rule, and the obvious fix is the
  one CLAUDE.md forbids. The contrast guard greps the `[open]` block for the mark's colour and must be
  retargeted at the pseudo-element, since it is the only automated check behind the spec's 3:1
  requirement.
- **The fold handle's hit area shrinks.** Measured: `<summary>` goes from 56px to 36px tall for a
  requirement, because the leading band moves out of it and onto the section. Clicking in the band
  above a heading toggles the section today and will not afterwards. Arguably an improvement — the band
  is closer to the section above it — but it is a change to a native control's target, and worth
  looking at rather than discovering.
- **A pseudo-element needs a positioned ancestor**, so the section gets `position: relative`. Nothing
  inside is absolutely positioned today.
- **`::before` on `<details>` is confirmed in Chromium only** (which is what VS Code and IntelliJ's JCEF
  run). The Web surface is browser-agnostic; Firefox and WebKit are untested here.
- **The gap may still read as small** once it is genuinely empty: 8px of nothing looks smaller than 8px
  of nothing next to 20px of line. Deliberately not pre-emptively widened — the report is about where
  the line starts, and changing both at once means neither can be judged.
