# Changelog

## 1.14.0

**Highlight: the light theme is readable.** The tool window follows the IDE's theme, so this is what a reader gets rather than a mode they chose, and nearly every colour in the light one failed WCAG AA. An error message measured 2.76:1; the spec diff's added lines 1.70:1, sitting directly beside removed lines that were merely bad. The dark theme was audited on the same terms and carried two failures of its own.

- **Error, success and warning colours are now defined per theme.** Each was one shade applied to both, and none of them reaches even 3:1 on a light background — the spec diff's added and removed lines, every page's error message and the jj conflict badge all failed there
- **Secondary text is readable in both themes.** Timestamps, counts and empty states measured 2.34:1 light and 3.54:1 dark
- **Links, the active sidebar item and search highlighting** take a deeper amber in the light theme; the previous one was 3.04:1 as text and 3.50:1 behind a search hit's tint
- **A completed task no longer fades its own links and code spans.** The row carried 60% opacity, which composites everything beneath it — its body text measured 3.24:1 dark and 2.77:1 light. Completion is marked by colour now, with the strikethrough and checkmark unchanged
- **The task progress bar's complete state is distinguishable from its track** — 2.02:1 before, in the light theme
- **The graph and the timeline follow the theme.** Node fills, legend swatches and the archived timeline bars were hard-coded colours no theme could reach; the graph's spec nodes measured 1.85:1 on a light page and its archived nodes 2.93:1 in the dark one. Edges are now drawn in a colour that can be seen, labels carry a halo where they overlap a node, and the "today" marker is at full strength
- **A CLI failure is no longer remembered for the full cache window.** An unreachable `openspec` binary left the schema pages reporting "unavailable" for 30 seconds after the cause was fixed; a failure that resolves is now retried on the next read, while one the installed CLI reproduces identically is still cached ([#46](https://github.com/spekhq/spek/issues/46))
- **Building from source works on Windows.** `@spekjs/core` and `@spekjs/ui` used Unix-only `rm -rf` / `cp` in their build scripts, so `npm run build` failed under `cmd.exe`. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) ([#47](https://github.com/spekhq/spek/pull/47))

## 1.13.1

**Highlight: the rule beside an open section now starts and ends where its content does.** 1.13.0 gave each requirement its own rule and a gap between them, but the rule was drawn down the section's *box* — and a box holds two spaces its content does not. Reported from this tool window (issue #42), where a narrow width makes the spacing count most.

- **The rule starts at its heading, not 20px above it.** That space is also what separates a section from the one before it, so of the 28px between two requirements, 20px was drawn as rule — 1.13.0's gap was real but invisible, and a page of requirements still read as one interrupted line with a notch in it
- **And it ends at the last of its content**, instead of running past it. The trailing space below a section's last paragraph sits inside the box too, so the rule overshot the thing it was marking by a further 20px — plainest under the last scenario of a requirement
- **An open requirement's heading no longer sits 1px right of a closed one's.** The rule used to be a border, which inset everything inside an open section; drawn as its own element it does not. Headings and disclosure arrows now line up down the page regardless of open state
- **The rule stays visible in high contrast themes**, where the previous drawing method would have been discarded
- A scenario written with no requirement above it now takes a top-level section's spacing, 4px lower than before: how much room a section leaves above its heading follows its nesting, not its heading level

## 1.13.0

**Highlight: a requirement is now called what it is named.** Every requirement heading in a spec opened with the word `Requirement:` and every scenario with `Scenario:` — the same twelve characters at the front of every heading in the document, taken from exactly where a reader scans for what distinguishes one from the next. Suggested from this tool window (issue #42), which is where the cost is plainest: at a few hundred pixels of width, the boilerplate stays and the distinguishing part is what truncates.

- **Requirement and scenario headings drop their format keyword**, in the rendered spec and in its table of contents. This became removable only in 1.12.0: before the `ADDED Requirements` label was restored to visibility, the keyword was the only thing naming what these sections were. Presentation only — your files, every heading id and every deep link are untouched
- **The rule beside an open section now marks that section.** Consecutive requirements drew rules that met, forming a single unbroken line down the whole page: a bracket around everything says the same as no bracket at all. Each requirement now carries its own, ending where the requirement ends. A nested open scenario no longer draws a second rule of equal weight beside its parent's — the doubling read as one ornament repeated rather than as two levels
- **Expanding a scenario no longer nudges the rest of the page.** The gap between sections depended on what the last visible element inside one happened to be, so opening a scenario pushed every requirement below it down by a further 8px
- **A little more room around the fold** — the body sits further from the rule, and the disclosure arrow is no longer drawn against it

## 1.12.0

**Highlight: spek now shows the workflow itself, not just its output.** A schema decides what a change *is* in OpenSpec — which artifacts exist, what order they come in, what each is supposed to contain, and when the change is ready to implement. Until now it appeared only as a small badge on a change that differed from the project default: a name with nothing behind it.

- **New Schemas page** listing every workflow schema available to the project, with its description, its source (shipped with the `openspec` package, or project-local under `openspec/schemas/`), and how many artifacts it defines. The schema named by `openspec/config.yaml` is marked as the default, and each schema shows how many active changes declare it, with a link through to them. The plugin reads schemas through its own Kotlin implementation, aligned with the same rules. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen)
- **A schema detail view that reads as a workflow** — its artifacts in authoritative order as a diagram, each showing the file it generates, what it requires before it can be written, and its full instruction text. The `apply` step is drawn as the flow's terminal step
- **When the OpenSpec CLI cannot answer, the page says so.** If the CLI is missing, exits non-zero, times out, or emits something unparsable, the list comes back empty *with the reason stated*, rather than as an unexplained empty page
- **Spec content is now ranked by structure rather than by inherited type size.** In a change's Specs tab the spec's own name was smaller than the `ADDED Requirements` label inside it, so a reader scrolled past the boundary between two stacked specs without registering that one occurred. The topic name is now the dominant heading of its section, the operation label is demoted, and an open section is inset with a hairline rule marking where it ends. Reported from this tool window, where a narrow width makes the ranking matter most (issue #42)
- **Every delta operation is marked, not an arbitrary two.** `REMOVED` and `RENAMED` had no styling of their own, so in prose they read as ordinary words. `REMOVED` deliberately does not take red: red already means "normative" (`MUST` / `SHALL`) here

## 1.11.0

**Highlight: a spec opens as an outline with substance, instead of a wall of text.** This was reported from this plugin (issue #42): "you are asked to read all these fine details, but you don't even really know the shape of the thing first." A tool window is narrower than a browser window, which made the wall worse here than anywhere else.

- **Requirements and scenarios fold in place.** Each `### Requirement:` shows its heading *and* its lead SHALL paragraph; each `#### Scenario:` shows as a heading with its WHEN/THEN body collapsed. Scenario blocks are 59% of the character volume in a typical spec — so the first screen becomes a contents page that still says what each requirement requires. Expand all / Collapse all is available, and your choice is remembered. This does **not** depend on the tool window's width, unlike the table of contents, which stays hidden below 1280px
- **Find-in-page still finds folded text, and links still land.** Folding uses the browser's native disclosure elements rather than hiding content with CSS, so a find reaches text inside a collapsed scenario. Navigating to a heading expands whatever encloses it before scrolling, so a link never arrives at something invisible
- **Folding applies only to spec-shaped content** — the spec detail page and a change's Specs tab. Proposal, design and other markdown artifacts render unfolded exactly as before
- **Every BDD keyword is legible in the light theme.** WHEN / THEN / SHALL and the rest were hard-coded to one set of colours shared by both themes, and against the light background all 8 failed WCAG AA — 7 below even 3:1, with `THEN` at **1.43:1**. The dark theme passed everywhere, which is why this went unseen. Light now has its own values in the same hue families, clearing AA at 5.17–6.47:1; dark is unchanged byte for byte, and no hue or pill fill moves on either theme
- **A highlighted keyword no longer renders lighter than the emphasis around it.** A keyword inside `**bold**` was drawn at a lower font weight than the bold text containing it
- *Internal:* the Kotlin task parser is now verified against the same shared fixture corpus as the TypeScript one, so a case added in either language is asserted by both from the next run. This is what keeps the two from drifting apart on the same `tasks.md`

## 1.10.1

- **A `tasks.md` whose lines don't end in a plain newline is counted the same here as on the other surfaces.** The plugin re-implements the task parser in Kotlin, and Java's regex engine reads a trailing carriage return differently from JavaScript's — so a file using carriage-return line endings, or carrying a stray `\r`, produced a different task count in the IDE than in the Web and VS Code viewers reading the same repo. Both implementations now follow CommonMark, which counts a lone `\r` as a line ending like any other (issue #33)
- **An invisible-whitespace line is treated the same way on every surface.** Kotlin and JavaScript disagree about which characters count as whitespace, so a line holding only a no-break space, or only a control character such as U+001C, ended a task's continuation on one surface and not the other. Only spaces and tabs make a line blank now, as CommonMark defines it
- **Nothing moves for a `tasks.md` that uses ordinary newlines** — the overwhelming majority. Both fixes were verified against a reference Markdown renderer, and no progress bar or count changes

## 1.10.0

**Highlight: the Tasks tab shows what your `tasks.md` actually says.** Two independent defects had made it the least faithful view in the app — one discarded content before it ever reached the UI, the other displayed what survived as literal source. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for reporting and contributing both.

- **A task's continuation lines are no longer discarded.** Sub-bullets, explanatory paragraphs and code blocks written underneath a `- [ ]` item were dropped by the parser itself, so they were missing from the data rather than merely hidden by styling — no amount of scrolling or resizing would reveal them. In this repo's own openspec that was 90 of 1137 tasks, each showing only its first line. They now display as the source describes
- **Task text renders as Markdown.** The Tasks tab was the one artifact view whose text never reached a Markdown parser, so `**bold**` appeared as four asterisks and `` `code` `` as backticks around the word. Inline formatting, links, nested lists and code blocks now render as they do on every other tab. Links open in a new tab, matching the rest of the viewer
- **A bullet at column 0 after a checkbox stays outside that task.** A plain `- Note: …` line following a `- [ ]` item is a separate bullet in Markdown, and is now shown as one instead of being absorbed into the task above it as a nested list. The same applies to a heading, blockquote, code fence, numbered item or `---` — indent any of them and it still belongs to the task, exactly as Markdown reads it
- **Progress counts, section grouping and the CI task badge are unchanged.** Only checkboxes at column 0 are counted, as before; an indented `- [ ]` belongs to its parent task's text and is not a task of its own. This was verified across every `tasks.md` in this repo — no progress bar or badge value moves

## 1.9.2

- **Spec diffs stay readable on lines too wide to fit.** The red and green tints marking removed and added lines stopped at the first screenful, so scrolling right — exactly what you do to read a long line — left the changed text sitting on plain background, with nothing to say whether it was an addition or a removal. The tints now span the full scrollable width. Thanks to [@Katsz](https://github.com/Katsz) (Alex) for reporting and contributing this
- **The `··· N lines hidden ···` marker stays in view while you scroll a diff sideways.** Its label was centred against the diff's full width rather than the visible area, so on a wide diff it sat off-screen and the collapsed region looked like an unexplained gap. The label is now pinned to the left edge, the way a diff hunk header behaves

## 1.9.1

- **The plugin opens again on IDEs built on platform 2026.2.** Opening the Tool Window threw an IDE Internal Error and left no viewer at all, so the plugin was unusable — 2026.2 moved JCEF into a bundled plugin whose classes the plugin could no longer see (issue #24, reported on WebStorm 2026.2 with plugin 1.9.0). The embedded webview is restored on 2026.2, and the supported IDE range is unchanged
- **JCEF being unavailable is no longer fatal.** Whatever the reason — a future platform change, a JCEF-less build, an initialization failure — the plugin now logs it and falls back to opening the viewer in the external browser, instead of failing to start
- Plugin verification against both ends of the supported IDE range now runs in CI. It catches API removals and signature changes; it does **not** model the classloader visibility problem behind issue #24, which is why the fallback above matters

## 1.9.0

- No user-facing changes for the plugin. This release's two features — the new (experimental) Jujutsu (jj) workspace aggregation, and moving the aggregation scope into a header control — are Web / VS Code only. The plugin's Kotlin core has no worktree-aggregation foundation yet, so it has no scope to control and jj parity there is tracked as a separate, larger effort. The header control is hidden when there is nothing to aggregate, so nothing changes on screen here.

## 1.8.3

- **Lists with blank lines between their items render correctly again.** Every bullet and number was pushed onto its own line, above the text it belonged to, which made proposals and task lists hard to scan. Markers now sit inline with the first line of their item. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for reporting and contributing this.

## 1.8.2

- **Opening a change is much faster.** Each change took about a second to open. To order a change's tabs, spek asks the OpenSpec CLI for the artifact order that the change's schema defines — and it repeated that request for every change, even though every change sharing a schema gets the same answer back. The answer is now looked up once per schema instead of once per change, so only the first change you open pays for it and the rest open immediately. Unlike the previous release's worktree fix, this one did land in the plugin — its Kotlin copy of the logic was changed alongside the shared one. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for contributing this.

## 1.8.1

- No user-facing changes for the plugin in this release. The Web and VS Code fix for changes appearing once per git worktree does not apply here — the plugin has its own copy of the scanning logic, which still lists every worktree's copy.

## 1.8.0

- **The Refresh button now actually refreshes.** The circular-arrow button at the bottom of the sidebar — previously labelled "Resync" — only rebuilt an internal cache. It never re-fetched what was on screen, so if you edited a file and pressed it, nothing happened; you had to navigate away and back before your change showed up. It now re-fetches, and it keeps spinning until the new data has actually arrived instead of stopping before it lands (which made a working refresh look like a broken one). Thanks to [@deniskrizanovic](https://github.com/deniskrizanovic) for reporting.
- **The Refresh button was completely dead in this plugin.** The built-in server had no endpoint for it, so every click returned HTTP 404 and the frontend gave up silently. The endpoint now exists, and Refresh no longer depends on it succeeding.
- **Stopped a pointless background retry loop.** The webview mistook itself for the web app and kept reconnecting, forever, to a path the plugin's server never serves.

## 1.7.0

- **spek has moved to the `spekhq` GitHub organization** — the repository is now [`spekhq/spek`](https://github.com/spekhq/spek), and the live demo moved to [`spekhq.github.io/spek`](https://spekhq.github.io/spek/demo.html). Links from the marketplace listing and from older versions redirect automatically.
- No other user-facing changes for the extension in this release.

## 1.6.1

- **TOC navigation lands on the section you clicked** — clicking a table-of-contents entry, or opening a `#hash` deep link, on a Change or Spec detail page no longer scrolls the target heading behind the sticky header, which made it look like the click had jumped one section too far. The offset is now measured from the header that is actually rendered instead of an assumed 80px, and the entry you clicked is the one the TOC highlights.
- **Schema badge under worktree aggregation** — when changes are aggregated across worktrees, each change's schema is now compared against the default schema of the worktree it actually lives in, rather than the main worktree's. A change that uses its own worktree's default no longer shows a badge, and the list and detail views agree on this. Scanning also reads each worktree's `openspec/config.yaml` once instead of once per change.

Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for both.

## 1.6.0

- **Hideable tree navigator (IntelliJ)** — the Specs / Changes tree in the spek tool window can now be hidden from the tool window title bar or its gear (⋮) menu, giving the viewer the full tool window. The choice is remembered per project, and the split ratio is persisted too instead of resetting every time you reopen the project. While hidden, the tree no longer rebuilds on file changes; it refreshes when you bring it back. Thanks to [@deniskrizanovic](https://github.com/deniskrizanovic) for reporting.

## 1.5.0

- **Custom OpenSpec schemas** — a change's artifacts are now discovered from disk, so a change authored under any schema (not just the built-in `spec-driven`) renders every artifact as its own tab. Previously anything outside `proposal` / `design` / `tasks` / `specs` was silently dropped. Full-text search now indexes every markdown artifact as well.
- **Artifact tab ordering** — tabs default to last-modified order so the artifact you're actively editing surfaces first. A sort control adds **Schema order** (sourced from the OpenSpec CLI, degrading gracefully to the default order when the CLI is unavailable or the change is archived) and **A–Z**. The choice persists across changes.
- **Schema badge** — each change's schema is shown as a badge on the Changes list, the Dashboard, and Change Detail. It is hidden when the change uses the repo's default schema (from `openspec/config.yaml`), so a badge always means "this change uses a non-default schema"; the Changes page states the repo default as a plain-text label.

Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for contributing all of the above.

## 1.4.0

- Live-reload now works inside devcontainers and WSL. On filesystems that don't deliver native OS change events (9p / drvfs / NFS / CIFS / FUSE), spek automatically falls back to polling — so files created or edited after opening it are still detected. Detection is based on the watched path's filesystem type and needs no configuration; an optional `SPEK_WATCH_POLLING=on|off` escape hatch exists only if you ever need to force it. Applies to the Web, VS Code, and IntelliJ live variants. Thanks to [@nthansen](https://github.com/nthansen) (Norman Hansen) for contributing this feature.

## 1.3.4

- Fix: the Timeline no longer falls back to "No timeline data" when a change's `created:` date is set correctly. The IntelliJ plugin's backend never read `created:` from `.openspec.yaml` (so every change lost its created date on the Timeline), and the Web / VS Code parser dropped `created:` from files saved with CRLF (`\r\n`) line endings. Both backends now surface `createdDate` and `archivedDate` consistently, and the Timeline empty state no longer wrongly claims the `created:` field is missing.

## 1.3.3

- Fix: the IntelliJ plugin now installs on IntelliJ Platform 2026.1 (build 261.x) and newer — the `until-build` upper bound (`253.*`) that caused "requires IDE build 253.* or earlier" has been removed, so the plugin tracks current and future IDE releases (#4)
- Update the published `kewang/spek` GitHub Action off the deprecated Node 20 runtime — bump `actions/checkout` to v7, `actions/setup-node` to v6, and `actions/cache` to v6; internal CI workflows and README examples updated to match (#7)

## 1.3.2

- Update VS Code Marketplace keywords/tags for better discoverability — replace `bdd` with `sdd`, add `spec-driven-development` and `ai`, and drop `documentation` / `viewer`

## 1.3.1

- Fix: a fresh clone now starts cleanly with `npm install && npm run dev` — `@spek/core` resolves to its gitignored `dist/` build, which neither install nor dev used to produce, so the Express API failed with `ERR_MODULE_NOT_FOUND` and Vite failed to resolve `@spek/core/headings`. `npm install` now compiles `@spek/core` (new `prepare` script) and the root `dev` script rebuilds it before launching (#2)

## 1.3.0

**Highlight: Cross-worktree aggregation** — when you run agents in parallel across multiple git worktrees, spek now shows the OpenSpec content of *all* worktrees in one place, instead of forcing you to point spek at each worktree by hand.

- Point spek at any directory and it auto-discovers every git worktree of the same repo, then merges their active changes, archived changes, and the spec-change graph into a single unified view
- Each change card / row is tagged with its source worktree branch, so you can tell at a glance which worktree a change lives in
- A toggle turns aggregation off to view only the current directory
- Active changes from each worktree coexist (same-named slugs are both shown, identified by their source worktree); archived changes are deduped by slug; the specs list always comes from the main worktree
- Aggregation is the default whenever multiple worktrees are detected — single-worktree or non-git repos behave exactly as before
- Supported in the Web version and the VS Code extension (IntelliJ and Demo are unchanged)
- Fix: the VS Code extension now uses chokidar for file watching, so newly created nested directories (e.g. a change's `specs/<topic>/spec.md`) are detected and the change-detail spec tab live-reloads correctly

## 1.2.0

- Add `/timeline` page: horizontal Gantt-style chart of every change's lifecycle — active bars extend to today with an arrow, archived bars render as fixed segments
- Timeline supports an optional "Group by topic" toggle and "Hide active / Hide archived" filter chips, plus an auto-scaling time axis (daily / weekly / monthly / quarterly ticks based on span)
- Read `created:` from `.openspec.yaml` and derive `archivedDate` from archive folder name; surface lifecycle info in `ChangeInfo` / `ChangeDetail` (server payload adds two backwards-compatible fields)
- ChangeList row shows `Created Apr 20 · 5d ago` for active changes and `Created Feb 14 → Archived Feb 22 · 8d` for archived ones
- ChangeDetail header gains a lifecycle banner (e.g., `Created 2026-02-14 · Archived 2026-02-22 (8 days)` or `Active for 5 days`)
- Dashboard adds two stats cards: **Avg lifecycle (archived)** and **Stale active (>30d)**
- VS Code sidebar shows lifecycle days in change descriptions and includes the created date in tooltips
- New `@spek/web` test runner (`npm test -w @spek/web`) covers the timeline scale and grouping helpers

## 1.1.0

- Add table-of-contents (TOC) sidebar to spec detail pages — sticky navigation lists all `h2`/`h3` headings, with scrollspy highlighting and smooth scrolling on click
- Add TOC sidebar to change detail pages for the Proposal, Design, and Specs tabs (Tasks tab excluded); TOC updates when switching tabs
- Persist the active tab in the change detail URL (`?tab=<id>`) and support deep links with both tab + hash (e.g., `?tab=design#decision-1`)
- Specs tab: prefix each delta spec's heading ids with `<topic>--` so multiple specs with the same heading text no longer collide
- Support URL hash anchors on spec detail pages (e.g., `/specs/foo#requirement-bar` scrolls to that heading)
- Add `extractHeadings` and `slugifyHeading` utilities to `@spek/core` for shared heading parsing across web and extension hosts

## 1.0.2

- Unify date format to YYYY-MM-DD across all pages (Dashboard, ChangeList, SpecDetail)
- Fix demo SpecList not showing "N changes" count

## 1.0.1

- Add SVG badge generation (specs count, open changes, tasks status) to GitHub Action and release workflow
- Fix CI publish triggers to only match semver tags (avoid triggering on v1 floating tag)

## 1.0.0

- First stable release
- Publish GitHub Action to Marketplace — use `kewang/spek@v1` in your workflows
- Update README examples to reference `@v1` stable tag

## 0.7.9

- Remove demo auto-rebuild GitHub Action — demo rebuild is now handled exclusively by the release workflow

## 0.7.8

- Add GitHub Action for building OpenSpec static sites
- Add Open VSX Registry publishing to VS Code extension CI/CD workflow

## 0.7.7

- Fix deprecated `URL(String)` constructor usage in IntelliJ plugin (resolves Plugin Verifier warning)
- Fix IntelliJ plugin.xml change-notes sync with release workflow

## 0.7.6

- Add native tree view navigation to IntelliJ plugin (Specs and Changes sidebar)
- Add URL hash-based navigation for IntelliJ external browser fallback
- Update acknowledgments in README

## 0.7.5

- Add external browser fallback for IntelliJ plugin when JCEF is unavailable (e.g., Android Studio)

## 0.7.4

- Fix IntelliJ plugin HTTP 404 error when opening specs/changes at startup
- Fix README install instructions and plugin.xml change-notes

## 0.7.3

- Add IntelliJ IDEA plugin — browse OpenSpec content in IntelliJ-based IDEs via Tool Window + JCEF
- Add IntelliJ plugin CI/CD — auto publish to JetBrains Marketplace on `v*` tag push
- Add IntelliJ Marketplace metadata — plugin icon, rich description, change notes, vendor info
- Fix `.nvmrc` to use exact Node.js version 22.22.0

## 0.7.2

- Fix sidebar navigation race condition when webview panel is not open
- Add electron skill for Electron desktop app automation

## 0.7.1

- Fix VS Code extension not activating in workspaces without `config.yaml` — sidebar and status bar now appear for any valid OpenSpec repo (with `specs/` or `changes/` directory)

## 0.7.0

- Add Activity Bar sidebar — browse specs and changes directly from the VS Code sidebar without opening the Command Palette
- TreeView with two sections: Specs (alphabetical) and Changes (grouped by active/archived)
- Click any item to open the spek webview panel and navigate to that spec or change
- Auto-refresh TreeView when openspec files change on disk

## 0.6.4

- Fix change detail showing "Change not found" error during file watcher refresh (e.g., after archiving a change)
- Improve API error messages — show descriptive server errors instead of generic "HTTP 404"

## 0.6.3

- Add git timestamp to changes — sort by precise commit time instead of date-only slug, display relative time (e.g., "3 hours ago") in Dashboard and Changes list
- Fix detect fallback — repos with openspec/ directory but no config.yaml are now correctly detected

## 0.6.2

- Sticky change detail header — change title and tab navigation stay fixed below the header when scrolling through long content

## 0.6.1

- Fix VS Code live-reload not detecting directory moves (e.g., archive operations)

## 0.6.0

- Live reload — spek viewer automatically refreshes when openspec files change on disk
- Web: Server-Sent Events (SSE) with chokidar file watching
- VS Code: FileSystemWatcher with postMessage notification
- Debounced refresh (500ms server + 300ms client) preserves existing data without loading flash

## 0.5.0

- Interactive spec-change graph view — D3 force-directed graph showing relationships between specs and changes
- Spec nodes (amber circles) scaled by history count, change nodes (colored rects) by spec count
- Graph interactions: drag, hover highlight, click navigation, zoom/pan with fit-to-viewport
- New `/graph` route with sidebar navigation link, working across Web, VS Code, and demo

## 0.4.0

- Spec diff viewer — compare current spec content against any historical change version with unified diff view
- Compare button on spec history timeline entries for quick diff access
- New API endpoint and core function for reading spec content at specific change versions
- Full support across Web, VS Code extension, and demo environments

## 0.3.1

- Add custom tab icon (spek logo) to VS Code webview panel for better visual identification

## 0.3.0

- Standalone demo page — self-contained HTML with embedded openspec data for GitHub Pages
- UI design polish — tab order, animations, search highlights, accessibility improvements
- Fix demo search — use ApiAdapter instead of direct fetch
- Plus Jakarta Sans web font for improved typography
- Add acknowledgments section to README

## 0.2.1

- GitHub Actions CI/CD — auto build and publish to VS Code Marketplace on `v*` tag push
- `npm version` auto-syncs version between root and vscode package.json

## 0.2.0

- Collapsible sidebar with icon-only mode — click toggle button to collapse/expand
- Sidebar state persisted in localStorage (web) across sessions
- Smooth CSS transition animation for sidebar width changes

## 0.1.0

Initial release.

- Dashboard with specs/changes overview and task completion stats
- Specs browser with detail view and revision history
- Changes timeline with tabbed views (Proposal / Design / Tasks / Specs)
- BDD syntax highlighting (WHEN/GIVEN, THEN, AND, MUST/SHALL)
- Task progress tracking with section-grouped progress bars
- Full-text search across specs and changes (Cmd+K)
- Markdown rendering with remark-gfm
- Dark / Light theme toggle
- Responsive layout with mobile support
- Repo selection with path validation and recent history
- Git-based spec history timestamps with in-memory cache
- VS Code extension with Webview Panel integration
- Brand logo and favicon
- Bilingual README (English / 繁體中文) with screenshots
