## ADDED Requirements

### Requirement: Browse directories
The system SHALL provide an API endpoint `GET /api/fs/browse` that returns directory contents for a given path, allowing users to navigate the filesystem to find repos.

#### Scenario: Browse valid directory
- **WHEN** client sends `GET /api/fs/browse?path=/home/user/projects`
- **THEN** system returns a JSON array of entries, each with `name`, `type` ("file" or "directory"), and `path`
- **AND** entries are sorted with directories first, then alphabetically

#### Scenario: Browse without path parameter
- **WHEN** client sends `GET /api/fs/browse` without a `path` parameter
- **THEN** system returns the contents of the user's home directory

#### Scenario: Browse non-existent directory
- **WHEN** client sends `GET /api/fs/browse?path=/nonexistent`
- **THEN** system returns HTTP 400 with an error message

### Requirement: Detect OpenSpec directory
The system SHALL provide an API endpoint `GET /api/fs/detect` that checks whether a given path contains an `openspec/` directory with a valid `config.yaml`.

#### Scenario: Path contains valid OpenSpec directory
- **WHEN** client sends `GET /api/fs/detect?path=/home/user/my-repo`
- **AND** `/home/user/my-repo/openspec/config.yaml` exists
- **THEN** system returns `{ "hasOpenSpec": true, "schema": "<schema-value>" }`

#### Scenario: Path does not contain OpenSpec directory
- **WHEN** client sends `GET /api/fs/detect?path=/home/user/empty-repo`
- **AND** no `openspec/` directory exists at that path
- **THEN** system returns `{ "hasOpenSpec": false }`

### Requirement: Path traversal protection
The system SHALL reject any path that attempts directory traversal outside the specified root.

#### Scenario: Path traversal attempt
- **WHEN** client sends `GET /api/fs/browse?path=/home/user/../../../etc`
- **THEN** system resolves the path and returns the directory contents of the resolved absolute path without exposing system files outside normal filesystem permissions
