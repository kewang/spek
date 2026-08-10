## ADDED Requirements

### Requirement: Schemas endpoint

The system SHALL provide a read-only `GET /api/openspec/schemas` that returns the workflow schemas
available to a repository. It SHALL require the `dir` parameter and SHALL return the repo's active
schema name, the enumerated schemas (each carrying at least `name`, `description`, `source`,
`artifactCount`, `isDefault`, and the active changes using it), and — when package schemas could not
be enumerated — a machine-readable reason for that degradation. It SHALL NOT scan change artifacts.

A CLI failure SHALL NOT become an HTTP error: the endpoint SHALL return HTTP 200 with the degraded
enumeration and its reason.

#### Scenario: List schemas for a repo

- **WHEN** client sends `GET /api/openspec/schemas?dir=/path/to/repo`
- **THEN** system returns JSON containing the active schema name and the enumerated schemas with
  `name`, `description`, `source`, `artifactCount`, `isDefault`, and their change usage

#### Scenario: Degraded enumeration returns 200

- **WHEN** client sends `GET /api/openspec/schemas?dir=/path/to/repo` on a machine with no `openspec`
  CLI installed
- **THEN** system returns HTTP 200 with an empty schema list and a reason stating that schemas could
  not be enumerated

#### Scenario: Schemas endpoint without dir parameter

- **WHEN** client sends `GET /api/openspec/schemas` without a `dir` parameter
- **THEN** system returns HTTP 400 with error message "dir parameter is required"

### Requirement: Schema detail endpoint

The system SHALL provide a read-only `GET /api/openspec/schemas/:name` that returns one schema's
full definition — its metadata, its ordered artifacts (each with `id`, `generates`, `description`,
`requires`, `instruction`), its apply step, and the active changes declaring it. It SHALL require
the `dir` parameter and SHALL accept the same aggregation parameters as the schemas endpoint, so the
usage it reports is counted over the same changes. It SHALL
validate `:name` as a single safe path segment and SHALL return HTTP 404 for a name that fails
validation or resolves to no schema. When the schema cannot be resolved because the `openspec` CLI
is unavailable, the response SHALL distinguish that reason from the schema not existing.

#### Scenario: Get a schema definition

- **WHEN** client sends `GET /api/openspec/schemas/spec-driven?dir=/path/to/repo`
- **THEN** system returns the schema's metadata, its artifacts in schema order with their
  instructions, its apply step, and its active-change usage

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
