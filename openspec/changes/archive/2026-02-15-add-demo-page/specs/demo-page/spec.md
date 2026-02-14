## ADDED Requirements

### Requirement: StaticAdapter implements ApiAdapter
The system SHALL provide a `StaticAdapter` class that implements the `ApiAdapter` interface, reading all data from a pre-embedded JSON object (`window.__DEMO_DATA__`).

#### Scenario: Serve pre-embedded data
- **WHEN** any API method is called (getOverview, getSpecs, getSpec, getChanges, getChange)
- **THEN** it returns the corresponding data from the embedded JSON via `Promise.resolve()`

#### Scenario: Client-side search
- **WHEN** `search(query)` is called
- **THEN** it performs case-insensitive string matching across all spec and change content, returning matching results with context snippets

#### Scenario: No-op for inapplicable methods
- **WHEN** `browse()`, `detect()`, or `resync()` is called
- **THEN** it returns sensible defaults without error (empty browse, `hasOpenSpec: true`, void)

### Requirement: Demo entry point with HashRouter
The system SHALL provide a `DemoApp.tsx` entry point that uses `HashRouter` and `StaticAdapter`, with the same routes and components as the existing Webview app (Dashboard, Specs, Changes, Search).

#### Scenario: Render demo app
- **WHEN** user opens `demo.html`
- **THEN** the app renders with Dashboard as the initial view, using all existing React components

#### Scenario: Hash-based routing
- **WHEN** user navigates between views
- **THEN** the URL hash updates (e.g., `#/specs/api-adapter`) and the app works with `file://` protocol

### Requirement: Build script generates self-contained demo.html
The system SHALL provide a build script that collects openspec data using `@spek/core`, runs Vite build, and assembles a single self-contained `docs/demo.html` with all JS, CSS, and data inlined.

#### Scenario: Build demo
- **WHEN** user runs `npm run build:demo`
- **THEN** system generates `docs/demo.html` containing the complete React app with embedded openspec data

#### Scenario: Self-contained output
- **WHEN** `docs/demo.html` is generated
- **THEN** the file has no external dependencies and can be opened directly in a browser or served via GitHub Pages
