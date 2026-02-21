## MODIFIED Requirements

### Requirement: Recent archived changes
The system SHALL display the most recent 10 archived changes. Each change SHALL display a relative time indicator (e.g., "3 hours ago", "2 days ago") when a git timestamp is available, with the full ISO timestamp shown as a tooltip on hover. When no git timestamp is available, the system SHALL fall back to displaying the slug date in YYYY-MM-DD format.

#### Scenario: Show archived changes with timestamp
- **WHEN** user views the Dashboard and archived changes have git timestamps
- **THEN** the most recent 10 archived changes are listed with their names and relative time (e.g., "3 hours ago")
- **AND** hovering over the time shows the full ISO timestamp as a tooltip

#### Scenario: Show archived changes without timestamp
- **WHEN** user views the Dashboard and archived changes have no git timestamp
- **THEN** the changes are listed with their names and slug date in YYYY-MM-DD format
