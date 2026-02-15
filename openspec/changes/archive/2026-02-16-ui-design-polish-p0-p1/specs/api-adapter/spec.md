## ADDED Requirements

### Requirement: StaticAdapter for demo
The demo version SHALL use a `StaticAdapter` that reads all data from a pre-embedded JSON object (`window.__DEMO_DATA__`) and implements the `ApiAdapter` interface.

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
