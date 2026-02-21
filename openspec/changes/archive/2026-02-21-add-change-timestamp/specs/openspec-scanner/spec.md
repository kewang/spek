## MODIFIED Requirements

### Requirement: Scan OpenSpec directory structure
The scanner SHALL be an async function in the `@spek/core` package that reads an OpenSpec directory and returns its complete structure including specs, active changes, and archived changes. Each `ChangeInfo` SHALL include a `timestamp` field (ISO 8601 string or null) obtained from the git timestamp cache. Changes SHALL be sorted by timestamp descending (most recent first), falling back to slug date when timestamp is unavailable. It SHALL use Node.js `fs` directly and have no dependency on Express or any HTTP framework.

#### Scenario: Scan repo with full OpenSpec structure
- **WHEN** scanner is given a repo path containing `openspec/specs/` and `openspec/changes/`
- **THEN** it returns a structure with `specs` (list of topic names), `activeChanges` (changes directly under `openspec/changes/` excluding `archive/`), and `archivedChanges` (changes under `openspec/changes/archive/`)
- **AND** each `ChangeInfo` in `activeChanges` and `archivedChanges` SHALL include a `timestamp` field from the git timestamp cache

#### Scenario: Scan repo with empty OpenSpec directory
- **WHEN** scanner is given a repo path where `openspec/` exists but contains only `config.yaml`
- **THEN** it returns empty arrays for specs, activeChanges, and archivedChanges

#### Scenario: Sort changes by timestamp
- **WHEN** multiple changes exist with the same slug date (e.g., `2026-02-17-foo` and `2026-02-17-bar`)
- **THEN** changes SHALL be sorted by git timestamp descending (most recent first)

#### Scenario: Sort changes without git timestamps
- **WHEN** the repo is not a git repository or changes have no git history
- **THEN** changes SHALL be sorted by slug date descending as fallback
- **AND** all `timestamp` fields SHALL be null
