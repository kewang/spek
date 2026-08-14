# spek — Product Requirements (Overview)

> **Status:** current as of v1.8.2 (2026-07).
> This document is the **narrative overview** of spek. The authoritative, per-capability
> requirements live as OpenSpec specs under [`openspec/specs/`](../openspec/specs) (43 capabilities
> at time of writing). When this overview and a spec disagree, **the spec wins** — update the spec
> first, then reconcile this document.

---

## 1. Overview

OpenSpec is a spec-driven workflow. Real projects accumulate large numbers of **specs** and
**changes** (each change carrying `proposal` / `design` / `tasks` and its own spec deltas). By
default that content is only readable as raw Markdown in a file tree or editor — there is no
structured browsing, no search, no status overview, no easy way to see how a spec evolved, and no
way to see how several in-flight changes relate to one another.

**spek** turns a local `openspec/` directory into a navigable, searchable interface: structured
browsing, BDD syntax highlighting, task-progress tracking, full-text search, spec history and diff,
a spec↔change dependency graph, and a lifecycle timeline. It is built for the **AI-agent era**,
where a single repository often has several git worktrees, each carrying a different in-flight
change in parallel.

---

## 2. Positioning

- **Read-only** viewer for OpenSpec content. It never writes to the user's project.
- **Local-only.** No server deployment, no authentication, nothing leaves the machine.
- Delivered as **four surfaces plus one CI helper**, all sharing the same core logic:

| Surface | What it is |
| --- | --- |
| **Web** | Local Express + React SPA; the user picks a repo path and browses in any browser |
| **VS Code extension** | Webview panel over the current workspace's `openspec/` |
| **IntelliJ plugin** | Kotlin + JCEF tool window for IntelliJ IDEA and other JetBrains IDEs |
| **Demo** | A single self-contained static HTML (`docs/demo.html`, GitHub Pages) that embeds spek's own openspec data |
| **GitHub Action** | Composite action (`spekhq/spek`) that generates an HTML snapshot and status badges in CI |

---

## 3. Non-goals

- **No content editing** — strictly read-only.
- **No authentication or access control.**
- **No OpenSpec workflow management** (creating / archiving changes, syncing specs). spek *views*
  the workflow; it does not drive it.
- **No hosted / cloud deployment** — it is a local tool. The demo is a static snapshot, not a live
  service.
- **Not a general Markdown viewer** — it is specifically shaped around the OpenSpec data model.

---

## 4. OpenSpec data model

```
{repo}/openspec/
├── config.yaml                     # repo default schema (e.g. schema: spec-driven)
├── specs/
│   └── {topic}/spec.md             # BDD-format capability spec (WHEN / THEN / AND / MUST)
└── changes/
    ├── archive/
    │   └── {YYYY-MM-DD-desc}/       # archived change
    │       ├── .openspec.yaml       # schema + created date
    │       ├── proposal.md          # Why / What Changes / Impact
    │       ├── design.md            # Context / Goals / Decisions / Risks
    │       ├── tasks.md             # checkbox task list
    │       └── specs/               # this change's delta specs
    └── {active-change}/             # in-flight change (same shape)
```

Key properties spek relies on:

- **Artifacts are discovered from disk, not hard-coded.** A change's tabs come from what actually
  exists: every root `*.md` is an artifact, a non-empty `specs/` is one artifact, classified by kind
  (`markdown` / `tasks` / `specs`). This is what lets **custom OpenSpec schemas** render their own
  artifacts as tabs without spek knowing them in advance.
- **Schema-aware.** A change's schema is read from `.openspec.yaml` (`schema:`), falling back to
  `openspec/config.yaml`. The schema badge is hidden when a change matches its worktree's default.
- **Default sort is file mtime (newest first)**, so an artifact being actively edited (e.g.
  `tasks.md`) floats to the front; ties break on a stable order (`proposal, design, specs, tasks`
  first, then alphabetical). The user can switch to *Schema order* or *A–Z*.
- **Language:** OpenSpec artifacts are authored in **English** as the canonical record (see §7). They
  are also the demo's content, i.e. a public showcase surface.
- **Change naming:** `YYYY-MM-DD-description`.

---

## 5. Architecture

### 5.1 Monorepo (npm workspaces)

