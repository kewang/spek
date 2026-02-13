## ADDED Requirements

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
