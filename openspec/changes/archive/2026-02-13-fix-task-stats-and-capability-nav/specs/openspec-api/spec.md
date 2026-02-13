## MODIFIED Requirements

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
