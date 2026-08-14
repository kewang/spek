## Context

The failing colours divide into three populations, and they need different treatment:

- **Hard-coded palette classes** — `text-red-400`, `text-green-400`, `text-amber-400`, `text-yellow-400`, applied
  identically in both themes across 11 files. There is no light value to fix, because there is no light value at all.
- **Tokens whose value drifted** — `--color-accent` / `--color-accent-hover` in the light theme, and
  `--color-text-muted` in **both**. These are per-theme already; the values are simply wrong.
- **One failure no token can reach** — `opacity-60` on a completed task row, which fails in the dark theme too. See
  "What fails in the dark theme" below; it is the reason this change is not light-only.

Both were reachable because the `theme-toggle` spec asks the light theme to *define* the variables and says nothing
about what they may be. The change for #42 solved exactly this for the markdown renderer's own marks; the shape of that
fix — dark keeps the shade it already had, light is re-authored, and the obligation is written into the spec — is the
shape reused here.

Two facts about the codebase set the constraints:

- Text lands on **three surfaces** per theme (`bg-primary` / `bg-secondary` / `bg-tertiary`), and there is no map of
  which text uses which.
- Several colours are used as **text on a tint of themselves** — `bg-accent/10 text-accent` (sidebar nav, fold
  controls, spec tabs), `bg-accent/15` (timeline), `bg-accent/20` (search highlight and the selected result, and the
  same 20% inside `@spekjs/ui`), `bg-green-400/10 text-green-400` (diff rows, timeline status), `bg-text-muted/10
  text-text-muted` (inactive status). A tint of the text's own colour moves the background *toward* the text, so these
  are strictly harder than the plain case, not easier.

## Goals / Non-Goals

**Goals:**

- Every colour applied to text clears WCAG 2 AA 4.5:1 in **both** themes, on every surface it can land on and on its
  own tint where it is used that way.
- The rule that keeps it true is stated in the spec and enforced by a test that can fail. The obligation and the guard
  are symmetric across themes even where only one theme currently needs a new value — an asymmetric rule is how the
  light theme drifted while the dark one was watched.
- Every dark value that already passes keeps the exact colour it has. Dark is changed only where it is measured
  failing, because a change of appearance that fixes nothing is a restyle wearing a fix's clothes.

**Non-Goals:**

- `--color-border`. It is a panel edge at 1.4:1 dark / 1.2:1 light, and it is decorative — the same judgement
  `--color-fold-rule` already records, which exists precisely because a *normative* mark could not use the border value.
- Badge outlines (`border-accent/40`, `border-status-warning/40`). Non-text at ~1.8–2.6:1, but the badge's own text
  carries the state; the outline is not the indicator, so 1.4.11 does not bind it. Listed here so the next reader knows
  it was measured, not missed.
- The warning / accent hue collision (see Risks). Separating them is a restyle.
- Widening the muted ↔ secondary step by moving `--color-text-secondary` (see Risks).
- The renderer's BDD marks — already correct (4.86:1 at worst, dark, on `badge-removed`) and already specified.
- **`@spekjs/ui`'s own colours, which are *not* already correct.** The package inherits the eight `--spek-*` contract
  variables from these tokens, so it gains what the tokens gain — the tooltip's active status goes 2.37 → 4.75 and
  the active timeline bar 2.29 → 3.94 in the light theme, both from the accent alone, with no package change and no
  version bump. But `SpecGraph` paints its nodes from hex literals (`#f59e0b` and `#22c55e` at `fill-opacity` 0.85 →
  **1.85** and **1.96** against the light page, where a graph node is normative per `graph-view`), the legend swatches
  are the same two literals solid (2.05 / 2.27), and `TimelineBar`'s archived fill is `--spek-text-muted` at 0.45 →
  1.44 today and still 1.91 after this change, failing in **both** themes. None of it is reachable from
  `global.css`, and none of it is visible to the guard, which scans class literals.
  A follow-up change owns them, for three reasons: the package is a separate release line with its own CHANGELOG and
  version; the mechanism is different (hex literals in TSX and SVG opacity attributes, not CSS custom properties);
  and `graph-view` needs a spec delta of its own before any of it can be fixed (see Risks).

