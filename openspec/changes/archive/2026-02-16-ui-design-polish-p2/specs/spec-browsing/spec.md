## MODIFIED Requirements

### Requirement: Spec list with filtering
The system SHALL display all specs sorted alphabetically with history count metadata. A filter input SHALL allow instant client-side filtering by spec topic name. Each spec item SHALL display the topic name and the number of related changes (history count) as secondary information.

#### Scenario: Display all specs
- **WHEN** user navigates to the SpecList page
- **THEN** all spec topics are listed alphabetically, each showing the topic name and history change count

#### Scenario: Filter specs
- **WHEN** user types in the filter input
- **THEN** the list is filtered in real-time to show only specs whose topic name contains the search text (case-insensitive)

#### Scenario: Spec with no history
- **WHEN** a spec has zero related changes
- **THEN** the history count is not displayed (or shows "No changes")
