## 1. Move the heading's leading space onto the section

- [x] 1.1 In `packages/web/src/styles/global.css`, zero `margin-top` (only that, not `margin`) on the heading inside a folded section's `<summary>` — a **descendant** selector over heading elements, since the renderer wraps the heading in a flex `<span>` and the `> summary >` shape every other fold rule uses would match nothing and fail silently
- [x] 1.2 Declare `--color-fold-lead: 1.25rem` on the section and give the space back as `padding-top`, applying open **or** closed so a heading does not move as its section toggles. Put both declarations **into the existing unscoped block** (the one carrying `margin-bottom` and `flow-root`) rather than a new block above the `[open]` one — see 3.1 for why the placement is load-bearing
- [x] 1.3 Redeclare `--color-fold-lead: 1rem` for a fold inside a fold, keyed on nesting rather than on `data-spek-fold="4"`, matching how the existing mark-suppression rule is written. Keep the rules unlayered, which is what lets 1.1 beat Tailwind's utility
- [x] 1.4 Record in the comment why this is `padding` and not `margin` — sibling margins collapse, which would make the section gap and the leading space one declaration taking the max of the two instead of two that add

## 2. Draw the mark from the heading

- [x] 2.1 Replace `border-left` on the open section with an absolutely positioned `::before` (`left: 0`, `bottom: 0`, `width: 0`, `border-left: 1px solid var(--color-fold-rule)`), adding `position: relative` to the section. Draw it as a **border, not a background**: a background is dropped in forced-colors mode and when printing without background graphics, and the spec requires the mark to be perceivable
- [x] 2.2 Start it at `top: var(--color-fold-lead)` — the same property the padding reads, so the mark's start and the space it must clear cannot drift apart
- [x] 2.3 Drop the `border-left-color: transparent` rule for nested sections; suppress the nested `::before` with `content: none` instead, keeping the condition "a fold inside a fold"
- [x] 2.5 End the mark at the section's content, not its box: `bottom: var(--color-fold-trail)` clears the trailing margin the BFC seals inside the section (measured 20px of mark past the last content). Only the mark reads it — the section's own spacing must not move
- [x] 2.4 Note in the comment that removing the border moves everything inside the section 1px left: it fixes the open/closed heading misalignment the spec forbids, and necessarily takes the disclosure marker's clearance from 4px to 3px — one pixel, not two independent ones

## 3. Tests

- [x] 3.1 Update `MarkdownRenderer.hierarchy.test.ts` and `MarkdownRenderer.keyword.test.ts` where they assert `border-left` and the inset/offset pair as text against `global.css`. Both match the **first** rule block of a given shape, so a misplaced declaration makes them fail against the wrong rule with a message pointing at the fix CLAUDE.md forbids — verify the failure they give if the lead lands in the wrong block, so the next reader is not misled
- [x] 3.2 Retarget the contrast guard (`the extent rule does not use the panel border colour`) at the `::before` rule; after the move the `[open]` block no longer carries the mark's colour, and this is the only automated check behind the spec's normative 3:1 requirement
- [x] 3.3 Assert that the section's `padding-top` and the mark's `top` resolve to the same custom property, replacing the two-numbers-must-agree check with one that cannot be half-satisfied
- [x] 3.4 Pin the duplication that no mechanism can remove: `--color-fold-lead` restates `h3`'s `mt-5` and its nested value restates `h4`'s `mt-4`, and those utilities are dead for folded headings — assert the component's class strings still carry the values the stylesheet restates, or changing one silently moves unfolded content only
- [x] 3.6 Pin `--color-fold-trail` against the renderer's paragraph `mb-4`, and assert paragraphs and lists still share that margin — if they diverge, "where the content ends" is no longer one distance
- [x] 3.5 Assert the leading-space rule carries no `[open]`, the way the existing tests pin which rules are scoped and which deliberately are not

## 4. Verify the geometry

- [x] 4.1 Render the folded spec against the built stylesheet in headless Chrome and scan the mark's pixel column: each painted run starts level with the top of its heading's **line box** (not its text — an 18px glyph sits ~5px down inside a 28px line box), and the run between two consecutive sections is entirely unpainted
- [x] 4.2 Measure the three separations that must be unchanged from v1.13.0 — section bottom edge to the next heading's box top, **not** heading-top to heading-top: requirement to requirement (28px), operation heading to first requirement (32px), scenario to scenario (16px)
- [x] 4.3 Confirm the one accepted change: a scenario section with no requirement before it moves from 16px to 20px of leading space, shifting it and what follows down by 4px
- [x] 4.4 Confirm an open and a closed sibling put their headings and disclosure markers on the same left edge — this change is what makes that true — and that toggling a nested scenario moves nothing around it
- [x] 4.6 Scan the mark's end against the last content pixel in the all-expanded state, where the trailing margin is largest
- [x] 4.5 Check the fold handle's hit area: `<summary>` loses the leading band (measured 56px → 36px for a requirement), so clicking above a heading no longer toggles its section

## 5. Gates

- [x] 5.1 `npm run type-check`, `npm run lint`, `npm test`
