## ADDED Requirements

### Requirement: Overview statistics display
The system SHALL display overview statistics from the overview API: total specs count, active changes count, archived changes count, and task completion rate (percentage). Statistics SHALL be displayed in stat cards with large numbers (text-4xl) and a staggered fade-in-up entry animation on page load.

#### Scenario: Display statistics
- **WHEN** user navigates to the Dashboard page
- **THEN** system displays specs count, active changes count, archived changes count, and overall task completion percentage in stat cards with large accent-colored numbers

#### Scenario: Staggered entry animation
- **WHEN** the Dashboard page loads
- **THEN** the four stat cards appear with a fade-in-up animation, each card delayed by an incremental amount (e.g., 0ms, 80ms, 160ms, 240ms) creating a staggered reveal effect

#### Scenario: Reduced motion preference
- **WHEN** user has `prefers-reduced-motion: reduce` enabled
- **THEN** stat cards appear immediately without animation

### Requirement: Active changes list
The system SHALL display a list of active changes with their names and task progress indicators.

#### Scenario: Show active changes with progress
- **WHEN** there are active changes in the repo
- **THEN** each active change is displayed with its name and a TaskProgress bar showing completed/total tasks

#### Scenario: No active changes
- **WHEN** there are no active changes
- **THEN** system displays an empty state message

### Requirement: Recent archived changes
The system SHALL display the most recent 10 archived changes. Each change SHALL display a relative time indicator (e.g., "3 hours ago", "2 days ago") when a git timestamp is available, with the full ISO timestamp shown as a tooltip on hover. When no git timestamp is available, the system SHALL fall back to displaying the slug date in YYYY-MM-DD format.

#### Scenario: Show archived changes with timestamp
- **WHEN** user views the Dashboard and archived changes have git timestamps
- **THEN** the most recent 10 archived changes are listed with their names and relative time (e.g., "3 hours ago")
- **AND** hovering over the time shows the full ISO timestamp as a tooltip

#### Scenario: Show archived changes without timestamp
- **WHEN** user views the Dashboard and archived changes have no git timestamp
- **THEN** the changes are listed with their names and slug date in YYYY-MM-DD format

### Requirement: Navigation cards
The system SHALL provide navigation cards/links to the Specs list and Changes list pages.

#### Scenario: Navigate to specs
- **WHEN** user clicks the Specs navigation card
- **THEN** system navigates to `/specs`

#### Scenario: Navigate to changes
- **WHEN** user clicks the Changes navigation card
- **THEN** system navigates to `/changes`
