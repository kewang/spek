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
  presentational**: data in via props, selection out via callbacks; no router / adapter / CSS framework. Colors are 9
  `--spek-*` CSS variables (its own names, never the host's tokens) and **nothing else** — see the colour-contract
  entry under Key Design Decisions. The web `/graph` and `/timeline` pages are thin shells (fetch / loading /
  navigation / theme).
- React 19 + Vite + TS + Tailwind v4; Express (REST); VS Code Webview + esbuild; IntelliJ Kotlin + JCEF + built-in
  server; react-markdown + remark-gfm (BDD highlighting); search = server-side full-text + Fuse.js; React Router v7
  (Web BrowserRouter / webview MemoryRouter).

## Project Structure

```
packages/
├── core/       # @spekjs/core — pure logic (scanner.ts, tasks.ts, artifacts.ts, schema-order.ts, schemas.ts,
│            #   schema-flow.ts, openspec-cli.ts, git-cache.ts, types.ts)
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

**`build:demo` reads the machine it runs on, and `docs/demo.html` is published as committed.** Pages does
checkout → upload; CI builds the demo only as a discarded smoke test, so whatever you commit is what ships.

Schema enumeration reads the machine, and **the script guards this itself** — `filterPublishableSchemas` drops
`source: "user"` and untracked project schemas, `deLocalise` replaces each definition's absolute `path` with its
`displayPath`. What survives is what a clean checkout has. This replaced a note asking the builder to move their
schemas aside by hand; another machine-dependent source belongs in that guard, not in a note here.

Still unfiltered: `specs[].path` carries the builder's absolute repo path — predates schemas, separate cleanup.

**`runIde` blocks on two one-time dialogs in a fresh sandbox** (the JetBrains agreement, then Trust Project), which
matters on any machine without someone to click them — CI included. `./gradlew runIde -Pspek.headlessIde` sets
JetBrains' own `jb.consents.confirmation.enabled` / `jb.privacy.policy.text`; it is **opt-in because it suppresses a
consent prompt**, appropriate only for a throwaway sandbox you are driving yourself. Trust is separate, seeded via
`build/idea-sandbox/*/config/options/trusted-paths.xml`.

**Rebuild the webview before verifying the tool window.** `src/main/resources/webview/` is a build artifact; a stale
one silently shows old UI while the source is already fixed — VS Code got a wording fix hours before IntelliJ did,
because only the VS Code bundle had been rebuilt.

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
  `@spekjs/core/headings` subpath** so the webview bundle doesn't pull in server-only modules) and
  `specHeadingLabel` beside them — the one rule for what a spec heading *displays*, i.e. without its
  `Requirement:` / `Scenario:` keyword. **Display only, and nothing is derived from it**: `text` is what
  the file says, `slug` comes from `text`, and a slug built from the label would silently unmake every
  existing anchor. Four surfaces call it (rendered content, both TOCs, the VS Code tree) and each was one
  regex away from disagreeing with the others about what a heading is called. Pass the **whole** heading
  text: a requirement named after a code span opens with a text run that is exactly `Requirement: `, and
  judging that run alone keeps the keyword in the content while the TOC — reading the file's line —
  drops it
- `ChangeDetail.artifacts: ChangeArtifact[]` is the contract across core / API / frontends, driving both tabs and TOC
  (markdown / specs have a TOC, tasks doesn't)

**schema-order cache**: `schemaOrder` comes from the CLI (`openspec status --change <slug> --json`), queried **once,
only when a change detail is read** — never on the scan hot path. The authoritative order depends only on the schema,
so the cache is keyed `${repoRoot}::${schema}` (all changes sharing a schema share it, spawning the CLI at most once —
issue #15). A change whose schema name doesn't resolve locally **still gets queried** (the CLI returns a built-in
default), sharing a sentinel bucket `${repoRoot}::\0default`. **The only early null is an empty slug**; it's also null
when the CLI is unavailable / for archived changes, and the frontend falls back to narrative order with a reason.

**Workflow schemas** (`schemas.ts` + `schema-flow.ts`): `listSchemas(repoRoot)` enumerates via
`openspec schemas --json`; `readSchema(repoRoot, name)` resolves the directory via `openspec schema which` and parses
the YAML there. Three sources in resolver precedence — `project`, `user` (the machine's global data dir), `package`
(inside the npm package) — and **all three must be recognised**: an unhandled `source` made the enumeration drop the
schema entirely, so a machine-level schema silently vanished rather than appearing mislabelled.

**Which schemas exist is only ever asked of the CLI — never worked out from disk, not even for the repo's own
`openspec/schemas/`.** That is the one place spek does *not* read `openspec/` content directly, and the exception is
the point: a schema is configuration for OpenSpec's engine, resolved across three directories with precedence and
shadowing, of which a repo holds one. Reading it ourselves meant answering — with a more forgiving parser, against a
versioned format whose commands the CLI still marks experimental — a question OpenSpec owns, and it showed: a
`schema.yaml` OpenSpec refuses to run was drawn as though it were runnable. There is **no disk source, no merge, and no
disk fallback in `resolveSchemaPath`**. A CLI failure is a **degraded 200** carrying an *empty* list plus a
`degradedReason` — the same shape `schemaOrder` degrades to, and for the same reason. If you find yourself adding a
filesystem read to decide what a schema is, that is the regression.

**`schema-flow.ts` is browser-safe and exported at the `@spekjs/core/schema-flow` subpath** (like `headings`), because
the SPA needs the graph maths and the package index reaches for `child_process`. It owns facts about the `requires`
graph — `computeArtifactLevels`, `levelArtifacts`, `applyStepLevel`, `schemaArtifactCount`,
`drawableEdges` (and `drawableRequires`, its provenance-free delegate), `postApplyArtifacts`,
`resolveImplementationOrdering` — kept out of the view's
geometry on purpose. Three rules worth knowing:
- **`artifactCount` is one per declared artifact, and the noun is OpenSpec's, not ours.** `artifacts:` is the
  `schema.yaml` key, the CLI's enumeration field, and `planningArtifacts` in `status`; spek views OpenSpec content, so a
  synonym would just make a reader translate back. Two artifacts sharing a dependency level count separately — both are
  work. The count says how much a schema asks for; the diagram says the shape. `apply` and archiving are excluded by one
  rule: both belong to every schema alike, so counting them adds the same constant everywhere. `apply` is also the *only*
  work declared outside `artifacts:` (the sole top-level keys any surveyed schema uses are `name`, `version`,
  `description`, `artifacts`, `apply`, `format`), so nothing else goes uncounted.
  **This is why `/schemas` costs one CLI call, not 1+N.** The enumeration lists artifact *names* without their
  `requires` — enough for the count, so no summary needs a definition read. An earlier `stageCount` defined as *distinct
  dependency levels* needed the whole `requires` graph, which meant a `schema which` per schema on a cold list. If you
  find yourself reaching for a definition to fill a `SchemaSummary` field, that is the regression.
- **The diagram draws the transitive reduction** (`drawableEdges`, over origin-carrying edges). A `requires` entry a
  longer path already implies states nothing new, and drawing it is worse than redundant — it detours around the very
  step that implies it. Across eleven community schemas surveyed, *every* curved edge was one of these. Levelling still
  uses the **full** `requires`.
- **A step that follows implementation is *derived*, and the diagram says so.** OpenSpec cannot express it: an
  artifact's `requires` may name only other artifacts (the CLI's build-order pass dereferences each entry as a declared
  artifact), and `status` treats every artifact as a *planning* artifact, telling you to apply once all of them exist.
  So authors point such an artifact at the last planning artifact and state the truth in prose — `superpowers-bridge`'s
  `verify` and `anvil`'s both do. `postApplyArtifacts` recovers it: outside the transitive closure of `apply.requires`,
  and its own closure covers all of `apply.requires` — so it cannot precede apply and apply does not need it. Two
  guards, each for a real input: **at least one resolvable `apply.requires`** (the superset test is vacuously true
  against an empty set and would flag everything) and an **acyclic graph** (levels are declaration order under a cycle,
  so there is no ordering to derive against).
  This is a **bound, not a reading of intent** — about 82% precise over the ~88 schemas discoverable on GitHub. It
  misreads planning artifacts that happen to depend on everything apply requires, and schemas that model implementation
  as an ordinary artifact rather than through `apply`; nothing declared separates those from the real thing. Hence the
  edge is drawn **dashed and labelled derived**, never as a dependency the CLI blocks on. Ask
  `resolveImplementationOrdering`, which returns the ordering *and its source* (`declared` | `derived`) per step: when
  OpenSpec ships a way to declare this (#1456), it is a branch there and nothing else moves — pinned by a test that a
  schema naming the apply phase in its `requires` renders as an ordinary solid edge. **The derived edge is reduced
  like a declared one** (`drawableEdges`, a plain transitive reduction counting declared and derived hops alike): a
  post-implementation step whose declared dependency apply already covers draws **one** edge, from apply, not two —
  `anvil`'s `verify` declares `requires: [tasks]` and apply requires `tasks`, so `tasks → apply ⇢ verify` carries it
  and the direct `tasks → verify` edge is dropped. This is the bound the derivation *accepts*, not a fact it hides: on
  the ~18% misread, the surviving edge is the derived (dashed, captioned) one, so the reader is told it is an inference;
  the exact `requires` still lives in the panel. Keeping the declared edge alongside — the earlier belt-and-suspenders
  after `spec-super` showed only a dashed line — drew every correct case with two lines saying one ordering, undoing
  the simplification this feature exists for. Levelling runs on the **full** graph *before* that reduction, so the
  levels stay a guarantee rather than a coincidence.

**`openspec-cli.ts`**: one place for spawning the CLI (stderr discarded, `windowsHide`) and for `ttlCached` (256-entry
cap). The two durations live in **`cli-budget.ts`** — its own browser-safe subpath, because the webview must derive its
request timeout from the CLI's rather than coincide with it (10s timeout; 30s TTL, deliberately >= the timeout so an
in-flight call is never judged stale). Both the runner and the cache were
written twice before this existed, once in `schema-order.ts` and again in `schemas.ts`, and the cache's original
"remember failures forever" bug had to be found once and hand-copied into the second copy. A non-zero exit that still
returns a JSON body is **not** a tool failure: `schema which <unknown>` prints `{"error": "Schema 'x' not found"}` and
exits 1, so discarding stdout there reports a working CLI as broken. The Kotlin side mirrors this split
(`OpenspecCli.kt`, `SchemaCatalog.kt`, `SpekCaches.kt`) — but **not** `schema-flow.ts`, which has no Kotlin caller: no
Kotlin host draws the diagram, since the IntelliJ tool window loads the same React SPA.

**The cache remembers answers, not every failure** — `compute` returns `{value, remember}` (`answered` / `failed`), and
a failure is dropped once it resolves, so the next read retries. It is required, with no default: every call site that
existed when this landed had got it wrong, and one unreachable CLI meant 30s of stale "unavailable" even after `PATH`
was fixed (issue #46, reported by an Electron consumer that resolves the user's shell `PATH` at startup). Three things
about it:
- **The cache cannot judge the value, because the value has already lost the distinction.** A null schema order is both
  "the CLI answered and there is no order" and "the CLI could not be reached"; a definition read reports "no such
  schema" for a name the CLI refused *and* for a `schema.yaml` it could not open. So `readSchemaUncached` classifies
  inside itself — it is the last place holding the two apart — while `listSchemas` reads the reason off the catalog.
- **Not every failure is worth retrying**, and `isTransient` is the one rule: `cli-unavailable` / `cli-timeout` yes,
  `cli-failed` / `cli-unparsable` no. The second pair is the *installed CLI* answering, identical a second later, and it
  is also the expensive pair (~0.65–1.3s against ~5ms for a missing binary) on views that refetch per watcher event.
  Forgetting those turned a 30s wrong answer into a permanent ~1s tax per read. A reason added later must be placed on
  one side of it.
- **`schema-order` is the exception, and not for the environment's sake**: no unsuccessful run is held in the
  *bucket*, because the key names a schema while the argv names a change — a refusal of one slug is not the bucket's to
  keep, and holding it denied the order to every other change sharing the schema. Not the bucket's to keep is not the
  same as not worth keeping, so a **settled** failure (`isTransient` false) is remembered against the change it was
  about, in a second, slug-keyed store: dropping it entirely made an installation that answers nothing — one too old for
  `status --change --json` — cost a process start on every change-detail read. Three rules hold that store in place, and
  each is a bug that was reasoned through rather than found:
  - **The bucket is consulted first.** A settled change is still owed its schema's order: the sequence is a property of
    the schema, so once a sibling has fetched it, a plain cache hit serves the refused change too — which is what
    already happened, at zero spawns. The mark replaces a *consultation*, never an answer, and a mark read ahead of the
    bucket is a regression wearing a fix's clothes.
  - **The mark is read outside the cache and written inside `compute`.** Read inside, a concurrent read of a different
    change joins an entry that never spawned and inherits a settlement that was not about it. Written outside, a reader
    that legitimately *joined* another change's run takes that run's null and marks itself. Only `compute` holds both
    the reason and the slug the argv named. For the same reason the Kotlin unsafe-slug allowlist (a Windows
    argument-injection boundary with no TS counterpart) sits **outside** `getOrCompute`: it spawns nothing, so there is
    no run to share.
  - **`cli-unparsable` is marked per change too**, though it is a property of the installation rather than the change —
    a repo-scoped mark would cost one consultation per window instead of one per change. A second scope is a second
    lifetime and a second invalidation site, and `isTransient` is the rule a new reason is already required to be placed
    against. If it ever moves, it is that reason alone.
An entry is still installed while in flight — not remembering a failure must not become not deduping one — and a
rejection is dropped too (Kotlin does this in a `finally`, since a compute that throws leaves no outcome to inspect).

**Artifact sort**: the rule is `sortArtifacts(artifacts, mode, schemaOrder?)` in **core**, beside `DEFAULT_ORDER` /
`defaultRank` on the `@spekjs/core/artifact-order` subpath — `modified` (the order given, i.e. mtime; default) /
`schema` (`schemaOrder`, falling back to the narrative order when it is absent, which is what archived changes always
get) / `alpha` (title, via `localeCompare`, so ordering is host-collation dependent). `ArtifactSortMode` is derived
from the exported `ARTIFACT_SORT_MODES` — validate a persisted preference against **that array**, never a hand-written
copy: a copy missing an entry still satisfies the type, and the omitted mode silently stops restoring. Core owns what
the modes mean; **each host owns where the choice is stored** (web: `localStorage["spek:artifact-sort"]`). `modified`
may return the array it was given, so **callers must not mutate a returned list**. It is **generic in the element**
(`<T extends Pick<ChangeArtifact, "id" | "title">>`), so a consumer's own DTO survives the call — it reorders the
objects it is handed and never rebuilds one, and returning `ChangeArtifact[]` regardless of the input dropped, at the
type level only, fields the result still carried, leaving consumers an unchecked cast (issue #45). `byDefaultOrder`
carries `Pick<ChangeArtifact, "id">` for the same reason — left at `ChangeArtifact`, `T` is not assignable to it and
the generic version does not compile. The guard for this is a **type-level** test in `artifact-order.test.ts`
(assignment back to the caller's own array type, plus a `@ts-expect-error` on an element missing `title`), because no
behavior test can see a narrowed return type; it is checked by `tsconfig.test.json`, i.e. by `npm run type-check`,
not by `npm test`.

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
GET /api/openspec/schemas?dir=...&aggregate=        # workflow schemas + active-change usage
GET /api/openspec/schemas/:name?dir=...             # one schema's definition (404 carries `reason`)
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

**Frontend routes**: `/` (SelectRepo, web only) → `/dashboard` → `/specs` → `/specs/:topic` → `/changes` → `/changes/:slug` → `/graph` → `/schemas` → `/schemas/:name`

## Key Design Decisions

- **Security**: **no arbitrary file access.** For repo-local reads that is achieved by containment —
  Express only reads `.md` / `.yaml` files under `openspec/`. Schema reading is the one path that
  reaches outside it: a package schema lives wherever npm installed the CLI, so the path comes from
  `openspec schema which <name> --json` and the `schema.yaml` there is read directly. Containment
  cannot be the guard there, so **name validation is** — an explicit allowlist
  (`isSafeSchemaName`, no separators, no `.`/`..`, no leading/trailing punctuation) gates the name
  before it reaches the CLI *or* the filesystem, and the same rule is stated in Kotlin with `\A`/`\z`
  anchors (Java's `$` also matches before a trailing newline, so `^…$` would accept `"spec-driven\n"`
  on that side only). The property is unchanged; only the mechanism differs for that one path
- **BDD highlighting**: WHEN/GIVEN (blue), THEN (green), AND (gray), MUST/SHALL (red), and a badge per
  delta operation — ADDED orange, MODIFIED blue, REMOVED purple, RENAMED pink. **All four operations are
  marked**; two of them went unhandled for a long time because the only occurrences in-repo are section
  headings, and `processChildren` runs on `p` / `li` / `strong` **only** — no heading has ever been
  keyword-marked, so nothing looked broken. **REMOVED is deliberately not red**: red already means
  "normative" here, and one colour carrying two meanings weakens both. Each hue is a **per-theme token**
  (`--color-kw-*`, `--color-badge-*`,
  `--color-code-text`), not a Tailwind palette class — those were shared by both themes, and no 400
  shade in any family clears even 3:1 on the light background, so every mark failed WCAG AA there while
  dark passed and hid it. **Adding a mark means adding both theme's values.** Pill fills stay plain
  `bg-*-500/20`: an alpha composites over whichever page colour is active and needs no token. The
  highlight must never *lower* the weight it found — a keyword inside `**bold**` inherits instead
  (`BDD_WEIGHTS` is suppressed inside `<strong>`), or the emphasised word renders lighter than the
  emphasis around it
- **Spec section folding**: `### Requirement:` / `#### Scenario:` render as native `<details>` —
  requirements open, scenarios closed — so a spec opens as an outline with substance rather than a wall.
  `rehypeSpekFoldSections` (pure, in `utils/foldSections.ts`) regroups the hast tree and **must run
  after** `rehypeSpekHeadingIds`, which needs a still-flat tree for its dedup counter. Native
  `<details>` is chosen because it is the only mechanism find-in-page can ever see, and it brings
  keyboard and a11y behaviour for free; the elements are **uncontrolled** (React sets only the initial
  `open`), so Expand/Collapse all works by remounting on a generation `key` and `scrollToAnchorId` may
  open ancestors by touching the DOM directly. Folding is **opt-in per call site** (`fold` prop) — the
  renderer is shared with proposal / design / tasks, which must stay unfolded.
  An open section is **inset with a hairline left rule**, done as CSS on `details[data-spek-fold][open]`
  rather than by wrapping the body in the transform: `foldSections.ts` is a pure function whose tests
  assert its output shape, and styling is not worth churning the one piece of folding that can silently
  lose content. **Which selectors carry `[open]` is the whole design, in both directions:**
  - **`[open]`-scoped** — the inset, the `> summary` negative margin that cancels it, and the rule
    itself. Unscoped, that margin shifts *closed* sections one step left of open ones, which the default
    mode (requirements open, scenarios closed) shows on first render. The two values must stay equal, or
    headings drift; there is a test for exactly that.
  - **Deliberately unscoped** — the `margin-bottom` separating sibling sections, the `display: flow-root`
    that keeps interior margins interior, the `padding-top` holding the space above a heading, and the
    `> summary` padding that stops the disclosure marker being drawn against the rule. Anything here
    keyed to `[open]` moves the page as a reader toggles a section, which is the defect these rules
    exist to prevent.

  **The rule is a `::before`, and neither of its ends is the section's box** — the box holds two spaces
  the content does not. A `border-left` (what shipped through v1.13.0) starts at the box top, i.e. above
  the heading, and that space is also what separates this section from the one before it: of the 28px
  between two requirements, 20px was drawn, so the gap added in v1.13.0 was invisible and the page read
  as one interrupted line (issue #42). The same at the bottom, where `flow-root` seals the last
  paragraph's `mb-4` inside the box and the rule ran 20px past the last thing it enclosed. So `top` and
  `bottom` clear `--color-fold-lead` / `--color-fold-trail`; `top` is the same property the section's
  `padding-top` reads, which is what makes the rule's start and the space it clears one value rather
  than two that can drift. **Both restate a value the renderer owns** (`h3`'s `mt-5`, `h4`'s `mt-4`,
  `p`'s `mb-4`) — CSS cannot read a descendant's margin, so tests pin the pair; change a heading's
  spacing utility without them and folded specs silently stop matching unfolded content.
  It is painted with `border-left` on a zero-width box, **not a background**: forced-colors mode drops
  backgrounds and forces borders to `CanvasText`, and the mark is a normative requirement.
  Removing the border also removed the 1px it added inside every open section — open and closed headings
  now sit on the same left edge, which the spec required and v1.13.0 quietly violated.

  Only the **outermost** open section draws a rule (`[open] [open]::before` is `content: none`): two
  rules of equal weight in parallel read as one ornament repeated. The condition is *a fold inside a
  fold*, never `data-spek-fold="4"` — fold levels come from the caller, which is also why the *leading
  space* follows nesting rather than heading level: a scenario with no requirement before it is
  top-level and is spaced as one. `flow-root` is load-bearing and non-obvious: without it the body's
  last margin collapses **out** of the section, so the gap between sections became whichever was larger
  and opening a scenario pushed everything below it down by another 8px.
  The rule uses `--color-fold-rule`, **not `--color-border`**: the panel border measures 1.4:1 dark and
  1.2:1 light, and marking a section's extent is a stated requirement, not decoration. One mid-gray
  clears 3:1 against both backgrounds, so it is deliberately one value — re-measure if either
  `bg-primary` moves.
  **This is CSS geometry, so jsdom cannot see it** — the tests assert the *shape* of these rules as text
  against `global.css`, and the geometry itself was settled by rendering the real component with the
  real built stylesheet in headless Chrome and scanning the rule's pixel column
- **Spec typography is declared, not detected**: `MarkdownRenderer`'s `specShaped` prop demotes `h2` to a
  subordinate label, because in a spec every `h2` is a structural separator (`## Purpose`,
  `## ADDED Requirements`) while in a proposal or design it is a content heading. It is **deliberately
  not derived from `fold`**, though today both are passed at exactly the same two call sites: `fold` is a
  reader-toggled, persisted view state, and spec-shapedness is a fact about the document — tie them
  together and a future "don't fold" mode restyles headings as a side effect. The demotion stops **at**
  `h4`'s size and weight, never below: demoting further would rebuild the same inversion one level down.
  Heading levels and ids are untouched, because levels decide where folded sections end. In the Specs
  tab the delta spec's topic header is the section's dominant element — it used to be a `text-sm` `h3`
  *sibling* of the content's `h2`s, so it was terminated by the first one rather than containing them
- **Dark theme**: bg #0a0c0f family, accent amber #f59e0b, text #e2e8f0. Light: bg #f8fafc family, accent
  #92400e, text #0f172a
- **Palette contrast is a stated obligation with a test behind it** (`theme-toggle`, generalising what #42
  stated for the renderer's own marks). Every colour applied to text clears 4.5:1 **in both themes**, and a
  graphic that is the only carrier of its information clears 3:1. Three things about how it is measured, all
  of which change what a "passing" value is:
  - **Against the worst of the theme's three surfaces**, not a nominal one. There is no map of which text
    lands on which surface and a hand-written one is wrong the moment a component moves. Half the original
    figures in this repo were quoted against `bg-primary`, which is the *easiest* surface in both themes.
  - **Plus its own tint, where it has one.** `bg-accent/20 text-accent` (search highlight, and `@spekjs/ui`'s
    badge) is what forces the light accent two ramp steps darker than plain link text needs — a tint moves
    the background *toward* the text.
  - **Opacity counts as part of the colour.** `opacity-60` on a completed task row put everything under it
    below the floor, including the links and code spans that set their own colour, and no token value can
    compensate — the multiply happens after the colour is chosen. De-emphasise with a token; `disabled:` is
    the only exemption (WCAG 1.4.3).

  `contrast.test.ts` parses **both blocks** of `global.css` and measures a declared table, then scans the
  source for the six ways to bypass it: a hard-coded `text-<family>-<shade>`, a `bg-<token>/<alpha>` at an
  alpha the table doesn't list, a `border-<token>/<alpha>` that is neither measured nor in
  `DECORATIVE_BORDERS`, a bare `opacity-*`, a `--color-*` token reaching SVG, and an alpha reaching an SVG
  element. **Adding a colour token means adding a table row or an
  exclusion** — a test fails on any `--color-*` that is neither, and **a token's role does not exempt it**:
  a surface token applied as text on a solid fill (`bg-accent text-bg-primary`, the primary call to action)
  is measured by `TEXT_ON_FILL`, because counting it as accounted-for by being in `SURFACES` is what left it
  measured by nothing. **The enumeration is stated with the scan, including what it does not cover** — an
  unstated enumeration reads as a complete one, which is how both of those gaps survived. Outside it: inline
  `style`, `ring-*` / `outline-*` / gradients, literal alphas of non-token colours, a bare `opacity` /
  `fill-opacity` / `stroke-opacity` attribute on an element whose colour is **not** a token (`currentColor`
  and literal fills — the checkmark disc's `opacity="0.2"`, measured by hand, passing), and the BDD marks,
  whose fills are Tailwind palette values that would have to be pinned here and would drift on upgrade.

  **The two SVG scans were the third gap, and the one that shows what an exclusion costs.** SVG presentation
  attributes sat in that "outside it" list on the strength of one decorative occurrence, and stayed there
  while the schema diagram came to state its dependencies, its declared-vs-derived distinction and its
  archive mark entirely through them — every line of it at 1.13:1 light, under a check reporting the palette
  as conforming. `theme-toggle` now holds that an exclusion rests on how the app *uses* a mechanism and is
  re-decided when that use changes. Two things about the scans that are not the obvious shape:
  - **Colour is matched by the token, not by the attribute.** The arrowhead colours live in an object
    literal and reach the element as `fill={color}`, so a `stroke=`/`fill=`-scoped pattern misses them while
    reporting the diagram as covered — and matching the token needs no multi-line parse that could bridge
    one element's attribute to the next element's value.
  - **Alpha is scanned too, and only numeric literals are judged.** `--color-text-muted` is 5.17:1 at full
    strength and 1.39:1 at a quarter; declaring the accounted alphas without surfacing the unaccounted ones
    left `strokeOpacity={0.25}` passing everything. An identifier is a pass-through: a named constant is
    measured where the tables import it — they take `MARK_COLOR` / `MARK_OPACITY` from
    `schemaLayout.ts` rather than restating them — and its definition is an `opacity:` property the same
    scan reads.
- **`@spekjs/ui` carries the same obligation, stated in terms it can actually check.** The package has no
  theme — a host maps its tokens onto the contract — so "per-theme token" is not a rule it can hold. Its rule
  is that **the contract is the only source of colour**: no literal outside the `:root` defaults and
  `FALLBACKS`, with exactly two exemptions, both written into `ui-package` (`transparent`, which renders
  nothing and is how a tint of a contract colour is expressed; and a shadow's black, which is the absence of
  light rather than a chosen colour). Eleven literals had grown beside the contract and most were **copies of
  a contract value** — the archived graph node held `--spek-text-muted`'s former dark default and stayed at
  2.93:1 after the host re-authored that token, which is the whole argument in one number.
  Three consequences worth knowing:
  - **Adding a contract member is the one change existing hosts do not inherit.** A host overrides the names
    it knows, so a new one silently takes the package's dark default. That is why only `--spek-node-active`
    was added (the graph's active-change green is the one colour the others cannot express) and why the two
    node strokes take their fill's colour instead of becoming members ten and eleven. It is named for the
    *mark*, not the state: the timeline draws the same "active" fact from `--spek-accent`.
  - **The guard is split, because neither side can do it alone.** The package cannot measure ratios (it has
    no values) and the host cannot see the alphas (they are `fill-opacity` / `stroke-opacity` attributes d3
    writes at draw time). So `packages/ui` asserts *no literal outside the contract* plus *its own defaults
    are legible* (the un-themed host, the only case it has values for), and `contrast.test.ts` parses the
    `--spek-*` → `--color-*` mapping and measures what the package draws, at alphas declared in its table.
  - **`--spek-border` cannot draw anything that carries meaning** — 1.22:1 dark / 1.13:1 light at *full*
    strength, so no opacity of it helps. Graph edges use `--spek-text-muted` at 0.85; the timeline's grid
    lines and topic separators keep it and are stated as decoration in `timeline-view`, since a bar's dates
    come from the axis labels.
  `theme-toggle`'s opacity clause now carries a second exemption for a **reader-caused transient emphasis
  state** (the graph's hover dimming, at 0.1). A conforming dimming does exist — a label clears 4.5:1 down to
  α ≈ 0.81 — but nobody would perceive it as dimming; the exemption is a judgement, and it is recorded with
  that measurement so it can be argued with. Node labels carry a `--spek-bg-primary` halo (`paint-order:
  stroke`) because a force layout drifts nodes under them: against a fill a label is 1.06–1.84:1, and giving
  the fills their missing saturation made the light case worse before the halo fixed both themes at once.
  **The halo is worth nothing without paint order, so labels are a layer of their own, appended after the
  nodes.** Nested in its own node's `<g>` — where they shipped in v1.14.0 — a label was painted over, halo
  included, by every node drawn *after* it: the protection held for one direction of each collision and not
  the other, at no cost to any colour, so nothing measurable could see it. Two consequences, both
  load-bearing: the hover de-emphasis is applied to the labels **directly** (it is written onto the node
  group, and `graph-view` records "dim the graphics, leave the labels at full strength" as the alternative it
  rejected — so lifting them out without carrying the dim silently adopts it), and `--spek-bg-primary` now
  means *the surface the graph is mounted on*, which is a fact about the host and is stated as such in the
  package's README
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
- **The parser never lets its runtime decide a boundary** — the rule that was learned twice (issue #33).
  `parseTasks` and the Kotlin `TaskParser` are one rule written in two languages, and a construct that
  *reads* the same in both is not the same: Java's regex `$` also matches before a trailing line
  terminator (and its terminator set covers U+2028 / U+2029 as well as CR), and `isBlank()` /
  `trim()` disagree over U+00A0, U+FEFF, U+2007, U+202F and U+001C. So both boundaries are now stated,
  not inherited: **all three CommonMark line endings** (`\n`, `\r\n`, **lone `\r`**) are normalised
  before the split, and a **blank line is spaces and tabs only** — the same `[ \t]` class the indent
  rules already use, via `isBlankLine` / `trimSpacesTabs` on both sides. Patterns applied to a
  split line anchor with `\z` in Kotlin. One divergence is knowingly kept: **U+0085** is an ordinary
  character to JS's `.` and a terminator to Java's. It has **two** surfaces — on a checkbox line the
  counts differ, and in a `##` heading the counts agree while only the section title moves. Case-mirrored
  tests **cannot** catch this class — the spelling is the control, not the tests
- **Both parsers are verified by one shared corpus, plus a generator for what nobody thought of.**
  `test-fixtures/task-parser/` holds one JSON file per case (`name` = filename, `note`, `input`,
  `expected`, optional per-implementation `divergences`), read in full by `tasks.corpus.test.ts` and
  `TaskParserCorpusTest.kt`. **Adding a case is adding one file**; both languages assert it from the next
  run. What stays hand-written is only what a fixture cannot express: an equivalence between two inputs
  (CRLF ≡ LF) and a property of whatever the result is (a single-line task's text has no newline).
  - Inputs are **always escaped, never literal** — a raw U+001C or U+0085 gets rewritten on the way into
    the file and silently guts the case. A byte-level check in both loaders enforces printable ASCII plus
    LF and tab. It is load-bearing, not tidiness: `JSON.parse` **rejects** a raw LF/CR/U+001C inside a
    string and kotlinx-serialization **accepts** them, so a flattened escape would fail hard on one side
    and pass silently on the other. Every rule is spelled out in both loaders for the same reason —
    kotlinx also accepts `"total": "1"` for an `Int`, which the Node side refuses
  - `invalid/` is the same trick for the **loaders**: one file per rejection case (document, filename,
    which check must reject it, and a substring the message must contain), read by both. Asserting the
    *message* holds their wording in agreement. It exists because the loaders' rules were themselves
    hand-mirrored and had already diverged on `"meta": null` — Kotlin rejected it, Node threw a bare
    `TypeError`. Deliberately **not** overridable by a scratch dir: generated inputs replace what the
    parser parses, never the rules deciding a fixture is valid
  - Expected values are **authored, not captured**: in both divergences found so far *each* side was wrong
    in one direction, so generating them from either would have blessed the bug. The fields a case is
    *about* are reasoned out; the structural remainder may be filled from a run and reviewed
  - `scripts/generate-task-parser-corpus.ts` emits randomised inputs (seeded, reproducible) to an
    untracked scratch dir with `expected` from the TS side — a **disagreement detector, not an oracle** —
    which either loader reads via `SPEK_TASK_CORPUS_DIR` / `-Dspek.taskParserCorpus`. Never a CI gate. It
    excludes U+0085 by default, since a generated fixture cannot carry a `divergences` entry and the known
    difference would otherwise be ~3% of every batch. 2000 inputs across four seeds found **no** divergence
    beyond the recorded one
- **Never leave a style unstated that a host will state for you.** The SPA runs inside a VS Code
  webview, which injects **its own stylesheet into our document** and styles bare elements from the
  *host's* theme. Concretely: every inline `<code>` must carry the app's chip utilities
  (`bg-bg-tertiary text-accent px-1.5 py-0.5 rounded`, as in `MarkdownRenderer` / `TaskText`). The
  schema pages once rendered `<code>` with only a text colour and picked up a **dark chip inside an
  otherwise light panel** — while every other page, which had always set a background, was fine.
  **It cannot reproduce in a browser** (no host stylesheet), so it passes every local check and every
  test, and is only ever found by looking at the real webview. Do not fix this class of bug with a
  global element rule: Tailwind's utilities sit in `@layer utilities`, an unlayered rule beats *any*
  layered rule regardless of specificity, so a blanket `code { … }` silently flattens the deliberate
  chips too
- **Shared row/badge pieces** (`packages/web/src/components/`): `SourceBadge`, `DefaultSchemaBadge`, `StatCard`,
  `StretchedLink`. `StretchedLink` is the non-obvious one: a row whose whole card is clickable **cannot** be wrapped in
  a `<Link>` once it contains a link of its own (nested anchors are invalid, and the inner one becomes unreachable), so
  the card is a `relative` container, the title carries an `after:absolute after:inset-0` overlay, and anything that
  must stay clickable sits above it with `relative z-10` — which is why `SchemaBadge` carries those classes
- **A schema workflow step is identified by `FlowStep.key`, never by its declared id.** A schema may declare an
  artifact named `apply`, which is a different step from the phase under its `apply:` key — `superspec` does exactly
  that, as an implementation receipt. Keyed by id, the two collapsed in every map in `schemaLayout` and connections
  resolved to whichever won; selection could only ever reach one of them. Keys are the declared id **unless already
  claimed**, so for a schema without a collision the key *is* the id and the drawn graph still reads in the schema's own
  vocabulary. `id` stays the label and the value a `requires` resolves against. Upstream has the same collision
  (OpenSpec #1456: `openspec instructions` cannot reach an artifact named `archive`), so be tolerant of the input rather
  than normalising it away — renaming it would make the view disagree with `openspec status`
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
  clear the git-timestamp cache, IntelliJ has no such cache (`timestamp` is always null) so it clears the schema-order
  cache — **both of its stores**, the per-schema answers and the settled changes, since a mark surviving invalidation
  makes a manual Refresh weaker than the automatic one beside it. The TypeScript core has no invalidation seam at all:
  its bucket is bounded by the TTL alone, so a mark there ages exactly as an answer does
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
- **On archive**: update the docs that describe *master's implementation* — `CLAUDE.md`, `docs/prd.md`,
  `openspec/specs/` — and create a git commit
- **The READMEs and `docs/demo.html` are release-time, not archive-time.** `README.md` /
  `README.zh-TW.md` describe what a user who installed the published build actually has, so a feature
  sitting on master unreleased must not appear there yet — someone installing the current Marketplace
  version would read about something they do not have. They move with the CHANGELOG and the version
  bump, in `/release`. The `screenshots/` referenced by the README are part of the same batch:
  **changing a caption without retaking its image makes the README contradict itself**, which is how
  this rule got written down.
  `docs/demo.html` is the same case for a sharper reason: `pages.yml` uploads the committed `docs/`
  **verbatim** — it does not rebuild — so committing a rebuilt demo publishes the unreleased feature to
  the live demo on the next master push. Rebuild it to *verify* a change if you like, then revert it;
  git history shows it only ever landing in `Rebuild demo for vX.Y.Z` commits
```
