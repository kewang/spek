## ADDED Requirements

### Requirement: Build timestamp cache from git log
The system SHALL provide a function that executes a single `git log` command scoped to `openspec/changes/` and parses the output to build a Map of change slug to earliest commit timestamp (ISO 8601 format).

#### Scenario: Build cache for repo with git history
- **WHEN** the cache builder is invoked for a repo directory that is a git repository
- **THEN** the system executes `git log --format="COMMIT %aI" --name-only -- openspec/changes/` in the repo directory
- **AND** parses the output to extract the earliest commit timestamp for each change slug
- **AND** returns a `Map<string, string>` mapping slug to ISO 8601 timestamp

#### Scenario: Build cache for non-git directory
- **WHEN** the cache builder is invoked for a directory that is not a git repository
- **THEN** the system returns an empty Map without throwing an error

#### Scenario: Change exists in filesystem but not in git
- **WHEN** a change directory exists but has no git commits (e.g., uncommitted new change)
- **THEN** that change slug is not present in the returned Map

### Requirement: In-memory cache keyed by repo path
The system SHALL maintain an in-memory cache (`Map<string, Map<string, string>>`) keyed by absolute repo directory path, storing the timestamp Map for each repo.

#### Scenario: Cache hit
- **WHEN** a timestamp lookup is requested for a repo that has been previously cached
- **THEN** the system returns the cached Map without executing any git commands

#### Scenario: Cache miss with lazy build
- **WHEN** a timestamp lookup is requested for a repo that has not been cached
- **THEN** the system automatically builds the cache by executing the git log command
- **AND** stores the result for subsequent lookups

### Requirement: Resync cache
The system SHALL provide a resync function that clears the cached timestamps for a given repo and immediately rebuilds the cache from git.

#### Scenario: Resync after repo changes
- **WHEN** the resync function is invoked for a repo directory
- **THEN** the system clears the existing cache entry for that repo
- **AND** rebuilds the cache by executing the git log command
- **AND** returns the newly built timestamp Map
