## Purpose

提供 OpenSpec 內容的 REST API（overview / specs / changes / graph / search），作為前端資料來源。
## Requirements
### Requirement: Overview endpoint
The system SHALL provide `GET /api/openspec/overview` that returns aggregate statistics for an OpenSpec repository. The endpoint SHALL accept an optional `aggregate` query parameter (default true); when aggregation is active and the repository has multiple worktrees, the statistics SHALL cover all worktrees following the worktree-aggregation rules (active changes unioned, archived changes deduplicated by slug).

#### Scenario: Get overview of repo with specs and changes
- **WHEN** client sends `GET /api/openspec/overview?dir=/path/to/repo`
- **THEN** system returns JSON with `specsCount`, `changesCount` (with `active` and `archived` breakdown), and `taskStats` (aggregate `total` and `completed` across all changes, including both active and archived)

#### Scenario: Get overview with only archived changes
- **WHEN** client sends `GET /api/openspec/overview?dir=/path/to/repo`
- **AND** there are no active changes but archived changes have tasks
- **THEN** system returns `taskStats` with correct `total` and `completed` counts from archived changes

#### Scenario: Get overview of repo with no specs
- **WHEN** client sends `GET /api/openspec/overview?dir=/path/to/repo`
- **AND** the repo has no `openspec/specs/` directory
- **THEN** system returns `specsCount: 0` with changes still counted correctly

#### Scenario: Overview counts span worktrees under aggregation
- **WHEN** client sends `GET /api/openspec/overview?dir=/path/to/repo` with aggregation active and the repo has multiple worktrees
- **THEN** `changesCount.active` covers every worktree's active changes and `changesCount.archived` reflects slug-deduplicated archived changes

### Requirement: List specs
The system SHALL provide `GET /api/openspec/specs` that returns all spec topics.

#### Scenario: List all specs
- **WHEN** client sends `GET /api/openspec/specs?dir=/path/to/repo`
- **THEN** system returns a JSON array of spec topics, each with `topic` name and `path`
- **AND** topics are sorted alphabetically

#### Scenario: No specs directory
- **WHEN** client sends `GET /api/openspec/specs?dir=/path/to/repo`
- **AND** `openspec/specs/` does not exist
- **THEN** system returns an empty array

### Requirement: Get single spec
The system SHALL provide `GET /api/openspec/specs/:topic` that returns the full content of a spec.

#### Scenario: Get existing spec
- **WHEN** client sends `GET /api/openspec/specs/simulation-engine?dir=/path/to/repo`
- **AND** `openspec/specs/simulation-engine/spec.md` exists
- **THEN** system returns JSON with `topic`, `content` (raw Markdown), and `relatedChanges` (list of changes that have delta specs for this topic)

#### Scenario: Get non-existent spec
- **WHEN** client sends `GET /api/openspec/specs/nonexistent?dir=/path/to/repo`
- **THEN** system returns HTTP 404

### Requirement: List changes
The system SHALL provide `GET /api/openspec/changes` that returns all changes grouped by status. The endpoint SHALL accept an optional `aggregate` query parameter (default true). When aggregation is active and the repository has multiple worktrees, the response SHALL aggregate changes across worktrees per the worktree-aggregation rules and SHALL additionally include a `worktrees` array (the discovered worktrees) and an `aggregated` boolean.

#### Scenario: List changes with active and archived
- **WHEN** client sends `GET /api/openspec/changes?dir=/path/to/repo`
- **THEN** system returns JSON with `active` array and `archived` array
- **AND** each change includes `slug`, `date` (parsed from slug prefix), `description` (parsed from slug), `hasProposal`, `hasDesign`, `hasTasks`, `hasSpecs`, and `taskStats`
- **AND** changes are sorted by date descending (newest first)

