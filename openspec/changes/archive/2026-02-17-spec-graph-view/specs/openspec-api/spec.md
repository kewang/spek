## ADDED Requirements

### Requirement: Graph data endpoint
The system SHALL provide `GET /api/openspec/graph` that returns the relationship graph between specs and changes. The response SHALL contain `nodes` (array of spec and change nodes) and `edges` (array of change-to-spec connections). Only changes that have at least one delta spec SHALL be included as nodes.

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
The system SHALL provide a `buildGraphData(repoDir)` function in `@spek/core` that scans the openspec directory and returns structured graph data. The function SHALL reuse the existing scan logic to identify which changes contain delta specs for which topics.

#### Scenario: Build graph data from repo
- **WHEN** `buildGraphData("/path/to/repo")` is called
- **AND** the repo has 3 specs and 2 changes, where change A modifies spec 1 and spec 2, and change B modifies spec 2 and spec 3
- **THEN** the function returns 5 nodes (3 specs + 2 changes) and 4 edges
