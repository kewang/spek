## Context

`/schemas/:name` draws its workflow diagram in SVG. Every line in it — edge strokes, arrowhead markers,
the archive node's dashed outline, and both legend swatches — resolves `--color-border`, a token whose
value is a panel hairline:

| against | dark | light |
|---|---|---|
| `--color-bg-primary` | 1.42 | 1.18 |
| `--color-bg-secondary` | 1.35 | 1.23 |
| `--color-bg-tertiary` | 1.22 | 1.13 |

`theme-toggle` already requires 3:1 of "a graphical object that is the only carrier of its information",
and `graph-view` already applied that to the `/graph` page's edges, naming `--color-border` as the value
they may not take and recording that "no opacity of it helps". `@spekjs/ui` took `--spek-text-muted` at
0.85. The schema diagram was written afterwards and inherited none of it.

`--color-text-muted` is `#8595aa` dark / `#576882` light:

| | dark | light |
|---|---|---|
| full strength, worst surface | 5.52 | 5.17 |
| at α 0.85, worst surface | 4.37 | 3.82 |
| at α 0.75, worst surface | 3.70 | 3.15 |
| at α 0.70, worst surface | 3.40 | **2.88** |

The 4.37 dark figure is the same number `@spekjs/ui` records for the archived node it draws at that
alpha (`ui-package` spec), which is what makes 0.85 a value to reuse rather than a value to pick. Two
loosenesses in that citation, stated so nobody has to rediscover them: ui's figure is for a **fill**,
which its stroke then follows by `graph-view`'s rule, not for a stroke chosen on its own; and the light
figures in `packages/ui/src/SpecGraph.tsx`'s own comment have drifted (it says 3.81 and "0.75 is only
3.24"; the values are 3.8154 and 3.149). The numbers in this document are computed from `global.css`,
not taken from there.

Separately, the diagram already carries a text occurrence below its floor, which this change is the
first thing to look at it. The selected step is washed in `--color-accent` at 0.10 over the node's own
fill, and the `generates` sub-label is drawn in `--color-text-muted` **on top of that wash**:

| text on a selected step | dark | light |
|---|---|---|
| `--color-text-primary` (step id) | 11.51 | 14.04 |
| `--color-text-secondary` (archive id) | 5.53 | 5.96 |
| `--color-text-muted` (`generates`) | 4.65 | **4.45** |

4.45 is under the 4.5 text floor, in the ordinary case of selecting a step that declares an output. The
existing guard cannot see it: its tint column expresses *a token over a tint of itself*, and this is one
token over a tint of another.

## Goals / Non-Goals

**Goals:**

- Every mark in the schema diagram that carries information clears 3:1 in both themes.
- The legend keeps drawing its swatches in the value of the marks they explain, so the key cannot come to
  state something the diagram is not drawing.
- The palette guard can see the mechanism, so this cannot regress unobserved a second time.

**Non-Goals:**

- Re-authoring `--color-border` itself. It is correct as a panel hairline and is used that way in dozens
  of places; the defect is applying it to something that is not one.
- Changing the diagram's geometry, dash patterns, or what any mark means. `ARCHIVE_DASH` and
  `DERIVED_DASH` keep their values and their split.
- Auditing SVG colour outside `packages/web`. `@spekjs/ui` holds its own contract and its own guard.

## Decisions

**1. Meaning-carrying marks take `--color-text-muted` at α 0.85; ordinary node outlines keep
`--color-border`.**

An arrow is the only thing on the page stating that `specs` depends on `proposal` — the detail panel
states one step's `requires` at a time, and only once a step is selected. The archive node's dash is the
only non-colour cue for "not declared by this schema".

An ordinary step node's outline states nothing its **label** does not, so it stays a hairline. Not its
fill: `--color-bg-tertiary` on the panel's `--color-bg-secondary` is 1.10:1 in both themes, so the fill
is as invisible as the outline and carries none of the load. The label carries all of it, at 13.7:1 dark
and 16.3:1 light. The conclusion is unchanged and the reason for it is not the obvious one — which is
worth writing down, since the standard this change applies to the rest of the diagram is that a sentence
like this survives being measured.

Alternative considered: raise every node outline to a legible value. Rejected — it makes the diagram
uniformly heavier to fix a problem that belongs to one node, and it erases the visual difference between
a node whose outline is load-bearing and one whose outline is trim.

Alternative considered: full strength rather than 0.85. Rejected — 0.85 is the value `@spekjs/ui` already
carries for the same decision, it clears the floor with margin in both themes, and matching it means the
two graphs in this app read as one system.

**2. The hover outline moves from `--color-text-muted` to `--color-text-secondary`, for every node.**

Today hover brightens a node's outline from `--color-border` to `--color-text-muted`, which is a large
step. Once the archive node rests at `--color-text-muted` α 0.85, that same hover would move it to α 1.0
— a step nobody would perceive, so the one node the reader is most likely to hover for an explanation
would be the one that stops responding. Raising hover to `--color-text-secondary` (6.58 dark / 6.92 light,
worst surface) keeps one rule for every node and keeps the step visible in both cases.

Alternative considered: special-case the archive node's hover. Rejected — two rules for a feedback state
the reader is meant to read as one.

**3. The guard enumerates SVG `stroke` / `fill` presentation attributes that resolve a `--color-*`
token.**