#### Scenario: List changes aggregated across worktrees
- **WHEN** client sends `GET /api/openspec/changes?dir=/path/to/repo` with aggregation active and multiple worktrees
- **THEN** the response includes `aggregated: true` and a `worktrees` array
- **AND** each aggregated change includes a `source` identifying its worktree

#### Scenario: List changes with aggregation disabled
- **WHEN** client sends `GET /api/openspec/changes?dir=/path/to/repo&aggregate=false`
- **THEN** only the given directory is scanned and the response changes carry no `source`

### Requirement: Get single change
The system SHALL provide `GET /api/openspec/changes/:slug` that returns full change content. The endpoint SHALL accept an optional `wt` query parameter identifying a worktree; when present, the change SHALL be read from that worktree, so that same-slug changes in different worktrees can be resolved unambiguously. When `wt` is absent the change SHALL be read from the directory given by `dir`, as before.

#### Scenario: Get existing change with all artifacts
- **WHEN** client sends `GET /api/openspec/changes/2026-02-10-my-feature?dir=/path/to/repo`
- **THEN** system returns JSON with `slug`, `proposal` (Markdown content or null), `design` (Markdown content or null), `tasks` (parsed task structure or null), `specs` (array of delta spec contents), and `metadata` (from `.openspec.yaml` if present)

#### Scenario: Get non-existent change
- **WHEN** client sends `GET /api/openspec/changes/nonexistent?dir=/path/to/repo`
- **THEN** system returns HTTP 404

#### Scenario: Get change from a specific worktree
- **WHEN** client sends `GET /api/openspec/changes/add-foo?dir=/path/to/repo&wt=<key>`
- **THEN** system reads change `add-foo` from the worktree whose key is `<key>` and returns its content

### Requirement: Missing dir parameter
The system SHALL require the `dir` query parameter on all openspec endpoints.

#### Scenario: Request without dir parameter
- **WHEN** client sends any `/api/openspec/*` request without `dir` parameter
- **THEN** system returns HTTP 400 with error message "dir parameter is required"

### Requirement: Resync cache endpoint
The system SHALL provide `POST /api/openspec/resync` that clears and rebuilds the git timestamp cache for a given repo.

#### Scenario: Successful resync
- **WHEN** client sends `POST /api/openspec/resync?dir=/path/to/repo`
- **THEN** the system clears the timestamp cache for that repo
- **AND** rebuilds the cache from git history
- **AND** returns HTTP 200 with `{ ok: true }`

#### Scenario: Resync without dir parameter
- **WHEN** client sends `POST /api/openspec/resync` without `dir` parameter
- **THEN** system returns HTTP 400 with error message "dir parameter is required"

### Requirement: Refresh control
The system SHALL display a Refresh button in the sidebar. Activating it SHALL invalidate the server-side state that the current host holds and that could otherwise serve a stale view, and SHALL then re-fetch the data backing the current page.

Cache invalidation is best-effort and SHALL NOT gate the re-fetch: if the invalidation request fails for any reason — including a host that does not provide the endpoint — the re-fetch SHALL still happen and the failure SHALL NOT surface as an unhandled rejection.

The button MUST show a busy state that persists until the re-fetched data has arrived, not merely until the invalidation request has returned.

#### Scenario: User triggers refresh
- **WHEN** the user clicks the Refresh button in the sidebar
- **THEN** the system sends `POST /api/openspec/resync` with the current repo path
- **AND** increments the `RefreshContext` `refreshKey`, causing every mounted `useAsyncData` hook to re-fetch
- **AND** the button shows a busy state until the re-fetched data has arrived

#### Scenario: Cache invalidation fails
- **WHEN** the resync request fails (network error, or the host does not serve the endpoint and returns HTTP 404)
- **THEN** the `refreshKey` SHALL still be incremented so the data is re-fetched
- **AND** the failure SHALL NOT surface as an unhandled promise rejection

#### Scenario: Displayed content is already current
- **WHEN** the user clicks Refresh and the underlying files have not changed on disk
- **THEN** the button still enters and completes its busy state, acknowledging the click
- **AND** the displayed content remains unchanged

