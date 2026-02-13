## MODIFIED Requirements

### Requirement: Spec history data in API response
The system SHALL include a `history` array in the `GET /api/openspec/specs/:topic` response. Each entry MUST contain the change slug, date (if parseable from slug), timestamp (ISO 8601 from git commit cache, or null if unavailable), description, and status (active or archived).

#### Scenario: Spec with related changes
- **WHEN** a spec has been affected by one or more changes (i.e., changes that contain a delta spec for this topic)
- **THEN** the API response includes a `history` array with entries sorted by git commit timestamp descending (most recent first)
- **AND** if two entries have the same date, the git commit timestamp determines their order
- **AND** each entry contains `{ slug, date, timestamp, description, status }`

#### Scenario: Spec with no related changes
- **WHEN** a spec has no related changes
- **THEN** the API response includes an empty `history` array

#### Scenario: Fallback sorting when git timestamp unavailable
- **WHEN** a history entry has no git commit timestamp (e.g., uncommitted change or non-git repo)
- **THEN** the entry's `timestamp` field is null
- **AND** sorting falls back to the date parsed from the slug