`theme-toggle` requires that a mechanism the application begins to use is added to the enumeration or
declared as outside it. It is currently declared outside, from a time when the only such attribute was
the decorative `opacity="0.2"` on a checkmark disc. The diagram now states its meaning through these
attributes, so the declaration has gone stale — which is precisely how this reached master unobserved,
past a CI job whose whole purpose is to catch it.

**The scan is token-resident, not attribute-resident**: it matches every `var(--color-*)` in a non-test
`.tsx` source and requires each occurrence to be measured in the declared table or listed as owing
nothing with its reason. An attribute-scoped scan — `stroke="var(--color-*)"` / `fill="var(--color-*)"`,
with the JSX-expression form — was the obvious shape and is wrong twice over:

- **It cannot see the arrowhead markers**, which are the first call site this change exists for. Their
  colours live in an object literal (`{ id: "schema-arrow", color: "var(--color-border)" }`) and reach
  the element as `fill={color}`. A guard that reports the diagram accounted-for while
  `SchemaGraph.tsx:89` is unscanned, under stated limits claiming SVG `stroke`/`fill` is covered, is a
  fresh instance of the stale declaration this change exists to retire — manufactured by the fix.
- **It has to span lines.** The node outline's ternary runs six of them, so the pattern must be
  multi-line, and a lazy multi-line pattern anchored on `fill=` will bridge one element's attribute to
  the next element's token and report a colour against the wrong thing.

Matching the token instead removes both problems and needs no parsing: in this codebase a `--color-*`
token reaches a `.tsx` file only to colour SVG, because everything else goes through Tailwind utilities.

Companion `strokeOpacity` / `fillOpacity` on the same element is part of the colour and is declared with
it, on the same principle the existing table applies to `bg-<token>/<alpha>`.

What stays outside, and is stated with the scan: a literal colour value rather than a token; a bare
`opacity` / `fill-opacity` / `stroke-opacity` attribute on an element whose colour is **not** a
`--color-*` token, `currentColor` included — the checkmark disc at `ChangeDetail.tsx:71` and the two
marks in `Layout.tsx` are exactly this, and they are also the occurrences the original exclusion was
written about, so a replacement list that omitted them would leave them unscanned beneath a heading
claiming coverage; `style` attributes; and colour reaching SVG through a CSS class. Enumerating a
mechanism is not the same as enumerating every spelling of it, and an unstated limit reads as no limit.

**4. The scan is app-wide, though today the app gives it one place to look.**

Every `--color-*` token in a `.tsx` source is in `SchemaGraph.tsx` or `SchemaFlow.tsx` — 16 occurrences,
13 and 3 — so the scan forces no decision outside the two files this change is already editing. It is
still written app-wide rather than scoped to them: scoped, it becomes a rule about two filenames and the
next component to draw an SVG is unguarded by construction, which is the shape of the defect being fixed.

**5. The `generates` sub-label takes `--color-text-secondary`, rather than the selection wash being
lightened.**

The wash could instead drop from 0.10 to about 0.06, which brings the existing pairing to 5.00 dark /
4.72 light. It is rejected because `--color-text-muted` has no room in the light theme: it measures 5.17
against the bare node fill, so that is its ceiling, and *any* tint spends the 0.67 between there and the
floor. Lightening the wash buys about 0.2 of margin and hands the next person who re-authors
`--color-accent` or `--color-bg-tertiary` the same defect back. `--color-text-secondary` clears it at
5.53 dark / 5.96 light on the wash and 6.58 / 6.92 off it.

The cost is that the sub-label is less muted than it was. Size, weight and the monospace face still
separate it from the step id above it, and the step id is `--color-text-primary`, so the hierarchy is
carried by three signals rather than four.

Alternative considered: keep `--color-text-muted` and switch to `--color-text-secondary` only while the
step is selected. Rejected — it makes the colour conditional on a state to compensate for a tint drawn
by that state, which is correct and unreadable, and it gives the guard a pairing that only exists some
of the time.

## Risks / Trade-offs

- **The diagram reads heavier than it did.** → Only the marks that carry meaning move, and they move to a
  value already in use for the same purpose one page over. The nodes, which dominate the diagram's visual
  weight, are untouched.
- **The new scan surfaces occurrences whose right answer is not obvious.** → There are 16, all in the two
  files being edited, and each is decided the way the existing table decides one: measured against the
  floor for what it carries, or declared with a reason that can be argued with. One of them was already
  under its floor before this change touched anything, which is the argument for the scan rather than
  against it.
- **A token-resident scan matches a token used for something other than SVG.** → Today none is: a
  `--color-*` token reaches a `.tsx` file only to colour SVG, since everything else goes through Tailwind
  utilities. If that stops being true the scan reports an occurrence that needs a declaration rather than
  a measurement, which is a decision it is entitled to force, not a false positive.
- **`--color-text-muted` is re-authored later and drags these marks with it.** → That is the intended
  coupling, and it is why the marks take a token rather than a literal. The guard measures the token, so a
  re-authoring that breaks the floor fails the check rather than the eye.
- **The hover change touches nodes this issue is not about.** → It is one line and one rule, and it
  strengthens the feedback everywhere rather than trading it away. The alternative was two hover rules.