#### Scenario: Refresh with no repo selected
- **WHEN** no repo is currently selected
- **THEN** the Refresh button is not displayed or is disabled

### Requirement: Host-specific scope of cache invalidation
The resync endpoint's contract SHALL be "invalidate the server-side state this host actually holds that could serve a stale view", not "perform one fixed set of actions". Each host SHALL invalidate the caches it actually maintains, and hosts that maintain different caches SHALL invalidate different things.

#### Scenario: Web and VS Code hosts invalidate the git timestamp cache
- **WHEN** the resync endpoint is invoked on the Web server or the VS Code extension host
- **THEN** the git timestamp cache for that repo SHALL be cleared and rebuilt

#### Scenario: A host without a given cache does not fabricate the work
- **WHEN** the resync endpoint is invoked on a host that does not maintain a git timestamp cache
- **THEN** that host SHALL NOT be required to rebuild one
- **AND** it SHALL invalidate whichever of its own caches could serve a stale view

### Requirement: Graph data endpoint
The system SHALL provide `GET /api/openspec/graph` that returns the relationship graph between specs and changes. The response SHALL contain `nodes` (array of spec and change nodes) and `edges` (array of change-to-spec connections). Only changes that have at least one delta spec SHALL be included as nodes. The endpoint SHALL accept an optional `aggregate` query parameter (default true); when aggregation is active and the repository has multiple worktrees, change nodes SHALL cover all worktrees per the worktree-aggregation rules and SHALL have worktree-namespaced ids.

#### Scenario: Get graph data
- **WHEN** client sends `GET /api/openspec/graph?dir=/path/to/repo`
- **THEN** system returns JSON with `nodes` and `edges` arrays
- **AND** each spec node has `id` (prefixed "spec:"), `type: "spec"`, `label` (topic name), and `historyCount`
- **AND** each change node has `id` (prefixed "change:"), `type: "change"`, `label` (description), `date`, `status`, and `specCount`
- **AND** each edge has `source` (change node id) and `target` (spec node id)

#### Scenario: Graph with no spec-bearing changes
- **WHEN** client sends `GET /api/openspec/graph?dir=/path/to/repo`
- **AND** no changes have a `specs/` directory
- **THEN** system returns `nodes` containing only spec nodes with no edges

#### Scenario: Graph without dir parameter
- **WHEN** client sends `GET /api/openspec/graph` without `dir` parameter
- **THEN** system returns HTTP 400 with error message "dir parameter is required"

#### Scenario: Graph aggregated across worktrees
- **WHEN** client sends `GET /api/openspec/graph?dir=/path/to/repo` with aggregation active and multiple worktrees
- **THEN** change nodes include every worktree's spec-bearing changes with worktree-namespaced ids

### Requirement: Graph data in ApiAdapter
The system SHALL extend the `ApiAdapter` interface with a `getGraphData()` method. `FetchAdapter` SHALL call `GET /api/openspec/graph`. `MessageAdapter` SHALL use `postMessage` with type `"getGraphData"`. `StaticAdapter` SHALL read from `window.__DEMO_DATA__.graphData`.

#### Scenario: FetchAdapter graph data
- **WHEN** `FetchAdapter.getGraphData()` is called
- **THEN** it sends `GET /api/openspec/graph?dir=...` and returns the parsed JSON response

#### Scenario: StaticAdapter graph data
- **WHEN** `StaticAdapter.getGraphData()` is called
- **THEN** it returns `window.__DEMO_DATA__.graphData`

#### Scenario: MessageAdapter graph data
- **WHEN** `MessageAdapter.getGraphData()` is called
- **THEN** it sends a postMessage with `{ type: "getGraphData" }` to the VS Code extension host
- **AND** returns the response data

