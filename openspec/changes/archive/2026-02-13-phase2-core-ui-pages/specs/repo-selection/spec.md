## ADDED Requirements

### Requirement: Path input with auto-detection
The system SHALL provide a text input for entering a filesystem path. Upon input, the system SHALL call the detect API to check for an `openspec/` directory and display the detection result.

#### Scenario: Valid path with openspec directory
- **WHEN** user enters a path that contains an `openspec/` directory
- **THEN** system displays a success indicator and a button to open the repo

#### Scenario: Valid path without openspec directory
- **WHEN** user enters a path that does not contain an `openspec/` directory
- **THEN** system displays a warning message indicating no openspec directory found

#### Scenario: Invalid path
- **WHEN** user enters a path that does not exist
- **THEN** system displays an error message

### Requirement: Directory browsing
The system SHALL provide a directory browser that calls the browse API, allowing users to navigate the filesystem and select a repo path.

#### Scenario: Browse directories
- **WHEN** user clicks the browse button
- **THEN** system displays a list of directories at the current path
- **AND** user can click a directory to navigate into it
- **AND** user can select the current directory as the repo path

### Requirement: Recent paths persistence
The system SHALL persist the most recent 5 repo paths in localStorage. On page load, previously used paths SHALL be displayed for quick selection.

#### Scenario: Save path on successful detection
- **WHEN** user successfully opens a repo (path with valid openspec/)
- **THEN** the path is saved to localStorage recent paths list (max 5, most recent first)

#### Scenario: Display recent paths on load
- **WHEN** user visits the SelectRepo page
- **THEN** previously saved paths are displayed as clickable options

### Requirement: Auto-navigate to dashboard
The system SHALL automatically navigate to the Dashboard page after the user selects a valid repo path.

#### Scenario: Navigate after selection
- **WHEN** user selects a valid repo path (via input, browse, or recent paths)
- **THEN** system navigates to `/dashboard` with the repo path set in RepoContext
