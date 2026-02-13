## ADDED Requirements

### Requirement: Overview endpoint
The system SHALL provide `GET /api/openspec/overview` that returns aggregate statistics for an OpenSpec repository.

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
The system SHALL provide `GET /api/openspec/changes` that returns all changes grouped by status.

#### Scenario: List changes with active and archived
- **WHEN** client sends `GET /api/openspec/changes?dir=/path/to/repo`
- **THEN** system returns JSON with `active` array and `archived` array
- **AND** each change includes `slug`, `date` (parsed from slug prefix), `description` (parsed from slug), `hasProposal`, `hasDesign`, `hasTasks`, `hasSpecs`, and `taskStats`
- **AND** changes are sorted by date descending (newest first)

### Requirement: Get single change
The system SHALL provide `GET /api/openspec/changes/:slug` that returns full change content.

#### Scenario: Get existing change with all artifacts
- **WHEN** client sends `GET /api/openspec/changes/2026-02-10-my-feature?dir=/path/to/repo`
- **THEN** system returns JSON with `slug`, `proposal` (Markdown content or null), `design` (Markdown content or null), `tasks` (parsed task structure or null), `specs` (array of delta spec contents), and `metadata` (from `.openspec.yaml` if present)

#### Scenario: Get non-existent change
- **WHEN** client sends `GET /api/openspec/changes/nonexistent?dir=/path/to/repo`
- **THEN** system returns HTTP 404

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

### Requirement: Resync UI control
The system SHALL display a resync button in the sidebar that triggers a cache rebuild. The button MUST show a loading state while the resync is in progress.

#### Scenario: User triggers resync
- **WHEN** the user clicks the resync button in the sidebar
- **THEN** the system sends `POST /api/openspec/resync` with the current repo path
- **AND** the button shows a loading/spinning state during the request
- **AND** on success, the current page data is refreshed to reflect updated ordering

#### Scenario: Resync with no repo selected
- **WHEN** no repo is currently selected
- **THEN** the resync button is not displayed or is disabled