### Requirement: Core graph data builder
The system SHALL provide a `buildGraphData(repoDir)` function in `@spekjs/core` that scans the openspec directory and returns structured graph data. The function SHALL reuse the existing scan logic to identify which changes contain delta specs for which topics.

#### Scenario: Build graph data from repo
- **WHEN** `buildGraphData("/path/to/repo")` is called
- **AND** the repo has 3 specs and 2 changes, where change A modifies spec 1 and spec 2, and change B modifies spec 2 and spec 3
- **THEN** the function returns 5 nodes (3 specs + 2 changes) and 4 edges

### Requirement: Aggregated graph data builder

The `@spekjs/core` package SHALL provide an async function `buildGraphDataAggregated(dir)` that returns graph data aggregated across all worktrees of the repository, applying the worktree-aggregation rules. Change node ids SHALL be namespaced as `change:<worktreeKey>:<slug>` to prevent collisions between same-slug changes from different worktrees. Spec nodes SHALL be taken from the main worktree only. The existing synchronous `buildGraphData` function SHALL remain unchanged.

#### Scenario: Build aggregated graph data

- **WHEN** `buildGraphDataAggregated("/path/to/repo")` is called and the repo has multiple worktrees
- **THEN** change nodes cover every worktree, with ids of the form `change:<worktreeKey>:<slug>`

#### Scenario: buildGraphData remains unchanged

- **WHEN** `buildGraphData("/path/to/repo")` is called
- **THEN** it returns single-directory graph data exactly as before this change

### Requirement: Worktree-aware adapter parameters

The `ApiAdapter` interface SHALL allow worktree aggregation to be controlled and resolved across all adapters. Change-list, overview, and graph fetches SHALL accept an `aggregate` flag, and single-change fetches SHALL accept an optional worktree `key`. `FetchAdapter` SHALL forward these as `aggregate` / `wt` query parameters. `MessageAdapter` SHALL forward them in its `postMessage` payload to the VS Code extension host. `StaticAdapter` (Demo) SHALL ignore them and behave as a single non-aggregated source.

#### Scenario: FetchAdapter forwards aggregate flag

- **WHEN** `FetchAdapter` requests the change list with aggregation enabled
- **THEN** it sends `GET /api/openspec/changes?dir=...&aggregate=true`

#### Scenario: FetchAdapter forwards worktree key

- **WHEN** `FetchAdapter.getChange(slug, wt)` is called with a worktree key
- **THEN** it sends `GET /api/openspec/changes/<slug>?dir=...&wt=<key>`

#### Scenario: MessageAdapter forwards worktree parameters

- **WHEN** `MessageAdapter` requests changes or a single change with worktree parameters
- **THEN** the `postMessage` payload carries the `aggregate` flag and/or `wt` key

#### Scenario: StaticAdapter ignores worktree parameters

- **WHEN** the Demo `StaticAdapter` is asked for changes with worktree parameters
- **THEN** it returns the static demo data unchanged, as a single non-aggregated source

### Requirement: Workspace-aware API endpoints

The Web server openspec routes `/overview`, `/changes`, `/graph`, and `/watch` SHALL accept a `jj` query
parameter (default enabled; `jj=false` disables jj inclusion) and thread it into core as `includeJj`,
independent of the existing `aggregate` parameter. The `/watch` endpoint SHALL enumerate directories to
watch via `listWorkspaces`, so that jj workspace `openspec/` directories are watched when jj inclusion
is enabled. The `/changes/:slug` route SHALL accept a `wt` (workspace key) parameter so a same-named
slug can be resolved to the specific working copy — git worktree or jj workspace — that owns it.

#### Scenario: changes endpoint honors jj toggle

- **WHEN** `GET /api/openspec/changes?dir=...&jj=false` is requested on a colocated repo with jj workspaces
- **THEN** the response excludes jj-only workspace changes, matching git-worktree-only aggregation

#### Scenario: watch covers jj workspaces

