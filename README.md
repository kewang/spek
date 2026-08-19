<p align="center">
  <img src="logo/full-logo.svg" alt="spek" width="480" />
</p>

<p align="center">
  A lightweight, read-only viewer for <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> content — browse specs, changes, and tasks with structure.
</p>

<p align="center">
  <img alt="Specs" src="https://spekhq.github.io/spek/badges/specs.svg" />
  <img alt="Open Changes" src="https://spekhq.github.io/spek/badges/open_changes.svg" />
  <img alt="Tasks" src="https://spekhq.github.io/spek/badges/tasks.svg" />
</p>

**[繁體中文](README.zh-TW.md)**

---

## What is spek?

**spek** turns your local OpenSpec directory into a navigable, searchable interface. Instead of reading raw Markdown files in a text editor, spek provides structured browsing with BDD syntax highlighting, task progress tracking, and full-text search.

**[Live Demo](https://spekhq.github.io/spek/demo.html)** — Try it instantly in your browser, no install needed.

Available in three forms:

- **Web** — Local Express + React app, accessible in any browser
- **VS Code Extension** — Integrated Webview Panel within your editor
- **IntelliJ Plugin** — JCEF-based Tool Window for IntelliJ IDEA and other JetBrains IDEs

All are **read-only** and **local-only**. No server deployment, no authentication, no data leaves your machine.

## Features

- **Dashboard** — Overview of specs count, changes count, task completion rates, plus lifecycle stats (avg archived lifecycle, stale active changes)
- **Specs Browser** — Alphabetical listing with detail view and revision history; requirements and scenarios fold in place, so a spec opens as an outline that still carries its normative sentences
- **Changes Browser** — Active and archived changes with tabbed views (Proposal / Design / Tasks / Specs); each row surfaces creation and archive dates plus lifecycle duration
- **Schemas Browser** — Every workflow schema available to the repo, with its source and the artifacts it defines; the detail view renders one schema as a readable flow — each artifact in dependency order with the file it generates, what it requires before it can be written, and its full instruction text. The repo's default schema is marked, and each schema links through to the active changes using it. A step a schema produces only *after* implementation is drawn after `apply` on a dashed edge marked as spek's own inference — OpenSpec's format has no way to declare that ordering, so the diagram states it without claiming the CLI enforces it
- **Worktree Aggregation** — Discovers every git worktree of a repo and merges their in-flight changes into one view, deduplicated so each change appears once — built for the AI-agent era of parallel worktrees. Jujutsu (jj) workspaces are supported too, as an experimental opt-in
- **Timeline** — Horizontal Gantt-style chart of every change's lifecycle, with optional spec-topic grouping, status filters, and an auto-scaling time axis
- **BDD Syntax Highlighting** — Visual distinction for WHEN/GIVEN, THEN, AND, MUST/SHALL keywords, plus a badge for each delta operation (ADDED / MODIFIED / REMOVED / RENAMED)
- **Task Progress** — Checkbox parsing with section-grouped progress bars
- **Full-text Search** — `Cmd+K` / `Ctrl+K` to search across all specs and changes
- **Dark / Light Theme** — Toggle between themes; dark by default
- **Spec History** — Git-based timestamp tracking for spec revisions
- **Responsive Layout** — Works on various screen sizes
- **VS Code Sidebar** — Activity Bar icon with TreeView for browsing specs and changes directly from the sidebar

## Worktree Aggregation

In the AI-agent era, a single repository often has **several working copies in flight at once** — each agent, or each parallel task, on its own branch in its own worktree. The OpenSpec changes for that work scatter across those copies, and pointing a viewer at any one directory shows only a fraction of what's happening.

spek discovers every worktree of a repository (via `git worktree list`) and **aggregates their in-flight changes into one view**. Point spek at any worktree — or the main repo — and you see the whole picture:

- **Active changes from every worktree**, each tagged with its source branch; main-worktree changes stay unlabelled so feature-worktree work stands out
- **One change, one row** — a change inherited by several worktrees is shown once. The surviving copy is elected from git history (which worktree actually advanced it past main), not from file timestamps, which a fresh checkout rewrites
- **Archived changes** merged and deduplicated across worktrees
- A **scope control in the app header** — `Current dir` / `Worktrees` / `Worktrees + jj` — shown only when there is more than one working copy to aggregate. The choice persists (Web: browser storage; VS Code: the `spek.aggregateWorktrees` setting)
- Works in the **Web app** and the **VS Code extension** (panel + sidebar), with live refresh when any worktree's `openspec/` changes

![Git Worktree Aggregation](screenshots/worktree-aggregation.png)

### Jujutsu (jj) workspaces — experimental

Since 1.9.0, aggregation is not limited to git. In a colocated git + jj repository, jj workspaces are invisible to `git worktree list`, so changes authored in one were silently missed. Pick `Worktrees + jj` in the header control and spek also scans every jj workspace, merging them into the same view.

- **Opt-in, off by default** — the header control's `Worktrees + jj` option (Web) or the `spek.aggregateJjWorkspaces` setting (VS Code). The option is only offered when a jj workspace is actually detected
- **Deduplicated by content, not by git history** — jj workspaces share one commit graph and each materialises the full trunk, so a shared change would otherwise appear once per workspace. Identical copies collapse into one; a workspace that has diverged on a change keeps its own entry, flagged `conflicts with <base>`, and `editing` when it is the `@` change
- **`jj` is never required** — with jj not installed, or the repo not a jj repo, or the option off, behaviour is identical to before. Git worktree aggregation is untouched: jj copies never enter the git election, because a jj working-copy commit is not a git ref
- Available in the **Web app** and the **VS Code extension**. The IntelliJ plugin has its own scanner and does not aggregate yet

## Quick Start

### Web Version

```bash
git clone https://github.com/spekhq/spek.git
cd spek
npm install
npm run dev
```

Open http://localhost:5173, enter a path to a repo containing an `openspec/` directory, and start browsing.

> `npm install` compiles the shared `@spekjs/core` package, and `npm run dev` rebuilds it before launching — so a fresh clone starts with no extra build step.

### VS Code Extension

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=kewang.spek-vscode). The extension activates automatically when your workspace contains `openspec/config.yaml`.

