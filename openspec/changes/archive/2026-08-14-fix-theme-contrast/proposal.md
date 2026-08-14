## Why

The light theme fails WCAG 2 AA across the app. Every failing colour has the same root cause: it is a
hard-coded Tailwind palette class applied identically in both themes, and the 400 shades those classes
name are tuned for dark backgrounds — no 400 shade in any v4 family reaches even 3:1 against the light
theme's `#f8fafc`.

The light theme is reachable by default, not opt-in: `prefers-color-scheme` on the web, VS Code's
`ColorThemeKind`, IntelliJ's theme sync. So this is what a reader gets, not a mode they chose. The
sharpest case is an error message at 2.76:1 — an error the reader cannot read is worse than no error —
and the worst measured is the spec diff's added lines at 1.70:1, sitting directly beside removed lines
that are merely bad.

**The dark theme is not exempt, and was audited rather than assumed.** Two of its values fail: `--color-text-muted`
at 3.54:1, and everything inside a task row marked complete with `opacity-60` — body text at 3.24:1, a link at
3.64:1, an inline code span at 3.55:1. Everything else in dark — every other text token, and the BDD marks on their
fills — measures 4.86:1 or better and keeps the exact value it has.

Ratios throughout are the **worst of the theme's three surfaces**, which is the rule the change adopts and the reason
some figures differ from an earlier reading of the same colours: light `--color-text-muted` is 2.34:1 on
`bg-tertiary`, not the 2.45:1 it manages on `bg-primary`.

The change for #42 re-authored the markdown renderer's own marks (BDD keywords, badges, inline code) as
per-theme tokens and stated the obligation for that capability. This is the same fix for the remainder of
the app, and the same obligation stated where the palette itself lives.

## What Changes

- **Error, success and warning text become per-theme tokens.** Every hard-coded palette class applied to
  text in `packages/web/src` is replaced: `text-red-400` (16 occurrences, 11 files), `text-green-400` (6),
  `text-amber-400` (2), `text-yellow-400` (1). Measured on the light background: 2.76 / 1.70 / 1.65 /
  1.50:1 respectively.
- **`--color-text-muted` is re-authored in *both* themes.** It is the one token that fails on both sides —
  3.54:1 dark, 2.34:1 light — and it carries timestamps, empty states and secondary labels throughout
  (96 usages).
- **`--color-accent` and `--color-accent-hover` get light values that clear 4.5:1.** Amber is the app's
  link and navigation colour; at `#d97706` on `#f8fafc` it measures 3.04:1, so this is every link.
- **Completed tasks stop being de-emphasised with `opacity-60`.** Found while measuring for the design, and the worst
  case in the change: the class sits on the whole task row, so it fades the body text *and* every child that sets its
  own colour. Nothing in the row passes in either theme — body text 3.24 dark / 2.77 light, a link 3.64 / 1.89, an
  inline `<code>` 3.55 / 1.87, and the green checkmark 4.19 / 1.41 against a 3:1 non-text bar. No colour value can
  repair it, since the opacity is applied after the colour is chosen. The row drops the opacity and its text takes
  `--color-text-muted`.
- **The task progress bar's complete state becomes a token.** `bg-green-500` against its `bg-bg-tertiary` track is
  2.02:1 in the light theme, under the 3:1 that non-text contrast asks — and unlike a badge outline, the bar's fill is
  the only thing saying "complete".
- **The obligation is stated in the spec**, not just satisfied once: the palette must be readable in every
  theme, and a colour applied to text must come from a per-theme token rather than one literal shared by
  both themes. The second half is what stops the class of defect returning — the values can be fixed
  today and re-broken by the next hard-coded class.
- **A regression guard that can actually fail.** `global.css` is already parsed by tests for the fold
  rule's geometry; contrast is a pure computation over the same file, so the token ratios are asserted
  rather than measured by hand once.

Hue is preserved where the darker value allows: this is a contrast fix, not a restyle. Nothing here is
breaking, and no public API changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `theme-toggle`: the existing "Light theme CSS variables" requirement says the light theme must *define*
  the variables; it says nothing about what they may be, which is exactly how every value drifted to an
  unreadable one while the specification stayed satisfied. Adds the readability obligation — for **every**
  theme, since the dark one has its own failures — and the per-theme-token rule that keeps it enforceable.
- `change-browsing`: "Custom task checkbox styling" currently *mandates* the defect — "Completed task text SHALL have
  reduced opacity (0.6)". It specifies a mechanism nobody measured, so the implementation has been correct with
  respect to it the whole time. The requirement is restated in terms of what de-emphasis must achieve (a visible step
  below an open task, without dropping below the readability floor), with the mechanism left to the palette.

`markdown-renderer` already carries the same obligation for the renderer's own marks (added by #42's
change, measured against each mark's composited pill background) and is unchanged here. `spec-diff` states
that added lines are green and removed lines red — still true after the fix, so its requirements are
unchanged too.

## Impact

- **`packages/web/src/styles/global.css`** — new status text tokens with per-theme values; re-authored
  `--color-text-muted` (both themes), `--color-accent` / `--color-accent-hover` (light).
- **11 files in `packages/web/src`** — `SpecDiffViewer`, `MarkdownRenderer`'s neighbours in
  `components/`, and the `pages/` that render `Error: {error}`: `ChangeDetail`, `ChangeList`, `Dashboard`,
  `GraphView`, `SchemaDetail`, `SchemaList`, `SelectRepo`, `SpecDetail`, `SpecList`, `TimelinePage`. Plus
  `TaskProgress` for the bar's complete state, and `ChangeDetail`'s completed-task row for the opacity.
- **`@spekjs/ui`** inherits `--spek-text-muted` / `--spek-accent` from these tokens by the existing
  mapping, so the graph and timeline gain what the tokens gain — the tooltip's active status 2.37 → 4.75, the active
  timeline bar 2.29 → 3.94 — with no package change and no version bump. **It does not finish the package**: its
  graph nodes and legend swatches are hex literals (1.85 / 1.96 / 2.05 against the light page, where a graph node is
  normative), and the archived timeline bar fails in both themes (1.44 light, 1.73 dark, and still 1.91 / 2.17 after
  this change). Those are a **follow-up change** — a separate release line, a different mechanism (hex literals and
  SVG opacity attributes, neither reachable from `global.css` nor visible to the guard), and a `graph-view` spec that
  mandates `opacity 0.1` on labelled nodes and so contradicts this change's opacity clause until it is re-decided.
- **VS Code and IntelliJ** ship the same SPA, so both get the fix from a webview rebuild; no host code is
  touched. The VS Code webview is where a host stylesheet can interfere, so the fix must be verified in
  the real webview, not only in a browser.
- **For whoever cuts the next release**: muted text and the accent shift visibly in both themes, so the
  README screenshots no longer show what a reader will see. Retaking them is release-time work, not part
  of this change.
