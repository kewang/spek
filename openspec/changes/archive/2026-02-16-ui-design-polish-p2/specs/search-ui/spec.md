## MODIFIED Requirements

### Requirement: Search query execution
The system SHALL search across all specs and changes content by calling the backend search API with debounced input. Search results SHALL highlight matching text fragments in the title and context preview.

#### Scenario: Debounced search on input
- **WHEN** user types a query in the search input
- **THEN** the system waits 300ms after the last keystroke before sending the search request

#### Scenario: Display search results with highlights
- **WHEN** the search API returns results
- **THEN** results are displayed grouped by type (Specs and Changes), with matching query text highlighted using a contrasting background color in both the title and context snippet

#### Scenario: No results found
- **WHEN** the search API returns an empty array
- **THEN** the dialog displays a "No results found" message with a suggestion to try different keywords

#### Scenario: Empty query
- **WHEN** the search input is empty
- **THEN** no search request is made and the results area shows a prompt to start typing

## ADDED Requirements

### Requirement: Search type filter
The system SHALL provide a type filter in the search dialog allowing users to narrow results by category: All, Specs only, or Changes only.

#### Scenario: Filter by type
- **WHEN** user selects "Specs" filter while search results are displayed
- **THEN** only spec-type results are shown, change-type results are hidden

#### Scenario: Default filter
- **WHEN** the search dialog opens
- **THEN** the "All" filter is selected by default, showing both spec and change results

#### Scenario: Filter with no matching results
- **WHEN** user selects a type filter and no results match that type
- **THEN** a "No results found" message is displayed for that category
