# CLAUDE.md

Guidance for Claude Code working in this repo.

## Project Overview

spek — an OpenSpec content viewer. Four delivery surfaces plus one CI helper:

- **Web** — local read-only Express + React SPA; pick a repo path in the UI and browse
- **VS Code** — Webview Panel over the current workspace's openspec
- **IntelliJ** — Tool Window + JCEF
- **Demo** — self-contained static HTML (`docs/demo.html`) embedding spek's own openspec, deployed to GitHub Pages
- **GitHub Action** (`spekhq/spek`) — generates an HTML snapshot + status badges in CI

## Repo

The repo is **`spekhq/spek`**; the npm scope is **`@spekjs`** (an org name ≠ npm scope is normal — don't "fix" the mismatch).

## Three things whose *names* are configuration — renaming any of them fails silently

Each is referenced by something outside the file that holds it, matched by exact string, with no error when the
match breaks. Rename only alongside updating the other side.

| Name | Referenced by | What a rename does |
|---|---|---|
| `ci.yml`'s job names — `Node gates`, `Kotlin gates`, `Composite action smoke test` | `master`'s branch protection (required status checks) | PRs sit at **pending forever**, waiting on a check that will never report. Reads like CI is down, not like a config error |
| `npm-publish.yml` (the filename) | npm's trusted publisher registration for both packages | The workflow still runs and still resolves the version difference; it fails only at authentication, naming no cause |
| `action.yml`'s build chain steps | nothing — it is the *absence* of a reference that bites | Outputs stay populated while the files behind them are empty or missing (see below) |

Branch protection on `master` requires those three checks with `strict: true` (a PR must be up to date before
merging), does **not** require reviews, and leaves `enforce_admins` off — deliberately, because the `release` skill
pushes the `npm version` commit straight to `master` and a locally-created commit can never have passed a required
check. Turning admin enforcement on breaks `/release`.

## action.yml: smoke-tested only — read before touching the build chain

CI runs a smoke job (`action-smoke` in `ci.yml`) that invokes the composite action against this repo with
`generate-badges: "true"` and asserts the `html-path` / `badges-path` outputs point at real, non-empty files. It
pins `spek-version: ${{ github.sha }}` — the action checks out `spekhq/spek` at that ref and builds from *that*
copy, so the default `master` would test master's implementation and go green on a PR that breaks the action.

**What it covers**: the action's own build chain produces output. That is the failure that shipped before.
**What it does not**: any input combination other than the one it runs (`repo-path`, `output-path`, `title`,
`spek-version` pinned to a tag), the generated HTML's *content*, and behavior on a consumer's repo layout. A
change to those still needs manual verification — a temporary `workflow_dispatch` workflow with
`uses: spekhq/spek@master`, asserting the outputs, then removed.

- Precedent: moving `@spekjs/ui`'s build from `prepare` (install-time) to `prepublishOnly` (publish-time) made the
  action's ui build **silently vanish** — it relied on `npm ci` triggering `prepare` to get ui dist. The Marketplace
  action was broken for a full day with nothing raising an alarm.
- `spek-version` defaults to `"master"` — a user who pins `@v1` still builds against master: master breaks → everyone
  breaks instantly.

## Tech Stack

- **`@spekjs/core`** — pure Node.js shared logic (scanner / tasks / types). Published to npm on its own version line;
  only runtime dep is `cross-spawn`. In-repo consumers resolve it locally via `"*"` workspaces, so development is
  independent of core's release cadence.
- **`@spekjs/ui`** — reusable visual components (`SpecGraph`, `ChangeTimeline`). Published to npm. **Purely
  presentational**: data in via props, selection out via callbacks; no router / adapter / CSS framework. Colors are 8
  `--spek-*` CSS variables (its own names, never the host's tokens). The web `/graph` and `/timeline` pages are thin
  shells (fetch / loading / navigation / theme).
- React 19 + Vite + TS + Tailwind v4; Express (REST); VS Code Webview + esbuild; IntelliJ Kotlin + JCEF + built-in
  server; react-markdown + remark-gfm (BDD highlighting); search = server-side full-text + Fuse.js; React Router v7
  (Web BrowserRouter / webview MemoryRouter).

## Project Structure

```
packages/
├── core/       # @spekjs/core — pure logic (scanner.ts, tasks.ts, artifacts.ts, schema-order.ts, git-cache.ts, types.ts)
├── ui/         # @spekjs/ui — visual components (SpecGraph.tsx, timeline/*, theme.ts=color contract, styles.css)
├── web/        # @spekjs/web — server/ (Express API) + src/ (React SPA + API adapters)
├── vscode/     # spek-vscode — src/ (extension.ts, panel.ts, handler.ts) + webview/ (from web build:webview)
└── intellij/   # spek-intellij — src/main/kotlin/com/spek/intellij/ + resources/webview/ (from web build:intellij)
scripts/        # build-demo.ts, generate-badges.ts
docs/           # demo.html (Pages), prd.md, feature-ideas.md
.agents/skills/ # skill sources; .claude/skills/ are symlinks to them
```

## Development Commands

```bash
npm install              # install all workspace deps
npm run dev              # Web: Vite (5173) + Express (3001) → http://localhost:5173
npm run build            # core + ui + web
npm run build:core       # @spekjs/core
npm run build:webview    # webview assets (for VS Code)
npm run build:demo       # standalone demo (docs/demo.html; needs NODE_ENV=production)
npm run build:intellij   # IntelliJ webview assets
npm run type-check       # type-check core + ui + web + vscode + scripts/ (tests included)
npm run lint             # ESLint over every package's src, web's server, and scripts/
npm test                 # core + ui + web tests
```

**CI runs exactly these scripts** (`.github/workflows/ci.yml`, on `pull_request` + `push:[master]`), plus
`./gradlew test` in `packages/intellij` and the action smoke job. A gate that fails in CI reproduces locally
with the same command — that is deliberate, so don't reimplement a gate inline in the workflow.

`type-check` covers **test files too**. Each of core/ui carries a `tsconfig.test.json` for that, rather than the
build config dropping its test `exclude`: the build config emits into `dist`, and `files: ["dist"]` publishes it,
so removing the exclude there would ship compiled tests to registry consumers.

**A core change needs `npm run build:core` before web tests mean anything.** `@spekjs/core`'s package
entry is `dist/`, so the web package imports the *built* copy, not `src/`. Editing core and running
`npm test` will happily exercise the previous build and pass — this reads as "my change is fine" when
the web side never saw it. Build core first, then run the web tests.

**Package VS Code**: `npm run build -w @spekjs/core && npm run build:webview -w @spekjs/web && npm run build -w spek-vscode`, then `cd packages/vscode && npx vsce package --no-dependencies`
**Package IntelliJ**: `npm run build -w @spekjs/core && npm run build:intellij`, then `cd packages/intellij && ./gradlew buildPlugin` (output: `build/distributions/spek-intellij-*.zip`)

## Architecture

### `@spekjs/core`

Pure functions + types, shared by the web server and extension hosts. **Scanning never calls the CLI.** Authoritative
behavior lives in `openspec/specs/`; the key entry points:

- `scanOpenSpec(basePath)` — scan a single directory
- `scanOpenSpecAggregated(basePath, {aggregate, includeJj})` — cross-worktree aggregation. Active changes are deduped
  by slug, **dispatched by VCS**: **git worktrees** via a **git-divergence election** (winning copy is the one advanced
  past `main`'s HEAD, `main` competing on equal terms, mtime tiebreak); **jj workspaces** (EXPERIMENTAL — `includeJj`,
  off by default) via a **content fingerprint** — because jj workspaces share one commit graph and materialise the full
  trunk, identical copies collapse to one, a diverged copy is kept and flagged `conflictsWith`, and the `@`-edited one
  is flagged `isCurrent`. jj entries are **never** fed into the git election (their `head` is a jj change-id, not a git
  ref). Archived deduped by slug, specs from the main worktree. Single worktree / non-git / aggregation off →
  `scanOpenSpec`. `buildGraphDataAggregated` uses the same dual-path logic
- `readChange(basePath, slug, orderProvider?)` — returns `ChangeDetail`: disk-discovered `artifacts` (mtime order),
  `schema` / `defaultSchema` (that worktree's default, read from `openspec/config.yaml` once per worktree; the badge is
  hidden when a change's schema == its own `defaultSchema`), and `schemaOrder` (see below)
- `discoverArtifacts(changePath)` / `countArtifacts` — discover artifacts from the filesystem (each root `*.md` + a
  non-empty `specs/`, classified `markdown` / `tasks` / `specs`). mtime newest-first, with a stable tiebreak on ties
  (`proposal, design, specs, tasks` first, then alphabetical)
- `readSpec` / `readSpecAtChange`, `buildGraphData` / `buildGraphDataAggregated` (aggregated node ids
  `change:<wtKey>:<slug>` avoid collisions), `listWorktrees`, `parseTasks`
- **jj workspace support (EXPERIMENTAL)**: `listJjWorkspaces(dir)` (`jj workspace list`),
  `listWorkspaces(dir, {includeJj})` (merges git worktrees + jj workspaces, dedups the colocated main by path — git
  entry wins to keep the branch), `jjCurrentChangeSlugs(dir)` (`jj diff --ignore-working-copy -r @`, read-only, drives
  `isCurrent`). All degrade to `[]`/empty when `jj` is absent — `jj` is **never required**. Off by default; opt in via
  `includeJj` (Web `jj` query param) or the VS Code `spek.aggregateJjWorkspaces` setting (alongside
  `spek.aggregateWorktrees`; both driven by the header scope control). `WorktreeInfo.vcs` and
  `ChangeInfo.isCurrent` / `.conflictsWith` carry the jj metadata
- `extractHeadings` / `slugifyHeading` (h2/h3 → stable slugs for the spec TOC and VS Code sidebar; **import from the
  `@spekjs/core/headings` subpath** so the webview bundle doesn't pull in server-only modules)
- `ChangeDetail.artifacts: ChangeArtifact[]` is the contract across core / API / frontends, driving both tabs and TOC
  (markdown / specs have a TOC, tasks doesn't)

**schema-order cache**: `schemaOrder` comes from the CLI (`openspec status --change <slug> --json`), queried **once,
only when a change detail is read** — never on the scan hot path. The authoritative order depends only on the schema,
so the cache is keyed `${repoRoot}::${schema}` (all changes sharing a schema share it, spawning the CLI at most once —
issue #15). A change whose schema name doesn't resolve locally **still gets queried** (the CLI returns a built-in
default), sharing a sentinel bucket `${repoRoot}::\0default`. **The only early null is an empty slug**; it's also null
when the CLI is unavailable / for archived changes, and the frontend falls back to narrative order with a reason.

**Frontend artifact sort**: preference in `localStorage["spek:artifact-sort"]` — `modified` (mtime, default) /
`schema` (`schemaOrder`) / `alpha` (title).

**Polling fallback**: inotify doesn't deliver events on 9p/drvfs/NFS/CIFS mounts (devcontainer/WSL), so the decision is
by the watched path's fstype (`decidePolling` precedence: explicit override `SPEK_WATCH_POLLING` /
`CHOKIDAR_USEPOLLING` → fstype detection (`/proc/mounts`) → remote-env fallback). Web/VS Code pass chokidar
`usePolling`; IntelliJ has a Kotlin-aligned `WatchPolling.kt`.

### API Adapter

`ApiAdapter` abstracts transport, injected via `ApiAdapterContext`: `FetchAdapter` (Web + IntelliJ, configurable
`baseUrl` / `dirParam`), `MessageAdapter` (VS Code `postMessage`), `StaticAdapter` (Demo `window.__DEMO_DATA__`).

**Aggregation-scope control** (`aggregation-scope-control` spec): the git-worktree + jj scope is a **single global
control in the app header** (both Web and the VS Code webview), not on the Changes page. `AggregationScopeContext`
owns the level (a tri-state collapsing `aggregate` + `jj` via `aggregationLevel.ts`, so the invalid `aggregate off +
jj on` combo is unrepresentable) and the worktree list (via `getWorktrees`, which discovers jj **independently of the
setting** so the jj option can be offered while jj is off). The preference is read/written per host through the adapter
(`getAggregationPrefs` / `setAggregationPrefs`): Web = `localStorage`; VS Code = the settings (`spek.aggregateWorktrees`
+ `spek.aggregateJjWorkspaces`), so toggling the control **edits `settings.json`** (Workspace scope) and an external
settings edit updates the control (via `onDidChangeConfiguration` → webview refresh). Every entry point (App / Webview /
Demo / IntelliJ) must wrap `AggregationScopeProvider` — the shared `Layout` header calls `useAggregationScope`.

### API endpoints (Web; all openspec routes accept `dir`)

`/changes`, `/overview`, `/graph`, `/watch` also accept `aggregate` (default true) and `jj` (**EXPERIMENTAL, default false**; `jj=true` includes jj workspaces). `/changes/:slug` accepts `wt` (source working directory, incl. jj workspaces).

```
GET /api/fs/browse?path=...                        # directory browse
GET /api/fs/detect?path=...                         # detect openspec/
GET /api/openspec/overview?dir=...&aggregate=       # overview stats
GET /api/openspec/specs?dir=...                     # spec list
GET /api/openspec/specs/:topic?dir=...              # single spec
GET /api/openspec/specs/:topic/at/:slug?dir=...     # spec at a change (diff)
GET /api/openspec/changes?dir=...&aggregate=        # changes list
GET /api/openspec/changes/:slug?dir=...&wt=         # single change
GET /api/openspec/graph?dir=...&aggregate=          # spec-change graph
GET /api/openspec/worktrees?dir=...&jj=             # worktree/jj list only (no change scan) — feeds the header scope control
GET /api/openspec/search?dir=...&q=...              # full-text search
```

### VS Code Extension

- commands: `spek.open` / `spek.search` / `spek.navigateTo` (the last accepts a route with a `#hash`)
- activation: `workspaceContains:openspec/config.yaml`; the Webview loads the IIFE-bundled React app; the extension host calls `@spekjs/core` directly
- Sidebar Specs TreeView: each spec expands into its h2/h3 headings; clicking one jumps to the matching webview anchor
- **Both webview bundles are build artifacts and neither is in version control** — `packages/vscode/webview/` and
  IntelliJ's `src/main/resources/webview/` are gitignored, and each publish workflow builds its own before packaging
  (`vscode-publish.yml` → `npm run build:webview`; `intellij-publish.yml` → `npm run build:intellij`). So **a webview
  change needs no rebuild commit to reach either channel** — release builds always come from `src/`. The VS Code copy
  was tracked until v1.9.2; because nothing kept it in sync it sat stale for whole releases, and reading it as the
  shipped state led to the wrong conclusion that a fix had missed the channel. Build locally before `vsce package`

### IntelliJ Plugin

- Kotlin + IntelliJ Platform SDK; JCEF loads the React SPA; the built-in server exposes REST (`/api/spek/openspec/*`, `projectPath` param)
- Kotlin re-implements the core scan/read logic (`core/` dir): `ArtifactDiscovery.kt`, `SchemaOrder.kt`, aligned with the TS rules; tests in `src/test/kotlin`
- The frontend uses `FetchAdapter` (custom `baseUrl` + `dirParam`) against the embedded server
- **Tool Window layout + hideable tree**: a `JBSplitter` (top: Specs/Changes tree, bottom: JCEF). `JBSplitter` not
  `JSplitPane`: when a child is `isVisible=false` it gives all space to the other side and hides the divider, and
  `proportionKey` persists the ratio automatically. The tree's visibility toggles via `ToggleTreePanelAction` (one
  action instance on both the title bar and the ⋮ gear menu). The preference lives in `SpekProjectState.treeVisible`
  (`PersistentStateComponent` → `.idea/workspace.xml`); **`hasOpenSpec` is deliberately kept out of `State`**, else a
  project that removed `openspec/` would misjudge on reopen. While the tree is hidden, `TreeRefreshGate` (pure logic,
  unit-testable) records refreshes as pending and rebuilds once before re-showing
- Theme sync: JCEF `executeJavaScript()` injects a CSS class; file watching: VFS BulkFileListener + 500ms debounce
- **Platform classes can become invisible across IDE versions — JCEF already did.** In 2026.2 (branch `262`) JCEF
  moved into a bundled plugin with id `com.intellij.modules.jcef`, whose content modules each get their own
  classloader: `intellij.platform.ui.jcef` (`com.intellij.ui.jcef.*`) and `intellij.libraries.jcef` (`org.cef.*` —
  it's a *second* module, and `cefBrowser.executeJavaScript` lives there). A v1-descriptor plugin that declares only
  `<depends>com.intellij.modules.platform</depends>` loses both, and `SpekBrowserPanel.<init>` died with
  `NoClassDefFoundError` before the `JBCefApp.isSupported()` guard could return anything (issue #24). Notes for the
  next time:
  - The backward-compatible way back in is a **v1 optional dependency on the owning plugin id** —
    `<depends optional="true" config-file="...">com.intellij.modules.jcef</depends>`. The platform deliberately grants
    old-format plugins all of a depended-on plugin's content modules, and an unresolved *optional* depends is not a
    strict dependency, so builds without that plugin id are unaffected.
  - **Never** put a mandatory v2 `<dependencies><module .../></dependencies>` in the main descriptor for something the
    supported range doesn't all have: an unresolved module dependency disables the whole plugin. `since-build` is 233
    (2023.3), so anything newer than that must be declared optionally.
  - A guard must catch `Throwable`, not `Exception` — `NoClassDefFoundError` is an `Error`.
  - `verifyPlugin` covers both ends of the range (`pluginVerification.ides` in `build.gradle.kts`). The IntelliJ
    Platform Gradle Plugin is pinned at **2.9.0**: 2.11.0+ needs Gradle 8.13+, 2.14.0+ needs Gradle 9, and the wrapper
    is 8.11.1 — 2.9.0 is also the version that added the `intellijIdea(...)` helper the 2026.x target needs.

**Frontend routes**: `/` (SelectRepo, web only) → `/dashboard` → `/specs` → `/specs/:topic` → `/changes` → `/changes/:slug` → `/graph`

## Key Design Decisions

- **Security**: Express only reads `.md` / `.yaml` files under `openspec/`; no arbitrary file access
- **BDD highlighting**: WHEN/GIVEN (blue), THEN (green), AND (gray), MUST/SHALL (red), ADDED/MODIFIED (orange/blue badge)
- **Dark theme**: bg #0a0c0f family, accent amber #f59e0b, text #e2e8f0
- **tasks.md parsing**: `- [x]` / `- [ ]` + `##` sections → `{ total, completed, sections }`. A task's
  **continuation lines are folded into `TaskItem.text`** (newline-joined, each dedented by up to 2 chars
  — the `- ` marker's CommonMark content offset), and the Tasks tab renders that text as Markdown. The
  folding rule is "whatever a standard CommonMark+GFM renderer shows for the same source", pinned by a
  test that compares against the reference renderer over every `tasks.md` in the repo — don't replace it
  with a friendlier heuristic (dedenting by the *smallest* indent instead diverges on 6-space
  continuations, promoting lazy prose into bullet lists no other viewer shows). Two rules carry it:
  the 2-char dedent (only observable on a blank line + ≥6-space indent, i.e. an indented code block —
  the single case any test can distinguish it by) and the blank-line boundary (after a blank line a line
  must be indented ≥2 to stay in the item, else standalone prose gets swallowed into the task) plus
  `BLOCK_OPENER_RE` (lazy continuation is paragraph-only, so a **column-0** bullet / ordered marker /
  ATX heading / blockquote / code fence / thematic break ends the task — indented, the same line still
  belongs to it). Entries in that regex were each checked against the reference renderer, **not read
  off the CommonMark spec**: `2.` ends an item even though "only a list starting at 1 interrupts a
  paragraph" reads otherwise, and `===` does *not*, being absorbed as paragraph text. Two divergences
  are knowingly kept (documented in the spec): a folded `===` renders as a heading, and a column-0
  checkbox inside a fenced block still counts — fixing the latter would move `total`.
  `CHECKBOX_RE` stays **anchored at column 0**: an indented checkbox belongs to its parent's text and is
  deliberately *not* counted, so relaxing the anchor would move every progress bar and CI badge. First
  lines keep trailing whitespace when folded, or two-space hard breaks silently become soft ones
- **Webview CSP**: IIFE + nonce script + unsafe-inline styles (Tailwind needs it)
- **Host flags**: VS Code sets `window.__vscodeApi` (`acquireVsCodeApi` called once, stored globally), IntelliJ
  `window.__spekIntellij`, Demo `window.__DEMO_DATA__`. `useFileWatcher` picks its refresh channel from these flags, so
  **every non-Web host must have its own flag** — IntelliJ once lacked one, was mistaken for Web, and opened an
  EventSource on `/api/openspec/watch`; the built-in server only serves `/api/spek/`, so that path 404s and it
  reconnects forever
- **Refresh**: `refresh(manual)` arms the busy state only on a manual refresh (a spinner appearing on an auto refresh
  is noise); busy lasts until the refetched data actually arrives, not when the resync POST returns (`refreshTracker`
  distinguishes fetches by generation, with a 500ms timeout guard). The state machine is pure logic and unit-testable
- **Refresh invariant**: a resync (cache-invalidation) failure **must not block the refetch** — it's best-effort,
  enforced in the single spot `runManualRefresh` (one 404 from IntelliJ's missing resync route once made the whole
  button go dead — issue #18). resync means "invalidate stale server-side state this host actually holds": Web/VS Code
  clear the git-timestamp cache, IntelliJ has no such cache (`timestamp` is always null) so it clears the schema-order cache
- **live-status**: `liveStatus` (live/offline/unsupported) only speaks up when `offline` — no always-on "everything's
  fine" light (an always-lit light is noise and dulls the real signal). VS Code/IntelliJ have no observable failure
  signal, so they always report `live` (lying `offline` is worse than not reporting)

## Conventions

- **English is the single source of truth for everything committed to the repo**: code, comments, `openspec/`
  artifacts, `docs/`, community files. The maintainer may think/draft in Traditional Chinese, but the version committed
  is finalized in English by an agent (or written in English directly). **Single source of truth ≠ English-only
  reading**: reading in another language is served by on-the-fly translation, not a second copy in the repo (two copies
  drift). Exceptions: the README is bilingual (`README.md` + `README.zh-TW.md`); conversation with the user stays in
  Traditional Chinese (that's conversation, not a repo artifact). Existing Chinese comments needn't be back-translated
  wholesale; new ones are in English
- OpenSpec data structure: see the "OpenSpec data model" section in `docs/prd.md` (authoritative detail in `openspec/specs/`)
- **CHANGELOG (two version lines)**:
  - **The spek product** (Web / VS Code / IntelliJ share the root `package.json` version) is recorded in three
    CHANGELOGs — root + `packages/vscode` + `packages/intellij` — sharing one version history but **each filtering out
    entries irrelevant to that channel** (root is the superset; filter down from it)
  - **`@spekjs/core`** and **`@spekjs/ui`** each have their own version line and CHANGELOG
    (`packages/core/CHANGELOG.md` / `packages/ui/CHANGELOG.md`), **not written into the three above** (their readers
    are API consumers). Each must be listed in that package's `package.json` `files` (npm doesn't auto-pack a CHANGELOG)
  - **`@spekjs/*` publishing is automated; the version decision is not.** CI publishes a package when its declared
    version differs from the registry (`.github/workflows/npm-publish.yml`, on `push:[master]`), authenticating via
    npm Trusted Publishing (OIDC — no token in repo secrets) and creating a `core-vX.Y.Z` / `ui-vX.Y.Z` tag on
    success. Never run `npm publish` locally and never hand-create those tags. Its filename is configuration — see
    the renaming table at the top of this file. The bump itself is chosen by the `release` skill from the archived changes' Impact, never from commit prefixes: core
    1.3.0 (`fix:` that added an export subpath) and 1.4.0 (`fix:`/`test:` that changed `TaskItem.text` semantics)
    would both have been under-bumped to a patch by a prefix rule
  - **Written at release time, not inside a change.** CHANGELOG entries and version bumps (`package.json` `version`,
    `gradle.properties` `pluginVersion`) belong to the release flow — `/release` for the product line, a separate
    `chore(npm): publish …` commit for the package lines. Do **not** list them in a change's `tasks.md` or do them
    while implementing one: the version step depends on everything shipping in that release, not on one change. If a
    change carries information the release notes will need (a new public export, a behavior change affecting registry
    consumers, additive-so-minor-not-patch), put it in the change's `proposal.md` Impact or `design.md` for whoever
    cuts the release

## Workflow

- **Changes go through the OpenSpec workflow**: for a feature / fix / modification, create a change first (proposal →
  design → tasks), then implement. `/openspec-new-change` to create, `/openspec-verify-change` to verify,
  `/openspec-archive-change` to archive
- **Exception**: pure-docs changes that don't touch any spec under `openspec/specs/` (README / CONTRIBUTING / `docs/*` /
  community files) are committed directly, without a change
- **On archive**: update affected docs (CLAUDE.md / README, etc.) and create a git commit
```
