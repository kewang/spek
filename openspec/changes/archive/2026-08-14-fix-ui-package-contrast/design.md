## Context

`@spekjs/ui` holds one set of colours and no theme. Its contract is eight `--spek-*` variables with dark defaults; a
host overrides them from its own tokens, and `theme.ts` explains why the package cannot simply read the host's names —
a downstream Electron consumer calls its tokens `--color-ink` / `--color-accent`, so a package reaching for
`--color-text-primary` would render a graph with no colour at all.

That contract works. `fix-theme-contrast` changed nothing in this package, and its tooltip's active status went
2.37:1 → 4.75:1, its in-progress timeline bar 2.29:1 → 3.94:1 — the host's new light values arriving through eight
names. What fails is every colour that never entered the contract, plus every opacity standing between a contract
value and what is drawn.

Three facts shape everything below:

- **Most literals are copies of a contract value.** `#f59e0b` *is* the accent's dark default, `#64748b` *is*
  `--spek-text-muted`'s, `#94a3b8` *is* `--spek-text-secondary`'s. They are not colours the contract lacks; they are
  colours that stopped going through it, and a copy does not follow what it was copied from.
- **The package's own defaults are stale in the same way.** `--spek-text-muted` is still `#64748b` — the value
  `fix-theme-contrast` re-authored in the host *because it measured failing*. Every un-themed consumer of this package
  is reading tooltip text at 3.90:1 today.
- **The package cannot measure its own contrast, and the host cannot see the package's alphas.** Ratios need values,
  which under the contract only the host has; the alphas live in `fill-opacity` / `stroke-opacity` attributes written
  at draw time, which no CSS parse finds. Any guard has to be split along that line.

**Measurement basis**: the worst of the theme's three surfaces, the rule `theme-toggle` states. The graph is drawn on
`bg-primary` and the timeline panel on `bg-secondary`, but a package cannot know where a host puts it, so the app-wide
convention applies here for the same reason it applies there. Every figure below is a worst-of-three.

## Goals / Non-Goals

**Goals:**

- Every colour the package renders is expressible by the host — no literal outside the contract.
- The graph and timeline meet what `theme-toggle` states: 3:1 for a graphic that is the only carrier of its
  information, 4.5:1 for text, neither undone by opacity.
- The package's own defaults are legible, since that is the one case the package can judge alone.
- The contract grows by the minimum, because a new variable is the one kind of change existing hosts do **not**
  inherit.

**Non-Goals:**

- Giving the package a theme of its own. Defaults stay dark-only: the package cannot see a host's theme toggle, and
  `prefers-color-scheme` is wrong precisely when a host has an explicit switch that disagrees with the OS.
- Restyling the graph. Hues stay where they are; what changes is where they come from and, in several places, an
  opacity.
- The web app's own palette, settled by `fix-theme-contrast`.

## Decisions

### Reuse before adding: the literals become variables that already exist

| Literal | Becomes | Light | Dark |
|---|---|---|---|
| `#f59e0b` — spec node fill and stroke, legend swatch | `--spek-accent` | 1.85 → **4.74** | 6.01 → 6.01 |
| `#64748b` — archived node fill, legend swatch | `--spek-text-muted` | 3.32 → **3.81** | **2.93** → **4.37** |
| `#94a3b8` — archived node stroke, and `theme.ts`'s two last-resort returns | `--spek-text-secondary` | — | — |

The archived node is the one to notice. Its literal is a copy of `--spek-text-muted`'s *former* dark default, so when
`fix-theme-contrast` re-authored that token the node did not follow: the token is now 4.37:1 at the node's own
fill-opacity and the node stayed at **2.93:1**, below the 3:1 floor for a mark whose colour is normative. Nothing
changed to break it — it simply stopped tracking, which is the argument for the contract in one number.

### Exactly one variable is added: `--spek-node-active`

The active-change green (`#22c55e`) has no contract equivalent and cannot be derived from one. It gains a variable,
dark default `#22c55e` (6.41:1 at the node's fill-opacity against the package's own background), mapped by the web
host to `--color-status-success` → 7.16:1 dark / 4.74:1 light.

**The name is `--spek-node-active`, not `--spek-change-active`, because the scope is the graph node and nothing
else.** The timeline draws the same fact — this change is active — from `--spek-accent`, and the tooltip's active
status likewise. A property named for the *state* would invite a host to map its "active" colour and get a green node
beside an amber bar for one fact. Naming it for the mark keeps the promise the property can actually keep.

**An added variable is not inherited the way a reused one is.** A host that overrode the eight names it knew takes
the new default silently — dark green on a light page, today's bug wearing a new mechanism. Nothing inside the
package can detect that, so: add exactly one, give it a default that is legible rather than merely dark-correct, and
record it for consumers.

### The package's own defaults are re-authored where they fail