Once activated, click the **spek icon** in the Activity Bar to browse specs and changes from the sidebar. Click any item to open the full viewer panel.

**Commands:**
- `spek: Open spek` — Open the viewer panel
- `spek: Search OpenSpec` — Open search dialog
- `spek: Open Dashboard` — Open the dashboard from sidebar

**Settings:**

| Setting | Description | Default |
|---------|-------------|---------|
| `spek.aggregateWorktrees` | Aggregate changes across all git worktrees of the repository | `true` |
| `spek.aggregateJjWorkspaces` | **Experimental** — also aggregate jj (Jujutsu) workspaces | `false` |

Both are what the panel's header scope control writes, so toggling the control edits your workspace `settings.json` — and editing the settings updates the control.

### IntelliJ Plugin

Install from the [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/30600-spek--openspec-viewer) — search for **"spek"** in **Settings > Plugins > Marketplace**.

The plugin activates automatically when your project contains an `openspec/` directory. Click the **spek** icon in the right sidebar to open the viewer.

**Action:**
- **Tools > Open spek** — Open the viewer panel

## Screenshots

### Dashboard
Overview of specs count, changes count, and task completion rates.

![Dashboard](screenshots/dashboard.png)

### Specs Browser
Alphabetical listing of all spec topics with filter support.

![Specs List](screenshots/specs-list.png)

### Spec Detail
A spec opens as an outline: every requirement shows the sentence stating what it requires, while the
scenario detail stays folded until asked for. BDD keywords are colour-coded — WHEN/GIVEN (blue),
THEN (green), AND (gray), MUST/SHALL (red).

![Spec Detail](screenshots/spec-detail.png)

### Changes Browser
Active and archived changes listed chronologically, with lifecycle duration on every row.

![Changes List](screenshots/changes-list.png)

### Schemas
The workflow a change goes through — each artifact in dependency order, and the full instruction
text for whichever step you select.

![Schemas](screenshots/schemas.png)

### Timeline
Horizontal Gantt-style view of every change's lifecycle — active bars extend to today, archived ones render as fixed segments.

![Timeline](screenshots/timeline.png)

### Change Detail
Tabbed view with one tab per artifact the change contains. For the default `spec-driven` schema that's Proposal, Design, Specs, and Tasks; the schema a change was authored under is shown as a badge.

![Change Detail](screenshots/change-detail.png)

### Custom Schemas
spek renders whatever artifacts a change actually contains, so changes authored under a custom OpenSpec schema (e.g. `superpowers-bridge` with `brainstorm` / `plan` / `verify` / `retrospective`) show every artifact as its own tab. Tabs default to **last-modified** order so the artifact you're actively editing surfaces first, and a sort control lets you switch to **Schema order** or **A–Z**. Schema order comes from the OpenSpec authority (the `openspec` CLI) rather than spek parsing the schema format itself, so it's correct for any schema; when the CLI isn't available (or the change is archived) that mode falls back to the default order and says why.

