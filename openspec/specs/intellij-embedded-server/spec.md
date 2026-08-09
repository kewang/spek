## Purpose

以 IntelliJ 內建 HTTP server 提供 REST API，供 JCEF 內嵌前端讀取 OpenSpec 資料。

## Requirements

### Requirement: HTTP request handler registration
The plugin SHALL register an `HttpRequestHandler` with the IntelliJ built-in server to handle REST API requests under the path prefix `/api/spek/`. All API endpoints SHALL accept a `projectPath` query parameter to identify the target project.

#### Scenario: API endpoint routing
- **WHEN** the built-in server receives a request to `/api/spek/openspec/overview?projectPath=/path/to/project`
- **THEN** the handler SHALL route it to the overview handler and return JSON response

#### Scenario: Unknown endpoint
- **WHEN** the built-in server receives a request to `/api/spek/unknown`
- **THEN** the handler SHALL return HTTP 404

### Requirement: Overview endpoint
The server SHALL implement `GET /api/spek/openspec/overview` that returns specs count, changes count, and task statistics.

#### Scenario: Overview response
- **WHEN** `GET /api/spek/openspec/overview?projectPath=...` is called
- **THEN** it returns `{ specsCount, changesCount, taskStats: { total, completed } }`

### Requirement: Specs list endpoint
The server SHALL implement `GET /api/spek/openspec/specs` that returns a list of all specs with their topic names and descriptions.

#### Scenario: Specs list response
- **WHEN** `GET /api/spek/openspec/specs?projectPath=...` is called
- **THEN** it returns an array of `{ topic, title, description, updatedAt }` objects

### Requirement: Spec detail endpoint
The server SHALL implement `GET /api/spek/openspec/specs/:topic` that returns the full content of a single spec including its markdown content and history.

#### Scenario: Spec detail found
- **WHEN** `GET /api/spek/openspec/specs/dashboard-view?projectPath=...` is called
- **AND** `openspec/specs/dashboard-view/spec.md` exists
- **THEN** it returns the spec content with history entries

#### Scenario: Spec not found
- **WHEN** `GET /api/spek/openspec/specs/nonexistent?projectPath=...` is called
- **THEN** it returns HTTP 404

### Requirement: Spec at change endpoint
The server SHALL implement `GET /api/spek/openspec/specs/:topic/at/:slug` that returns the spec content as it exists within a specific change's delta specs.

#### Scenario: Spec version found
- **WHEN** `GET /api/spek/openspec/specs/api-adapter/at/2026-02-13-phase1?projectPath=...` is called
- **AND** the change contains a delta spec for `api-adapter`
- **THEN** it returns `{ content: "..." }` with the delta spec content

### Requirement: Changes list endpoint
The server SHALL implement `GET /api/spek/openspec/changes` that returns active and archived changes. Each returned change SHALL include a `createdDate` field (string in `YYYY-MM-DD` format or null) parsed from the change's `.openspec.yaml` `created` frontmatter field, and an `archivedDate` field (string in `YYYY-MM-DD` format or null) derived from the archive folder name prefix `YYYY-MM-DD-slug` for archived changes and null for active changes, matching the `@spekjs/core` (TypeScript) contract.

#### Scenario: Changes list response
- **WHEN** `GET /api/spek/openspec/changes?projectPath=...` is called
- **THEN** it returns `{ active: [...], archived: [...] }` with change metadata

#### Scenario: Active change includes createdDate from .openspec.yaml
- **WHEN** an active change directory contains `.openspec.yaml` with `created: 2026-07-05`
- **THEN** its entry in `active` SHALL include `createdDate` equal to `"2026-07-05"` and `archivedDate` equal to null

#### Scenario: Archived change includes createdDate and archivedDate
- **WHEN** an archived change directory named `2026-07-05-foo` contains `.openspec.yaml` with `created: 2026-07-01`
- **THEN** its entry in `archived` SHALL include `createdDate` equal to `"2026-07-01"` and `archivedDate` equal to `"2026-07-05"`

#### Scenario: Missing or malformed created yields null createdDate
- **WHEN** a change has no `.openspec.yaml`, or its `created` value does not match `YYYY-MM-DD`
- **THEN** its `createdDate` SHALL be null

### Requirement: Change detail endpoint
The server SHALL implement `GET /api/spek/openspec/changes/:slug` that returns full change details including proposal, design, tasks content, and affected specs. The response SHALL also include `createdDate` and `archivedDate` fields, populated from the same sources as the corresponding changes-list entry (`.openspec.yaml` `created` frontmatter and archive folder name prefix respectively).

#### Scenario: Change detail found
- **WHEN** `GET /api/spek/openspec/changes/2026-02-13-phase1?projectPath=...` is called
- **THEN** it returns the change with proposal, design, tasks markdown content and affected specs list
- **AND** the response includes `createdDate` and `archivedDate` fields

### Requirement: Graph data endpoint
The server SHALL implement `GET /api/spek/openspec/graph` that returns spec-change relationship data for visualization.

#### Scenario: Graph data response
- **WHEN** `GET /api/spek/openspec/graph?projectPath=...` is called
- **THEN** it returns nodes and edges representing specs and their related changes

### Requirement: Search endpoint
The server SHALL implement `GET /api/spek/openspec/search` with a `q` query parameter that performs full-text search across all spec and change content.

#### Scenario: Search with results
- **WHEN** `GET /api/spek/openspec/search?projectPath=...&q=dashboard` is called
- **THEN** it returns matching results with type, title, and context snippets