## Decisions

### What fails in the dark theme

The dark theme was audited the same way as the light one rather than assumed sound, because "dark passes" is precisely
the assumption that let the light values drift. Every text colour, at its worst surface, and every mark on its own
pill fill:

| Dark | Measured | |
|---|---|---|
| `text-primary` 13.68, `text-secondary` 6.58, `accent` 7.85, `accent-hover` 5.29, `code-text` 7.85 | pass | unchanged |
| The 7 BDD marks on their 20% fills (`badge-removed` 4.86 … `kw-then` 6.60), and `kw-normative` plain at 5.84 | pass | unchanged |
| The three shades the hard-coded classes become — red-400 5.84, green-400 9.48, amber-400 9.79 | pass | kept as the dark value of the new tokens |
| **`text-muted` `#64748b`** | **3.54** (4.11 on `bg-primary`) | **fails — re-authored** |
| **Every part of a completed task row (`opacity-60`)** — body text 3.24, link 3.64, inline `<code>` 3.55 | **3.24** | **fails — see below** |

So dark carries two of this change's fixes, not zero. The first was already in the proposal — `--color-text-muted` is
the one token that fails on both sides. The second was found while measuring for this design, is new scope, and is the
worse of the two.

### Completed tasks are de-emphasised with a colour, not with opacity

`ChangeDetail` marks a completed task with `opacity-60` on the row and `text-text-secondary line-through` on the text
inside it. Opacity on the row composites *everything* under it toward the page — the body text, and every child that
sets its own colour:

| Completed task row, as it ships | Dark | Light |
|---|---|---|
| Body text (`text-text-secondary` at 60%) | 3.24 | 2.77 |
| A link (`text-accent` at 60%) | 3.64 | 1.89 |
| An inline `<code>` chip, fill and text both faded | 3.55 | 1.87 |
| The green checkmark, `text-green-400` at 60% (non-text, needs 3:1) | 4.19 | 1.41 |

Nothing in the row passes in either theme, and `tasks.md` in this repo is full of links and code spans. **No token
value can repair it** — the opacity is applied after the colour is chosen, so every candidate for `--color-accent`
fails there by construction; the light theme's failure even gets *worse* as the accent darkens, because a darker
colour has further to travel toward a light page.

The row therefore loses `opacity-60`, and the completed text takes `text-text-muted` in place of
`text-text-secondary` — 5.52 dark / 5.17 light, still a visible step below an open task's `text-text-primary`
(13.68 / 16.30). The strikethrough and the checkmark icon stay; the icon at full strength is 9.48 / 6.51.

Two things follow, both stated plainly:

- A link inside a completed task will no longer look dimmer than a link inside an open one. De-emphasis that reaches
  below readability is not de-emphasis, and the strikethrough, the icon and the muted body already carry the state
  three times over.
- **`change-browsing` mandates the broken technique** — "Completed task text SHALL have reduced opacity (0.6)" — so
  this needs a spec delta, not just an edit. It is the same failure shape as `theme-toggle`: a requirement that
  specifies a *mechanism* nobody measured, and the implementation was correct with respect to it the whole time.

`disabled:opacity-50` on the sidebar's refresh button stays. WCAG 1.4.3 exempts inactive UI components, and that is
what it marks.

### Three status tokens, and the diff reuses two of them

`--color-status-error` / `--color-status-success` / `--color-status-warning`, declared in `@theme` so Tailwind emits
`text-status-error` and `bg-status-error/10` — the same mechanism `--color-kw-*` already uses.

The spec diff's added / removed lines take `success` / `error` rather than a `--color-diff-*` pair of their own. A
token names a role, and two roles that must always hold the same value are one token — the alternative is the same hex
written twice with nothing keeping them equal. If the diff's hues ever need to diverge from the status hues, *that* is
when the pair gets introduced.