![Custom Schema](screenshots/custom-schema.png)

### Full-text Search
`Cmd+K` / `Ctrl+K` to search across all specs and changes.

![Search](screenshots/search.png)

## GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-spek-blue?logo=github)](https://github.com/marketplace/actions/spek-openspec-static-site)

Use spek as a GitHub Action to automatically build a static OpenSpec site in your CI pipeline.

### Basic Usage

```yaml
- uses: actions/checkout@v7
  with:
    fetch-depth: 0  # Recommended for accurate change timestamps

- uses: spekhq/spek@v1
  with:
    title: "My Project - OpenSpec"
```

### Deploy to GitHub Pages

```yaml
name: Build OpenSpec Site
on:
  push:
    branches: [main]
    paths: ["openspec/**"]

permissions:
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: spekhq/spek@v1
        with:
          title: "My Project - OpenSpec"

      - uses: actions/upload-pages-artifact@v5
        with:
          path: spek-output

      - name: Deploy to GitHub Pages
        id: deploy
        uses: actions/deploy-pages@v5
```

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `repo-path` | Path to the repo containing `openspec/` | `.` |
| `output-path` | Output HTML file path | `spek-output/spek.html` |
| `title` | Page title | `OpenSpec Viewer` |
| `spek-version` | spek version (tag, branch, or SHA) | `master` |
| `generate-badges` | Generate SVG badge files | `false` |

### Outputs

| Output | Description |
|--------|-------------|
| `html-path` | Absolute path to the generated HTML file |
| `badges-path` | Absolute path to the generated badges directory |

### Badges

Enable `generate-badges` to generate SVG status badges (specs count, open changes, tasks progress) alongside your static site. Deploy them to GitHub Pages and reference in your README:

```yaml
- uses: spekhq/spek@v1
  with:
    title: "My Project - OpenSpec"
    generate-badges: true
```

Then in your README:

```markdown
![Specs](https://your-user.github.io/your-repo/badges/specs.svg)
![Open Changes](https://your-user.github.io/your-repo/badges/open_changes.svg)
![Tasks](https://your-user.github.io/your-repo/badges/tasks.svg)
```

> **Note:** Use `fetch-depth: 0` in your checkout step for accurate change timestamps. Without full git history, timestamps will be unavailable (the build still succeeds).

## OpenSpec Directory Structure

spek expects the following structure under your repository:

```
{repo}/openspec/
├── config.yaml
├── specs/
│   └── {topic}/
│       └── spec.md              # BDD-formatted specification
└── changes/
    ├── {active-change}/         # In-progress changes
    │   ├── .openspec.yaml
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/               # Delta specs for this change
    └── archive/
        └── {YYYY-MM-DD-desc}/   # Archived changes (same structure)
```

## Architecture

### Monorepo Structure

```
packages/
├── core/       # @spekjs/core — Pure logic (scanner, parser, types)         [published to npm]
├── ui/         # @spekjs/ui   — Reusable visualizations (graph, timeline)   [published to npm]
├── web/        # @spekjs/web  — Express API + React SPA
├── vscode/     # spek-vscode  — VS Code Extension
└── intellij/   # spek-intellij — IntelliJ Platform Plugin (Kotlin)
```

### Published packages

Two packages are published so that hosts outside this monorepo can reuse them:

- **[`@spekjs/core`](https://www.npmjs.com/package/@spekjs/core)** — the engine: scanner, tasks
  parser, worktree aggregation, shared types. Pure Node.js, no framework.
- **[`@spekjs/ui`](https://www.npmjs.com/package/@spekjs/ui)** — the two visualizations:
  `<SpecGraph>` (force-directed spec ↔ change graph) and `<ChangeTimeline>` (Gantt-style change
  lifecycle). **Presentational only** — no router, no data layer, no CSS framework. Colours are an
  explicit contract of eight CSS custom properties, so a host re-themes them by overriding those.

Within this monorepo they resolve through npm workspaces, so development is not gated on their
release cadence. Both are released manually and version independently of the root.

### API Adapter Pattern

The frontend communicates through an `ApiAdapter` interface with two implementations:

- **FetchAdapter** — Web + IntelliJ version, calls REST API over HTTP (configurable base URL)
- **MessageAdapter** — VS Code version, uses `postMessage` IPC with the extension host

This allows the same React UI to run in both environments without code changes.

Note that `@spekjs/ui` does **not** depend on `ApiAdapter`: its components take data through props.
Fetching is the host's concern — over HTTP here, over IPC in an Electron host.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Core | TypeScript, Node.js |
| UI package | React 19 (peer), d3 (force, zoom, drag, selection, transition), hand-written CSS |
| Frontend | React 19, Vite 6, Tailwind CSS v4, React Router v7 |
| Backend | Express 4 |
| Markdown | react-markdown, remark-gfm |
| Search | Fuse.js |
| VS Code Extension | VS Code Webview API, esbuild |
| IntelliJ Plugin | Kotlin, JCEF, IntelliJ Platform SDK |

## Development

```bash
npm install              # Install all workspace dependencies
npm run dev              # Start Vite (5173) + Express (3001)
npm run build            # Build core + ui + web
npm run build:core       # Build @spekjs/core only
npm run build:ui         # Build @spekjs/ui only
npm run build:webview    # Build webview assets for VS Code extension
npm run build:vscode     # Build VS Code extension
npm run build:intellij   # Build IntelliJ webview assets
npm run type-check       # Type-check every package + scripts/ (tests included)
npm run lint             # ESLint
```

**IntelliJ Plugin build:**
```bash
npm run build:intellij                    # Build frontend assets
cd packages/intellij && ./gradlew buildPlugin  # Build plugin ZIP
```

**Requirements:** Node.js 22+, Java 17+ (for IntelliJ plugin build)

### Live reload in containers (devcontainer / WSL)

spek watches `openspec/` and live-reloads on changes. On filesystems that don't deliver native change events — 9p / drvfs / NFS / CIFS bind mounts, as used by devcontainers and WSL — spek automatically falls back to polling so newly created files are still detected. Detection is based on the watched path's filesystem type. To override:

- `SPEK_WATCH_POLLING=on` (or `off`) — force polling on/off for all surfaces
- `CHOKIDAR_USEPOLLING=1` / `CHOKIDAR_INTERVAL=<ms>` — Web and VS Code also honor chokidar's native env vars

## Contributing

Contributions are welcome — from typo fixes to features across the Web, VS Code, and IntelliJ
surfaces. Start with the [Contributing Guide](CONTRIBUTING.md) for setup, conventions, and the
pull-request process.

- [Contributing Guide](CONTRIBUTING.md) — dev setup, conventions, how to open a PR
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md) — how to report a vulnerability privately

## Acknowledgments

This project was inspired by [龍哥（高見龍）](https://kaochenlong.com)'s articles on SDD (Spec Driven Development). Special thanks to him for his contributions to SDD and [OpenSpec](https://github.com/Fission-AI/OpenSpec).

- [SDD — Spec Driven Development](https://kaochenlong.com/sdd-spec-driven-development)
- [Spectra with OpenSpec](https://kaochenlong.com/spectra-with-openspec)

## Contributors

Thanks to everyone who has contributed to spek:

- [@nthansen](https://github.com/nthansen) (Norman Hansen)
  - **Custom schema support** — a change's artifacts are discovered from disk, so any schema renders its own tabs; each change carries a schema badge judged against its own worktree's default, and tabs sort by last-modified / schema order / A–Z, with the authoritative order taken from the OpenSpec CLI and cached per schema
  - **The Schemas pages** — a list of what every available schema defines, and a detail view drawing one as a readable flow, including the steps a schema produces only after implementation
  - **Markdown fidelity** — a task's continuation lines survive the parser and render as Markdown, list markers stay inline with their item's first line, and TOC / `#hash` navigation lands the target heading below the sticky header
  - **Platform reach** — polling live-reload for filesystems without native change events (devcontainer / WSL / network mounts), and build scripts that work under Windows `cmd.exe`
  - **Removal of the web server's unreferenced `server/lib/` copies** of the core scanning logic, which shadowed `@spekjs/core` as a second place the same rules could drift

- [@david-lutz](https://github.com/david-lutz) (David Lutz)
  - Deduplication of active changes shared across git worktrees, in both the Changes list and the dependency graph — the surviving copy is elected from git divergence rather than file timestamps, which a fresh checkout rewrites

- [@DannyGoodall](https://github.com/DannyGoodall) (Danny Goodall)
  - Experimental Jujutsu (jj) workspace aggregation — changes authored in a jj workspace, invisible to `git worktree list`, are discovered and merged into the aggregated view, deduplicated by content with diverged copies kept and flagged

- [@Katsz](https://github.com/Katsz) (Alex)
  - Added and removed lines in a spec diff keep their red / green tint across the whole scrollable width, instead of losing it past the first screenful on lines too wide to fit

## License

MIT