`--spek-text-muted: #64748b` measures 3.90:1 against the package's own `--spek-bg-secondary`, which `styles.css` sets
on both the timeline panel and the tooltip. Under the package's defaults that value carries the tooltip's body text,
the timeline's empty state, its section labels and its axis tick labels — all at 3.90:1, and the "(ongoing)" marker
at 2.94:1. It becomes `#8595aa` (6.08:1 there, 5.52:1 worst-of-three), the same value the host now uses, in both
`styles.css` and `theme.ts`'s `FALLBACKS`.

This is what the new "defaults are legible" requirement is for, and it fails on the very first run without this.

### Strokes take their fill's colour — and the design says what that buys

`#fbbf24` and `#4ade80` are each one step lighter than their fill, a dark-theme assumption: on a light page a rim has
to darken instead, and the package cannot know which way to move. The stroke becomes the fill's own colour at full
strength, the fill staying at `fill-opacity` 0.85.

**Measured, the rim is 1.31–1.39:1 against its own fill in both themes**, so it is not a boundary a reader can see as
a rim. What makes the node's shape legible is its outer half sitting on the page at the fill colour's full strength
(4.74–7.85:1). The stroke is therefore kept for the edge definition it gives against the *background*, not for any
contrast against the fill — the earlier framing ("reads as a denser edge") overstated a step that is barely there.
Dropping the stroke entirely is the alternative; it is not taken because the outer half is doing real work on a
crowded canvas, and removing it changes node silhouettes more than this change should.

### Bars and the today marker stop encoding with opacity

| Mark | Today | After |
|---|---|---|
| Active bar — accent at `fill-opacity` 0.75 | 5.46 dark / 3.94 light | **7.85 / 6.47** |
| Archived bar — muted at 0.45 | 2.17 / **1.91** | **5.52 / 5.17** |
| "today" label — accent at `fill-opacity` 0.8 | 6.09 / **4.39** | **7.85 / 6.47** |
| "today" line — accent at `stroke-opacity` 0.5 | 3.00 / **2.35** | **7.85 / 6.47** |

Same lesson as the completed task row: the multiply happens after the colour is chosen, so no contract value reaches
the floor through it. The archived bar fails in both themes even after the host's fix.

**What the opacity was carrying, and what replaces it**: the two bars are 1.42:1 apart dark and 1.25:1 light, so hue
is doing nearly all the work of distinguishing them and the opacity was providing what little lightness difference
there was. Status stays distinguishable by hue plus the active bar's open-arrow terminator — the earlier claim of
"hue and lightness" was wrong about the lightness half.

### Edges cannot use `--spek-border` at all; grid lines are a different question

`--spek-border` at the current `stroke-opacity` 0.6 is 1.20:1 dark / 1.10:1 light, and **at full strength still only
1.22:1 / 1.13:1** worst-of-three. There is no opacity at which it draws a visible edge — it is a panel hairline,
exactly what `fix-theme-contrast` decided to leave alone, and that decision does not transfer to a graph edge, which
*is* the relationship it draws.

Edges move to `--spek-text-muted` at `stroke-opacity` **0.85**: 4.37:1 dark / 3.81:1 light, the lightest step clearing
3:1 with margin (0.75 gives 3.24:1 light, 0.7 gives 2.95:1 and fails).

The timeline's three other `--spek-border` marks — the minor grid at 0.4, the major grid at full strength, and
`ChangeTimeline`'s topic separator at 0.6 — measure 1.05–1.22:1 and **stay as they are**. They are not the only
carrier of anything: a bar's dates are given by the axis labels and by the tooltip, and the topic separator divides a
list whose groups are already labelled. This is the same line the archived change drew around `--color-border`, and
naming these three here is the point — they were measured and judged decoration, not missed.

### Hover dimming: an exemption, stated in both specs

`graph-view` mandates `opacity` 0.1 on non-connected nodes. `theme-toggle` allowed exactly one exception (inactive
components), so this change amends *that* requirement too rather than leaving one spec contradicting another — the
exemption is written where the rule lives, narrowly: a reader-caused emphasis state that ends when they stop causing
it, restores everything, and hides nothing.

Being precise about why, since the delta invites the next reader to overturn it: a node label in the light theme
clears 4.5:1 down to **α ≈ 0.81** (dark, α ≈ 0.73). So it is not true that *no* value passes — it is true that no
value that still reads as de-emphasis does. At 0.81 the graph looks unchanged.

| Label opacity | 0.1 | 0.4 | 0.6 | 0.8 | 0.81 | 1.0 |
|---|---|---|---|---|---|---|
| Light | 1.16 | 1.91 | 2.82 | 4.41 | **4.51** | 7.24 |

The alternatives are dimming the graphics while leaving every label at full strength (labels then float over faded
nodes) or hiding the non-connected labels outright (strictly conformant, and it changes what the interaction does).