`text-yellow-400` (SelectRepo's "No openspec/ directory found") folds into `warning` alongside `text-amber-400`. The
two differ by ΔEok 0.034 today — a distinction nobody chose and nobody can see.

### What a value is measured against

Each text token is measured against **the worst of its theme's three surfaces**, plus **its own tint at each alpha the
code actually uses**. Dark's worst surface is `bg-tertiary` (#1a1d24, the lightest); light's is also `bg-tertiary`
(#f1f5f9, the darkest).

The alternative — measuring each usage against the surface it really sits on — needs a per-usage map that must be
maintained by hand and is wrong the moment a component moves. Worst-case needs nothing maintained and cannot be gamed.
The cost is that a token used only on `bg-secondary` is held to a slightly stricter value than it needs; measured, that
is 0.2–0.6 of a ratio point.

### Values

Dark keeps the shade the class already named — with `--color-text-muted` as the single exception, because it is the
one dark value measured failing. Light is re-authored, reusing the light values #42 introduced where the
role matches (`error` = light `kw-normative`, `success` = light `kw-then`), so the light theme has one red and one
green rather than two of each.

| Token | Dark | worst / on tint | Light | worst / on tint |
|---|---|---|---|---|
| `--color-status-error` | `#ff6467` (red-400, unchanged shade) | 5.84 / 5.13 @10% | `#c10007` (red-700) | 5.86 / 4.88 @10% |
| `--color-status-success` | `#05df72` (green-400) | 9.48 / 7.85 @10% | `#016630` (green-800) | 6.51 / 5.60 @10% |
| `--color-status-warning` | `#ffb900` (amber-400) | 9.79 / — | `#bb4d00` (amber-700) | 4.59 / — |
| `--color-text-muted` | `#64748b` → `#8595aa` | 5.52 / 4.78 @10% | `#94a3b8` → `#576882` | 5.17 / **4.55** @10% |
| `--color-accent` | `#f59e0b` (unchanged) | 7.85 / 5.37 @20% | `#d97706` → `#92400e` (amber-800) | 6.47 / 4.75 @20% |
| `--color-accent-hover` | `#d97706` (unchanged) | 5.29 / — | `#b45309` → `#7b3306` (amber-900) | 8.27 / — |

Three of these are worth stating — two because the value is not the obvious one, one because its margin is thin:

- **The accent's binding constraint is the 20% tint, not link text.** Amber-700 `#b45309` clears 4.58 as plain text —
  the naive fix — but the search highlight puts accent text on `bg-accent/20`, which drops it to 3.50. Two ramp steps
  down is what survives that. `#92400e` is not v4's amber-800 (`#973c00`, the value the warning bullet rejects below);
  it is the value the light theme already carries as `--color-code-text`, which is the better way to name it — the
  light theme gains no new amber, it reuses the one it has. This also repairs `bg-accent text-bg-primary` (the
  Select-repo button), which was failing at 3.04 and nobody had noticed, and it is inherited by `@spekjs/ui`, whose
  spec badge uses the same 20% — measured there at 2.57 today and 5.16 after.
- **Light `--color-text-muted` passes its own tint by 0.05, and that is the tightest margin in the change**
  (4.548 against a 4.5 floor, on the inactive status pill's `bg-text-muted/10`). Darkening it further is available
  and cheap — `#55637a` gives 4.86 — but every step down also narrows the muted ↔ secondary gap this change already
  costs (see Risks). The value stays, the margin is recorded, and the guard measures the exact figure rather than a
  rounded one so the pass is real rather than presentational.
- **Warning sits one ramp step brighter than the accent, in both themes.** Dark already reads that way (warning
  amber-400 against an accent near amber-500); amber-700 over amber-800 keeps it. The darker amber steps score better
  on paper — `#973c00` reaches 6.47 — but collapse into the accent (ΔEok 0.011 against 0.090 for amber-700), and a
  warning that is the link colour is not a warning. 4.59 is a thin pass, and deliberately so: it buys the only
  separation available inside the family. It has no tinted usage today; the guard will say so if one is added.

### Fills follow their text

Where a fill exists only to tint the background under text of the same colour, it moves to the same token:
`bg-green-400/10` → `bg-status-success/10`, `bg-red-400/10` → `bg-status-error/10`. Otherwise the composite the guard
models is not the composite that renders. `text-amber-400/90` (the offline notice) loses its alpha for the same
reason — the alpha was lowering an already-failing value, and the token makes it unnecessary.

The renderer's BDD pill fills (`bg-blue-500/20` and friends) stay as they are. They are a *different* hue from the text
they sit under, they are already specified and measured by `markdown-renderer`, and CLAUDE.md records the reason they
are plain classes.

### One non-text case is included: the task progress bar

`TaskProgress` draws its complete state as `bg-green-500` on a `bg-bg-tertiary` track — 2.02:1 in the light theme,
below the 3:1 that 1.4.11 asks of a graphical object. Unlike a badge outline, the bar's fill *is* the information;
there is no text beside it saying "complete". It becomes `bg-status-success` (6.51 light, 9.48 dark). The in-progress
`bg-accent` fill was failing the same way at 2.91 and is fixed by the accent's new value alone.

### The guard: two tests, one file each side of the rule

`packages/web/src/styles/contrast.test.ts` (node:test + tsx, like every other web test):

1. **Ratios.** Parse `global.css` into the dark map (`@theme`) and the light map (`[data-theme="light"]` over the dark
   map), then assert a declared table of (token, alphas-it-is-tinted-at) against every surface. The contrast maths
   lives in the test — nothing in the app computes contrast at runtime, and a `utils/contrast.ts` nothing imports is
   dead code with a type-check bill.

   Parse the two blocks, not the file: a whole-file scan for `--color-…:` also collects `--color-fold-lead: 1.25rem`
   and `--color-fold-trail: 1rem`, which are **lengths** wearing the colour prefix, and the eight
   `--spek-*: var(--color-*)` indirections. Neither block contains nested braces, so block extraction is the same
   `\{([^}]*)\}` idiom `MarkdownRenderer.keyword.test.ts` already uses on this file — copy the idiom, not the
   whole-file read. And `--color-fold-rule` is a colour in `@theme` with **no** light override on purpose, so any
   "every colour has a counterpart in both blocks" assertion is wrong before it is written.
2. **No hard-coded palette text class.** Walk `packages/web/src`, fail on `text-<family>-<shade>` (with its variants:
   `hover:`, `focus:`, `group-hover:`) for any Tailwind palette family. This is the half that stops the class of defect
   returning — the values can be correct today and re-broken by the next `text-red-400`. It matches `text-` only, so
   the pill fills stay legal.
3. **No bare `opacity-*` on content.** Fail on an unprefixed `opacity-<n>` class, allowing `disabled:`-prefixed ones.
   Opacity is the one mechanism that defeats the token rule entirely — it lowers a contrast that was chosen correctly,
   after the fact, for every child at once — and (1) cannot see it, because the value it damages is not in
   `global.css`. After this change there is exactly one `opacity-*` left in `packages/web/src` and it is
   `disabled:opacity-50`, so the rule needs no exception list. A future de-emphasis that genuinely needs opacity will
   have to argue with this test, which is the intent.

The table in (1) is hand-written, which is its weak point: a new tinted usage at an alpha nobody declared would go
unmeasured. So (2) also asserts that every `bg-<token>/<alpha>` literal in the source has an entry in the table —
the pairing cannot be discovered reliably (`SpecDiffViewer` builds its classes in separate variables, so no scanner
sees them on one element), but the *existence* of an unmeasured alpha can be.

**That check needs an explicit allowlist of which tokens it applies to, or it fails on day one.** `packages/web/src`
holds 13 `bg-…/…` literals and 11 of them must never be in the table: two scrims (`bg-black/50`, `bg-black/60`),
three surface-on-surface alphas (`bg-bg-tertiary/80`, `bg-bg-primary/50`, `bg-bg-tertiary/50`) and the eight BDD pill
fills. The rule is "a *text* token used as a tint", so the allowlist is the text tokens themselves — the same list the
table's rows are keyed by.

What none of the tests can see, and what therefore has to be looked at:

- **A colour that never appears as a class.** `ChangeDetail`'s checkmark draws its own disc with an SVG
  `opacity="0.2"` presentation attribute — a success/20 tint that no class scanner and no CSS parser will ever find.
  It passes (6.20 dark, 4.77 light against the 3:1 floor), but it passes unobserved.
- A token used as text over a surface the table did not anticipate.
- Anything about the VS Code webview's injected stylesheet. The webview still needs looking at.

## Risks / Trade-offs

- **The muted ↔ secondary step narrows in both themes.** 4.5:1 puts a floor under muted while secondary already sits
  just above it, so the two converge: ΔEok 0.156 → 0.046 dark, 0.265 → 0.068 light. Both remain distinguishable and
  ordered, but the hierarchy is flatter than it was. → Restoring the gap means moving `--color-text-secondary` away
  from the floor (darker in light, lighter in dark), which is a restyle of text that passes today. Deliberately not
  done here; it is the change to make if the flatness reads badly in review.
- **Warning and the accent stay in one hue family.** Light separates them by ΔEok 0.090, which is *wider* than dark's
  existing 0.069 — so this is not a regression, but the ChangeList jj badges ("editing" = accent, "conflicts with" =
  warning) still sit side by side in near-identical amber. → Fixing it means giving warning a different hue, and every
  neighbouring hue is either the error red or the accent itself.
- **This change leaves one spec contradicting another, knowingly.** The new requirement says opacity may not push
  text below the floor, with inactive UI components as the only exception. `graph-view` says "All non-connected nodes
  and edges SHALL reduce opacity to 0.1" — labelled nodes, dimmed to 1.08:1 light / 1.14:1 dark by a hover
  interaction, which is not an inactive component. It is the same failure shape this change found in
  `change-browsing`: a requirement specifying a *mechanism* nobody measured. → Resolving it means deciding whether a
  transient focus interaction earns an exception or the dimming needs a floor, and that decision belongs with the
  `@spekjs/ui` follow-up that would implement either answer. Recorded here rather than settled, so the next reader
  finds it as a known conflict rather than as a surprise.
- **The opacity rule is blunt, and that is the point at which it can annoy someone.** It forbids a legitimate
  technique because the technique cannot be checked — an `opacity-60` on a decorative icon is harmless, and the test
  will still fail it. → The escape is `disabled:`, or replacing the opacity with a token; both are one edit, and the
  alternative (an allowlist of "safe" opacity sites) is a list nobody updates. Alpha in a *background* utility
  (`bg-black/60` on the search scrim) is untouched — it is not applied to text.
- **Light muted and light accent shift visibly** (`#94a3b8` → `#576882`, `#d97706` → `#92400e`). The light theme will
  not look like the README screenshots. → Retaking them is release-time work, already recorded in the proposal's
  Impact; nothing in this change touches them.
- **The renderer's marks remain unguarded by the new test.** Their obligation is specified but their backgrounds are
  Tailwind palette tints, so measuring them would mean pinning framework hexes in our test and drifting silently on the
  next Tailwind upgrade. → Left out on purpose, and stated here so it is not read as an oversight.
- **The values were computed, then seen in a browser but not in a host.** Every ratio above comes from the sRGB
  formula over the hexes; alpha composites are modelled as `α·fg + (1−α)·bg` in sRGB, which is what the browser does
  but not what the test can observe. The light theme was checked in a browser — the diff, an error state, the Tasks
  tab, `/timeline`, `/graph` — and the computed styles read back from the live DOM (`#c10007` on an error, `opacity:
  1` and `#576882` on a completed row, a full-strength `#92400e` on the code span inside it).
  → **The VS Code webview and the IntelliJ tool window were deliberately not looked at.** Both bundles were rebuilt
  and the new values confirmed present in each, so the tokens ship; what stays unverified is the one thing only a
  host shows — VS Code injects its own stylesheet into our document and styles bare elements from *its* theme, which
  no browser check and no test can reproduce. The risk is small here because this change sets colours on elements
  that already carried classes and adds no bare-element styling, but it is not zero, and it is the class of bug that
  has shipped from this repo before.