- **WHEN** `/watch` runs with aggregation and jj inclusion enabled on a repo with a jj workspace
- **THEN** that workspace's `openspec/` directory is watched for changes


### Requirement: Worktrees endpoint

The system SHALL provide a read-only `GET /api/openspec/worktrees` that returns the discovered working
directories for a repository via `core.listWorkspaces` — git worktrees, and jj workspaces when jj
inclusion is requested. It SHALL require the `dir` parameter and accept an optional `jj` parameter that
controls whether jj workspaces are enumerated. It SHALL return only the worktree list (each entry
carrying at least `key`, `path`, `branch`, `isMain`, and `vcs`) and SHALL NOT scan changes.

#### Scenario: List worktrees for a multi-worktree repo

- **WHEN** client sends `GET /api/openspec/worktrees?dir=/path/to/repo`
- **THEN** system returns a JSON array of the repository's git worktrees, each with `key`, `path`,
  `branch`, `isMain`, and `vcs`

#### Scenario: jj parameter controls jj workspace enumeration

- **WHEN** client sends `GET /api/openspec/worktrees?dir=/path/to/repo&jj=true` on a colocated repo
  with jj workspaces
- **THEN** the returned list includes jj workspaces (entries with `vcs: "jj"`)
- **AND WHEN** jj enumeration is not requested, only git worktrees are returned

#### Scenario: Worktrees endpoint without dir parameter

- **WHEN** client sends `GET /api/openspec/worktrees` without a `dir` parameter
- **THEN** system returns HTTP 400 with error message "dir parameter is required"

### Requirement: Worktrees in ApiAdapter

The system SHALL extend the `ApiAdapter` interface with a `getWorktrees()` method. `FetchAdapter` SHALL
call `GET /api/openspec/worktrees`. `MessageAdapter` SHALL use `postMessage` with type `"getWorktrees"`,
served by a corresponding case in the VS Code extension host handler (via `core.listWorkspaces`).
`StaticAdapter` (Demo) SHALL return the demo's single-source worktree list (which may be empty).

#### Scenario: FetchAdapter worktrees

- **WHEN** `FetchAdapter.getWorktrees()` is called
- **THEN** it sends `GET /api/openspec/worktrees?dir=...` and returns the parsed JSON array

#### Scenario: MessageAdapter worktrees

- **WHEN** `MessageAdapter.getWorktrees()` is called
- **THEN** it sends a `postMessage` with `{ type: "getWorktrees" }` and returns the response data
- **AND** the VS Code extension host handler resolves it via `listWorkspaces`

#### Scenario: StaticAdapter worktrees

- **WHEN** the Demo `StaticAdapter.getWorktrees()` is called
- **THEN** it returns the demo's single-source worktree list without contacting a server

### Requirement: Aggregation preferences in ApiAdapter

The system SHALL extend the `ApiAdapter` interface with `getAggregationPrefs()` (returns
`{ aggregate, includeJj }`) and `setAggregationPrefs(aggregate, includeJj)`, so the aggregation-scope
control reads and writes the preference through each host's native storage. `FetchAdapter` and
`StaticAdapter` SHALL back these with the browser `localStorage` preferences. `MessageAdapter` SHALL
route them to the VS Code extension host, where the handler resolves them against the VS Code settings.

#### Scenario: FetchAdapter reads and writes localStorage prefs

- **WHEN** `FetchAdapter.getAggregationPrefs()` is called
- **THEN** it returns the current `aggregate` / `includeJj` values from `localStorage`
- **AND WHEN** `FetchAdapter.setAggregationPrefs(a, jj)` is called, it persists both to `localStorage`

#### Scenario: MessageAdapter routes prefs to the extension host

- **WHEN** `MessageAdapter.getAggregationPrefs()` or `setAggregationPrefs(a, jj)` is called
- **THEN** it sends a `postMessage` (`getAggregationPrefs` / `setAggregationPrefs`) to the VS Code
  extension host and the host resolves it against the VS Code settings

