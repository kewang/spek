## MODIFIED Requirements

### Requirement: Recent paths persistence
The system SHALL persist the most recent 5 repo paths in localStorage. On page load, previously used paths SHALL be displayed for quick selection. Each recent path SHALL be validated asynchronously against the detect API to show its current status (valid, invalid, or checking).

#### Scenario: Save path on successful detection
- **WHEN** user successfully opens a repo (path with valid openspec/)
- **THEN** the path is saved to localStorage recent paths list (max 5, most recent first)

#### Scenario: Display recent paths on load
- **WHEN** user visits the SelectRepo page
- **THEN** previously saved paths are displayed as clickable options

#### Scenario: Validate recent paths asynchronously
- **WHEN** the SelectRepo page loads with saved recent paths
- **THEN** the system calls the detect API for each path in parallel
- **AND** each path displays a status indicator: spinner (checking), green checkmark (valid openspec/ found), or red indicator (path invalid or no openspec/)

#### Scenario: Remove invalid path
- **WHEN** a recent path is determined to be invalid
- **THEN** a delete button appears next to the path allowing the user to remove it from the list