#### Scenario: Search with no results
- **WHEN** `GET /api/spek/openspec/search?projectPath=...&q=xyznonexistent` is called
- **THEN** it returns an empty array

### Requirement: Resync endpoint
The server SHALL implement `POST /api/spek/openspec/resync`. Without it, the shared frontend's Refresh button — which posts to this path on every host — receives HTTP 404 in IntelliJ, turning every Refresh into a spurious error in the IDE.

The endpoint SHALL invalidate the server-side state this host actually holds that could serve a stale view. The Kotlin scanner maintains **no** git timestamp cache (`timestamp` is always `null`), so the endpoint SHALL NOT fabricate one; it SHALL clear the schema-order cache, which is exactly what the plugin's own file watcher already clears before it refreshes the webview. A manual Refresh SHALL NOT invalidate less than an automatic one does.

#### Scenario: Successful resync
- **WHEN** the client sends `POST /api/spek/openspec/resync?projectPath=/path/to/project`
- **THEN** the server clears the schema-order cache
- **AND** returns HTTP 200 with `{ ok: true }`

#### Scenario: Resync without projectPath parameter
- **WHEN** the client sends `POST /api/spek/openspec/resync` without a `projectPath` parameter
- **THEN** the server returns HTTP 400, consistent with the other `openspec/` endpoints

#### Scenario: Subsequent read reflects the cleared cache
- **WHEN** a change's schema order has changed on disk and the client resyncs
- **AND** the client then requests that change's detail
- **THEN** the response SHALL reflect the schema order currently on disk, not a cached earlier order

### Requirement: OpenSpec scanner (Kotlin)
The server SHALL implement a Kotlin-based OpenSpec scanner that reads the `openspec/` directory structure. The scanner SHALL read `.md` and `.yaml` files only, and SHALL not expose arbitrary filesystem access.

#### Scenario: Scan directory structure
- **WHEN** the scanner processes a project with `openspec/specs/` and `openspec/changes/`
- **THEN** it returns a structured representation of all specs and changes with their metadata

#### Scenario: Security constraint
- **WHEN** a request attempts to read files outside the `openspec/` directory
- **THEN** the server SHALL reject the request

### Requirement: CORS headers for JCEF
The server SHALL include appropriate CORS headers to allow requests from the JCEF webview (which loads content from file:// or the built-in server).

#### Scenario: CORS preflight
- **WHEN** the JCEF webview sends a cross-origin request to the API
- **THEN** the server SHALL respond with `Access-Control-Allow-Origin` headers permitting the request

### Requirement: API handler readiness check before webview load
The plugin SHALL verify that `SpekHttpRequestHandler` is responding to HTTP requests before loading the webview URL in JCEF. This ensures the frontend does not encounter HTTP 404 errors due to the handler not being registered yet.

#### Scenario: Handler becomes ready before timeout
- **WHEN** the built-in server has started
- **AND** `SpekBrowserPanel` polls the API health check endpoint
- **AND** the handler responds with HTTP 200 within the timeout period
- **THEN** the panel SHALL proceed to load the webview URL

#### Scenario: Handler not ready yet
- **WHEN** the built-in server has started
- **AND** the API health check endpoint returns non-200 or connection fails
- **THEN** the panel SHALL wait 200ms and retry the health check
- **AND** the panel SHALL check the `disposed` state before each retry

#### Scenario: Timeout exceeded
- **WHEN** the health check has been retried for more than 10 seconds without success
- **THEN** the panel SHALL proceed to load the webview URL as a fallback
- **AND** the panel SHALL log a warning about the timeout

### Requirement: Schemas endpoints
The server SHALL implement `GET /api/spek/openspec/schemas`, returning the workflow schemas available to the project, and `GET /api/spek/openspec/schemas/{name}`, returning one schema's full definition. Both SHALL take the `projectPath` parameter used by the rest of the embedded API, and SHALL produce the same response shape the web server produces for the corresponding routes, so the shared frontend needs no host-specific branch.

The Kotlin implementation SHALL follow the same enumeration, shadowing, ordering, name-validation, degradation, and caching rules as `@spekjs/core`, in the way the Kotlin scanner and schema-order reader already mirror their TypeScript counterparts. A missing or failing `openspec` CLI SHALL degrade to project-local schemas with a reason rather than returning an error status.

The schemas endpoints SHALL be reachable only after the API handler readiness check that already gates the webview load, so the Schemas view never issues its first request against an unregistered handler.

#### Scenario: Schemas list response
- **WHEN** `GET /api/spek/openspec/schemas?projectPath=...` is called
- **THEN** it returns the project's active schema name and the enumerated schemas with their source, stage count, and active-change usage

#### Scenario: Schema detail response
- **WHEN** `GET /api/spek/openspec/schemas/spec-driven?projectPath=...` is called
- **THEN** it returns that schema's metadata, its artifacts in schema order with their instructions, and its apply step

#### Scenario: Unknown schema
- **WHEN** `GET /api/spek/openspec/schemas/no-such-schema?projectPath=...` is called
- **THEN** it returns HTTP 404

#### Scenario: Unsafe schema name rejected
- **WHEN** the requested schema name is not a single safe path segment
- **THEN** it returns HTTP 404 without reading any file outside the project's schema directory

#### Scenario: Degraded enumeration without the CLI
- **WHEN** `GET /api/spek/openspec/schemas?projectPath=...` is called on a machine with no `openspec` CLI
- **THEN** it returns HTTP 200 with the project-local schemas and a reason stating that package schemas could not be enumerated