| Package | Role |
| --- | --- |
| `@spekjs/core` | Pure Node.js logic — scanner, tasks parser, artifact discovery, schema-order resolution, git-timestamp cache, worktree aggregation, types. **Published to npm** on its own version line; only runtime dependency is `cross-spawn`. |
| `@spekjs/ui` | Reusable presentational components (`SpecGraph` force-directed graph, `ChangeTimeline` Gantt). **Published to npm.** Pure presentation: data in via props, selection out via callbacks — **no router, no adapter, no CSS framework**. Colors are expressed as 8 `--spek-*` CSS variables (its own contract, not the host's tokens). |
| `@spekjs/web` | Express API server + React SPA. |
| `spek-vscode` | VS Code extension; the extension host calls `@spekjs/core` directly. esbuild bundle. |
| `spek-intellij` | IntelliJ Platform plugin (Kotlin). Re-implements the core scan/read logic in Kotlin; the IDE's built-in server exposes REST; JCEF loads the SPA. |

The core scan/read logic exists once in `@spekjs/core` and is mirrored in Kotlin for the IntelliJ
server. Behavior changes in one must be checked against the other.

For the **task parser** specifically that check is mechanised: both implementations read one shared
fixture corpus (`test-fixtures/task-parser/`), so adding a case is adding a file and both languages
assert it. A generator feeds the same loaders randomised inputs to find divergences nobody thought
of. The rest of the mirrored logic — scanner, change reader, artifact discovery, schema order — is
still checked by hand.

### 5.2 API adapter pattern

The frontend abstracts its transport behind an `ApiAdapter` interface, injected via React context:

- **`FetchAdapter`** — Web + IntelliJ (REST, with configurable `baseUrl` / `dirParam`)
- **`MessageAdapter`** — VS Code webview (`postMessage` to the extension host)
- **`StaticAdapter`** — Demo (reads build-time `window.__DEMO_DATA__`)

Each non-Web host sets a global flag (`window.__vscodeApi`, `window.__spekIntellij`,
`window.__DEMO_DATA__`) so the live-update layer picks the right refresh channel.

### 5.3 Web API endpoints

All `openspec` routes accept a `dir` query param. `/changes`, `/overview`, `/graph`, `/watch` also
accept `aggregate` (default true, cross-worktree aggregation).

```
GET /api/fs/browse?path=...                       # directory browse (repo picker)
GET /api/fs/detect?path=...                        # detect an openspec/ dir
GET /api/openspec/overview?dir=...&aggregate=      # overview stats
GET /api/openspec/specs?dir=...                    # spec list
GET /api/openspec/specs/:topic?dir=...             # single spec
GET /api/openspec/specs/:topic/at/:slug?dir=...    # spec content at a change (diff)
GET /api/openspec/changes?dir=...&aggregate=       # change list
GET /api/openspec/changes/:slug?dir=...&wt=        # single change (wt = source worktree)
GET /api/openspec/graph?dir=...&aggregate=         # spec↔change graph data
GET /api/openspec/search?dir=...&q=...             # full-text search
```

### 5.4 Tech stack

| Layer | Choice |
| --- | --- |
| Core | Node.js + TypeScript (framework-free) |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 |
| Backend | Express.js (reads local files, serves REST) |
| Markdown | react-markdown + remark-gfm (BDD highlighting) |
| Search | Server-side full-text + Fuse.js |
| Routing | React Router v7 (Web: BrowserRouter; webview: MemoryRouter) |
| VS Code | Webview API + esbuild |
| IntelliJ | Kotlin + JCEF + IntelliJ Platform SDK |

---

## 6. Features

Each maps to one or more specs under `openspec/specs/`; that directory is authoritative for detail.

- **Dashboard** — counts of specs and changes (active / archived), task completion, plus lifecycle
  stats (avg archived lifecycle, stale active changes).
- **Specs browser** — alphabetical list with instant filter, detail view with BDD highlighting and a
  table of contents, revision history, and **spec diff** between change versions.
- **Foldable spec sections** — requirements and scenarios render as collapsible sections
  (requirements open, scenarios closed) so a spec opens as an outline carrying its normative
  sentences rather than as a wall of text; Expand all / Collapse all, remembered across specs and
  sessions. Applies to spec detail and a change's Specs tab, not to its other artifacts. An open
  section is inset with a hairline rule marking its extent, so nesting is carried by position and not
  by type size alone. The rule runs from its heading to the last of its content — not the full height
  of the section's box, which also holds the space separating it from the section above and the
  trailing space below its last paragraph, so a rule drawn to the box overstates its section at both
  ends and closes up the gap between siblings.
- **Spec typography** — in spec content a level-2 heading is a structural separator, not a content
  heading, so it renders as a subordinate label; the delta spec's topic is the dominant header of its
  section, which matters most in a change's Specs tab where several specs stack in one view.
  Requirement and scenario headings drop their `Requirement:` / `Scenario:` keyword, which position
  already carries — in the rendered content, in both tables of contents and in the VS Code sidebar, so
  the surfaces agree on what a heading is called. Presentation only: the file, the heading ids and every
  anchor are unchanged.
- **Changes browser** — active and archived changes; each change renders its disk-discovered
  artifacts as tabs (Proposal / Design / Tasks / Specs and any custom-schema artifacts), with
  user-selectable tab ordering (Last modified / Schema order / A–Z) and a schema badge.
- **Git worktree aggregation** — discovers every worktree of a repo and merges their in-flight
  changes into one view; duplicate active changes are de-duplicated by a git-divergence election
  rather than file timestamps.
- **Timeline** — horizontal Gantt-style chart of every change's lifecycle, with optional spec-topic
  grouping, status filters, and an auto-scaling time axis.
- **Graph view** — force-directed spec↔change dependency graph, aggregation-aware.
- **Workflow schemas** — the schemas available to a repo, each rendered as a diagram of its steps
  grouped by dependency level, with the implementation and archive steps shown as part of the flow.
  Which schemas exist is only ever asked of the OpenSpec CLI. Where a schema declares an artifact
  produced *after* implementation — something the format cannot state, so authors express it in
  prose — spek derives the ordering from the dependency graph and draws it as a **dashed edge
  marked as derived**, never as a dependency the CLI blocks on.
- **Full-text search** — `Cmd/Ctrl+K`, across specs and changes, with context previews.
- **BDD syntax highlighting** — WHEN/GIVEN, THEN, AND, MUST/SHALL, and a badge for each delta
  operation (ADDED / MODIFIED / REMOVED / RENAMED).
- **Live reload** — watches `openspec/` and refreshes on change, with an automatic **polling
  fallback** on filesystems that don't deliver native events (9p / drvfs / NFS / CIFS — devcontainer
  / WSL).