### The tooltip's "(ongoing)" marker loses a de-emphasis it cannot afford

`.spekui-tooltip-ongoing` adds `opacity: 0.8` to text that already inherits `--spek-text-muted` from `.spekui-tooltip`
— so it composites **muted**, not the secondary colour an earlier reading of this file assumed: 4.32:1 dark and
**3.68:1 light** with the host's values, 2.94:1 under the package's current default. It is a live failure, not a
value passing by a hair.

Removing the opacity alone would leave "(ongoing)" identical to the "Duration ·" text beside it, because the parent
already sets that colour — a de-emphasis deleted rather than relocated. So it moves to **italic**, which is the one
substitute that costs nothing in contrast.

*(Revised while implementing.* This section first grouped italic with a lighter weight and rejected both as "a second
mechanism for one word". That conflated two different things: a lighter weight buys the distinction back by dimming
the smallest text in the product, and italic does not touch legibility at all. The earlier reasoning was wrong about
italic specifically, and deleting a distinction the author wanted is a worse outcome than keeping it by a means the
obligation has no quarrel with.)

### The guard splits along the line the package cannot cross

**In `packages/ui`** — two tests under `src/__tests__/` (the runner globs `src/**/__tests__/*.test.ts`; a `.test.tsx`
is silently not picked up):

- *No colour literal outside the contract.* Scan `src/**` for hex, `rgb(`/`hsl(`, and CSS named colours, allowing
  only the `:root` block in `styles.css` and `FALLBACKS` in `theme.ts`. **The current source has legitimate matches
  that must not be false positives**: `transparent` in four `color-mix(… , transparent)` declarations and one
  `fill="transparent"`, `rgb(0 0 0 / 0.3)` in a box-shadow, and the substring `white` inside `white-space: nowrap`.
  So the rule is: hex and `rgb(`/`hsl(` are forbidden outside the two sites **except** a fully transparent value, and
  `transparent` is allowed as a whole-token keyword — a colour that renders nothing cannot be theme-wrong. Named
  colours are matched as whole CSS values, never as substrings of a property name.
- *Defaults are legible.* Read the same `:root` block rather than hard-coding hexes — hard-coding would trip the
  first test — and assert each default against the package's own surfaces at the floor for what it carries.

**In `packages/web`**: `contrast.test.ts` today parses `--color-*` inside `@theme` and `[data-theme="light"]` only,
and deliberately ignores the `--spek-*: var(--color-*)` indirections; **none of the eight is measured**. It needs
three additions, not a new row: parse the `:root` mapping block into `--spek-*` → `--color-*`, add a table of
`{spekVar, alpha, floor}` for what the package draws, and assert `contrast(over(fg, α, surface), surface)` — a *fill
over a background*, which is different maths from the existing `tints` (text on a tint of itself) and is not
expressible in either existing table.

### Node labels get a halo — a regression this change created

*(Added during verification.)* Labels are drawn below their own node and never on it, but a force layout drifts other
nodes under them, and a label crossing a node fill measures 1.06–1.84:1 in either theme. Dark was always like that
(1.13:1); **the light theme got worse here**, because giving the fills the saturation they were missing took a spec
node's label from 3.91:1 to 1.48:1. That is this change's doing, so it is this change's to fix.

The labels gain a halo of `--spek-bg-primary` drawn behind the glyphs (`paint-order: stroke`), so a label carries its
own background wherever it lands: 7.64:1 dark, 7.24:1 light, whatever it overlaps. It is a contract colour, so it
follows the host like everything else here.

Fixing label *placement* — collision detection, or leader lines — is the larger answer and is not attempted; the halo
makes the overlap legible rather than making it stop happening.

## Risks / Trade-offs

- **A new contract member is a silent no-op for existing hosts.** → One variable, a legible default, a note for
  consumers, and a name scoped to the mark so a mis-mapping is at least visibly about that mark.
- **The rim buys nothing against its fill (1.31–1.39:1).** → Stated rather than claimed away; kept for its outer
  half. If a reviewer would rather drop the stroke, the measurement is there to decide on.
- **The hover exemption is a deviation, and a lesser dimming does technically pass.** → Both stated, with α ≈ 0.81 in
  the record, so overturning it is an argument about design intent rather than a discovery.
- **"(ongoing)" loses its de-emphasis entirely.** → Named as a deletion. A second mechanism for one word is worse.
- **Archived nodes and every edge now resolve from a *text* token** (`--spek-text-muted`). A host that darkens its
  muted text darkens its archived nodes and its whole edge set with it. → The alternative is two more contract
  members, which is the change this design is trying not to make; the coupling is recorded so a host that dislikes it
  has somewhere to point.
- **The package's guard cannot see a colour computed at runtime.** → It catches literals, which is what has actually
  happened here — eleven times.
