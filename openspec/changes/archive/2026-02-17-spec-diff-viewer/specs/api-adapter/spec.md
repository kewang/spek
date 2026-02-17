## MODIFIED Requirements

### Requirement: ApiAdapter interface
The frontend SHALL define an `ApiAdapter` interface that abstracts all API communication, allowing different implementations for web and VS Code environments. The interface SHALL include a `getSpecAtChange(topic: string, slug: string): Promise<{ content: string }>` method for fetching spec content at a specific change version.

#### Scenario: Adapter interface contract
- **WHEN** a component needs to fetch OpenSpec data
- **THEN** it calls methods on the `ApiAdapter` interface (e.g., `getOverview()`, `getSpecs()`, `getChange(slug)`, `getSpecAtChange(topic, slug)`) which return Promises of typed data

### Requirement: FetchAdapter for web
The web version SHALL use a `FetchAdapter` that calls the Express REST API via HTTP fetch.

#### Scenario: Fetch adapter API call
- **WHEN** `FetchAdapter.getOverview()` is called with repoPath set
- **THEN** it performs `fetch('/api/openspec/overview?dir=...')` and returns the parsed JSON response

#### Scenario: Fetch adapter error handling
- **WHEN** a fetch request returns a non-OK HTTP status
- **THEN** the adapter throws an error with the HTTP status code

#### Scenario: Fetch adapter getSpecAtChange
- **WHEN** `FetchAdapter.getSpecAtChange("user-auth", "2026-01-15-add-oauth")` is called
- **THEN** it performs `fetch('/api/openspec/specs/user-auth/at/2026-01-15-add-oauth?dir=...')` and returns the parsed JSON response

### Requirement: MessageAdapter for VS Code Webview
The VS Code version SHALL use a `MessageAdapter` that communicates with the extension host via `postMessage`.

#### Scenario: Message adapter API call
- **WHEN** `MessageAdapter.getOverview()` is called
- **THEN** it sends `{ type: 'request', id: '<unique>', method: 'getOverview' }` via `postMessage` and returns a Promise that resolves when the matching response arrives

#### Scenario: Message adapter timeout
- **WHEN** a message request does not receive a response within 10 seconds
- **THEN** the adapter rejects the Promise with a timeout error

#### Scenario: Message adapter error response
- **WHEN** the extension host responds with `{ type: 'response', id, error: '...' }`
- **THEN** the adapter rejects the Promise with the error message

#### Scenario: Message adapter getSpecAtChange
- **WHEN** `MessageAdapter.getSpecAtChange("user-auth", "2026-01-15-add-oauth")` is called
- **THEN** it sends `{ type: 'request', id: '<unique>', method: 'getSpecAtChange', params: { topic: 'user-auth', slug: '2026-01-15-add-oauth' } }` via `postMessage`

### Requirement: StaticAdapter for demo
The demo version SHALL use a `StaticAdapter` that reads all data from a pre-embedded JSON object (`window.__DEMO_DATA__`) and implements the `ApiAdapter` interface. The `DemoData` structure SHALL include a `specVersions` field mapping topic to slug to content.

#### Scenario: Serve pre-embedded data
- **WHEN** any API method is called (getOverview, getSpecs, getSpec, getChanges, getChange)
- **THEN** it returns the corresponding data from the embedded JSON via `Promise.resolve()`

#### Scenario: Client-side search
- **WHEN** `search(query)` is called
- **THEN** it performs case-insensitive substring matching across all spec topic names, spec content, change slugs, and change proposal/design content, returning matching results with context snippets

#### Scenario: Search matches spec topic names
- **WHEN** `search("dashboard")` is called and a spec with topic `dashboard-view` exists
- **THEN** the result includes `dashboard-view` as a match

#### Scenario: No-op for inapplicable methods
- **WHEN** `browse()`, `detect()`, or `resync()` is called
- **THEN** it returns sensible defaults without error (empty browse, `hasOpenSpec: true`, void)

#### Scenario: StaticAdapter getSpecAtChange
- **WHEN** `StaticAdapter.getSpecAtChange("user-auth", "2026-01-15-add-oauth")` is called
- **THEN** it reads from `window.__DEMO_DATA__.specVersions["user-auth"]["2026-01-15-add-oauth"]` and returns `{ content: "..." }`

#### Scenario: StaticAdapter getSpecAtChange not found
- **WHEN** `StaticAdapter.getSpecAtChange("user-auth", "nonexistent")` is called
- **AND** no matching version exists in the embedded data
- **THEN** it rejects with an error
