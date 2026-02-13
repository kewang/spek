## ADDED Requirements

### Requirement: Overview statistics display
The system SHALL display overview statistics from the overview API: total specs count, active changes count, archived changes count, and task completion rate (percentage).

#### Scenario: Display statistics
- **WHEN** user navigates to the Dashboard page
- **THEN** system displays specs count, active changes count, archived changes count, and overall task completion percentage in stat cards

### Requirement: Active changes list
The system SHALL display a list of active changes with their names and task progress indicators.

#### Scenario: Show active changes with progress
- **WHEN** there are active changes in the repo
- **THEN** each active change is displayed with its name and a TaskProgress bar showing completed/total tasks

#### Scenario: No active changes
- **WHEN** there are no active changes
- **THEN** system displays an empty state message

### Requirement: Recent archived changes
The system SHALL display the most recent 10 archived changes.

#### Scenario: Show archived changes
- **WHEN** user views the Dashboard
- **THEN** the most recent 10 archived changes are listed with their names and dates

### Requirement: Navigation cards
The system SHALL provide navigation cards/links to the Specs list and Changes list pages.

#### Scenario: Navigate to specs
- **WHEN** user clicks the Specs navigation card
- **THEN** system navigates to `/specs`

#### Scenario: Navigate to changes
- **WHEN** user clicks the Changes navigation card
- **THEN** system navigates to `/changes`
