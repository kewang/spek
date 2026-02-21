## MODIFIED Requirements

### Requirement: Change list with active/archived separation
The system SHALL display changes grouped into active and archived sections. Active changes SHALL be visually distinguished with a left accent color border (4px). Changes SHALL be sorted by git timestamp descending (most recent first), falling back to slug date when timestamp is unavailable. Each change SHALL display a relative time indicator (e.g., "3 hours ago", "2 days ago") when a git timestamp is available, with the full ISO timestamp shown as a tooltip on hover. When no git timestamp is available, the system SHALL fall back to displaying the slug date in YYYY-MM-DD format.

#### Scenario: Display active changes
- **WHEN** user navigates to the ChangeList page and there are active changes
- **THEN** active changes are listed in an "Active" section with a left accent color border, name, and task progress

#### Scenario: Display archived changes
- **WHEN** user navigates to the ChangeList page
- **THEN** archived changes are listed in an "Archived" section sorted by timestamp descending, without accent border

#### Scenario: Display relative time for changes with timestamp
- **WHEN** a change has a git timestamp
- **THEN** the change displays a relative time (e.g., "2 days ago") instead of YYYY-MM-DD
- **AND** hovering shows the full ISO timestamp as a tooltip

#### Scenario: Display date for changes without timestamp
- **WHEN** a change has no git timestamp
- **THEN** the change displays the slug date in YYYY-MM-DD format

#### Scenario: No changes
- **WHEN** there are no changes in the repo
- **THEN** system displays an empty state message