### Requirement: Schemas endpoint

The system SHALL provide a read-only `GET /api/openspec/schemas` that returns the workflow schemas
available to a repository. It SHALL require the `dir` parameter and SHALL return the repo's active
schema name, the enumerated schemas (each carrying at least `name`, `description`, `source`,
`stageCount`, `isDefault`, and the active changes using it), and — when package schemas could not
be enumerated — a machine-readable reason for that degradation. It SHALL NOT scan change artifacts.

A CLI failure SHALL NOT become an HTTP error: the endpoint SHALL return HTTP 200 with the degraded
enumeration and its reason.

#### Scenario: List schemas for a repo

- **WHEN** client sends `GET /api/openspec/schemas?dir=/path/to/repo`
- **THEN** system returns JSON containing the active schema name and the enumerated schemas with
  `name`, `description`, `source`, `stageCount`, `isDefault`, and their change usage

#### Scenario: Degraded enumeration returns 200

- **WHEN** client sends `GET /api/openspec/schemas?dir=/path/to/repo` on a machine with no `openspec`
  CLI installed
- **THEN** system returns HTTP 200 with the project-local schemas and a reason stating that package
  schemas could not be enumerated

#### Scenario: Schemas endpoint without dir parameter

- **WHEN** client sends `GET /api/openspec/schemas` without a `dir` parameter
- **THEN** system returns HTTP 400 with error message "dir parameter is required"

### Requirement: Schema detail endpoint

The system SHALL provide a read-only `GET /api/openspec/schemas/:name` that returns one schema's
full definition — its metadata, its ordered artifacts (each with `id`, `generates`, `description`,
`requires`, `instruction`), and its apply step. It SHALL require the `dir` parameter. It SHALL
validate `:name` as a single safe path segment and SHALL return HTTP 404 for a name that fails
validation or resolves to no schema. When the schema cannot be resolved because the `openspec` CLI
is unavailable, the response SHALL distinguish that reason from the schema not existing.

#### Scenario: Get a schema definition

- **WHEN** client sends `GET /api/openspec/schemas/spec-driven?dir=/path/to/repo`
- **THEN** system returns the schema's metadata, its artifacts in schema order with their
  instructions, and its apply step

#### Scenario: Unknown schema

- **WHEN** client sends `GET /api/openspec/schemas/no-such-schema?dir=/path/to/repo`
- **THEN** system returns HTTP 404

#### Scenario: Unsafe schema name rejected

- **WHEN** client sends a request whose `:name` segment resolves to a path traversal such as `../../etc`
- **THEN** system returns HTTP 404, having read no file and spawned no process

### Requirement: Schemas in ApiAdapter

The system SHALL extend the `ApiAdapter` interface with `getSchemas()` and `getSchema(name)`.
`FetchAdapter` SHALL call `GET /api/openspec/schemas` and `GET /api/openspec/schemas/:name`.
`MessageAdapter` SHALL use `postMessage` with types `"getSchemas"` and `"getSchema"`, served by
corresponding cases in the VS Code extension host handler calling the core schema module directly.
`StaticAdapter` (Demo) SHALL serve both from the schema data embedded in the demo page at build
time.

#### Scenario: FetchAdapter schemas

- **WHEN** `FetchAdapter.getSchemas()` is called
- **THEN** it sends `GET /api/openspec/schemas?dir=...` and returns the parsed JSON

#### Scenario: MessageAdapter schemas

- **WHEN** `MessageAdapter.getSchema("spec-driven")` is called
- **THEN** it sends a `postMessage` with `{ type: "getSchema", name: "spec-driven" }` and returns the
  response data, resolved by the VS Code extension host through the core schema module

#### Scenario: StaticAdapter schemas

- **WHEN** the Demo `StaticAdapter.getSchemas()` is called
- **THEN** it returns the embedded schema data without contacting a server
