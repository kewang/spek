## ADDED Requirements

### Requirement: Spec list with filtering
The system SHALL display all specs sorted alphabetically. A filter input SHALL allow instant client-side filtering by spec topic name.

#### Scenario: Display all specs
- **WHEN** user navigates to the SpecList page
- **THEN** all spec topics are listed alphabetically

#### Scenario: Filter specs
- **WHEN** user types in the filter input
- **THEN** the list is filtered in real-time to show only specs whose topic name contains the search text (case-insensitive)

### Requirement: Spec detail display
The system SHALL display the full content of a spec when the user navigates to its detail page. The raw markdown content SHALL be shown (react-markdown rendering deferred to Phase 3).

#### Scenario: View spec content
- **WHEN** user navigates to `/specs/:topic`
- **THEN** system displays the spec topic as title and the full spec.md content

#### Scenario: Spec not found
- **WHEN** user navigates to a spec topic that does not exist
- **THEN** system displays a "not found" message

### Requirement: Related changes display
The spec detail page SHALL display a list of changes that affect the spec (from the API's `relatedChanges` field). Each change SHALL be a link to its detail page.

#### Scenario: Show related changes
- **WHEN** viewing a spec that has related changes
- **THEN** a "Related Changes" section lists each change as a clickable link to `/changes/:slug`

#### Scenario: No related changes
- **WHEN** viewing a spec with no related changes
- **THEN** the "Related Changes" section shows an empty state message