- **Host-specific** — VS Code sidebar Specs tree with per-heading anchors; IntelliJ tool window with
  a collapsible tree panel and theme sync; a repo picker with recent paths (Web).
- **CI** — the GitHub Action produces an HTML snapshot and status badges (specs / open changes /
  tasks).

---

## 7. Key design principles

- **Local-only file access.** The server only ever reads `.md` / `.yaml` files under an `openspec/`
  directory — no arbitrary file access. This is the load-bearing security property behind
  "nothing leaves your machine."
- **English is the single source of truth** for everything committed to the repo — code, comments,
  OpenSpec artifacts, `docs/`, community files. The maintainer may draft in Traditional Chinese and
  have an agent finalize the committed English; readers who want another language are served by
  on-the-fly translation, not a second copy in the repo. The English README has a `README.zh-TW.md`
  companion. (See `CONTRIBUTING.md` and `CLAUDE.md`.)
- **Artifacts are discovered, not enumerated.** Scanning never calls the OpenSpec CLI; the authoritative
  schema order is resolved lazily (and cached per `repoRoot::schema`) only when a single change is
  opened.
- **Refresh is best-effort and honest.** A cache-invalidation (resync) failure must never block a
  refetch; the busy indicator lasts until refetched data actually arrives; live-status only surfaces
  when the update channel is genuinely `offline` (no always-on "everything's fine" light).
- **`@spekjs/ui` owns its color contract** — 8 `--spek-*` variables — so hosts with different design
  tokens still get a colored graph.

---

## 8. Verification

There is no single "app" to boot — each surface is verified on its own:

1. **Web** — `npm run dev`, open `http://localhost:5173`, point it at a repo containing `openspec/`,
   and confirm the Dashboard counts, spec/change browsing (all tabs), search, BDD highlighting, and
   live reload on a file edit.
2. **VS Code** — build and run the extension in an Extension Development Host on a workspace that
   contains `openspec/config.yaml`; confirm the panel and the Specs sidebar tree.
3. **IntelliJ** — `./gradlew runIde`; confirm the tool window, tree panel toggle, and theme sync.
4. **Demo** — `npm run build:demo` (with `NODE_ENV=production`) and open `docs/demo.html`
   standalone.
5. **GitHub Action** — the action has **no automated coverage**; changes touching the build chain
   must be verified manually (see the `action.yml` note in `CLAUDE.md`).
