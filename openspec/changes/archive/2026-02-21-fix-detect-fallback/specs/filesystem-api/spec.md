## MODIFIED Requirements

### Requirement: Detect OpenSpec directory
The system SHALL provide an API endpoint `GET /api/fs/detect` that checks whether a given path contains a valid OpenSpec directory. Detection SHALL first check for `openspec/config.yaml`. If `config.yaml` does not exist, the system SHALL fallback to checking whether `openspec/specs/` or `openspec/changes/` directory exists.

#### Scenario: Path contains valid OpenSpec directory with config.yaml
- **WHEN** client sends `GET /api/fs/detect?path=/home/user/my-repo`
- **AND** `/home/user/my-repo/openspec/config.yaml` exists
- **THEN** system returns `{ "hasOpenSpec": true, "schema": "<schema-value>" }`

#### Scenario: Path contains OpenSpec directory without config.yaml
- **WHEN** client sends `GET /api/fs/detect?path=/home/user/my-repo`
- **AND** `/home/user/my-repo/openspec/config.yaml` does not exist
- **AND** `/home/user/my-repo/openspec/specs/` or `/home/user/my-repo/openspec/changes/` exists
- **THEN** system returns `{ "hasOpenSpec": true, "schema": "unknown" }`

#### Scenario: Path does not contain OpenSpec directory
- **WHEN** client sends `GET /api/fs/detect?path=/home/user/empty-repo`
- **AND** no `openspec/` directory exists at that path, or `openspec/` exists but contains neither `specs/` nor `changes/`
- **THEN** system returns `{ "hasOpenSpec": false }`
