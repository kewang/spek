## ADDED Requirements

### Requirement: Search dialog activation
The system SHALL provide a search dialog that can be opened via keyboard shortcut or UI interaction.

#### Scenario: Open search with keyboard shortcut
- **WHEN** user presses `Cmd+K` (macOS) or `Ctrl+K` (other platforms) anywhere in the application
- **THEN** a search dialog modal opens with focus on the search input field

#### Scenario: Open search via header button
- **WHEN** user clicks the search button in the application header
- **THEN** the search dialog modal opens with focus on the search input field

#### Scenario: Close search with Escape
- **WHEN** the search dialog is open and user presses `Escape`
- **THEN** the search dialog closes

#### Scenario: Close search by clicking backdrop
- **WHEN** the search dialog is open and user clicks outside the dialog
- **THEN** the search dialog closes

### Requirement: Search query execution
The system SHALL search across all specs and changes content by calling the backend search API with debounced input.

#### Scenario: Debounced search on input
- **WHEN** user types a query in the search input
- **THEN** the system waits 300ms after the last keystroke before sending the search request to `GET /api/openspec/search`

#### Scenario: Display search results
- **WHEN** the search API returns results
- **THEN** results are displayed grouped by type (Specs and Changes), each showing the name and a context preview snippet

#### Scenario: No results found
- **WHEN** the search API returns an empty array
- **THEN** the dialog displays a "No results found" message

#### Scenario: Empty query
- **WHEN** the search input is empty
- **THEN** no search request is made and the results area shows a prompt to start typing

### Requirement: Search result navigation
The system SHALL allow users to navigate to search results using keyboard or mouse.

#### Scenario: Click to navigate
- **WHEN** user clicks on a search result
- **THEN** the application navigates to the corresponding page (`/specs/:topic` for spec results, `/changes/:slug` for change results) and the search dialog closes

#### Scenario: Keyboard navigation with arrow keys
- **WHEN** user presses the down arrow key in the search dialog
- **THEN** the next result item is highlighted
- **AND** pressing the up arrow key highlights the previous result item

#### Scenario: Confirm selection with Enter
- **WHEN** user presses Enter with a result item highlighted
- **THEN** the application navigates to that result's page and the search dialog closes
