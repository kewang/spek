## ADDED Requirements

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
