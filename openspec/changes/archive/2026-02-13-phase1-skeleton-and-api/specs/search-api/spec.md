## ADDED Requirements

### Requirement: Full-text search endpoint
The system SHALL provide `GET /api/openspec/search` that searches across all specs and changes content.

#### Scenario: Search with matching results
- **WHEN** client sends `GET /api/openspec/search?dir=/path/to/repo&q=effectiveCurrent`
- **THEN** system returns a JSON array of results, each with `type` ("spec" or "change"), `name` (topic or slug), `matches` (array of matching text with context), and `score`
- **AND** results are sorted by relevance score (best match first)

#### Scenario: Search with no results
- **WHEN** client sends `GET /api/openspec/search?dir=/path/to/repo&q=xyznonexistent`
- **THEN** system returns an empty array

#### Scenario: Search without query parameter
- **WHEN** client sends `GET /api/openspec/search?dir=/path/to/repo` without `q` parameter
- **THEN** system returns HTTP 400 with error message

### Requirement: Search context preview
Each search result SHALL include surrounding context to help users identify the relevant content.

#### Scenario: Result includes context
- **WHEN** a search matches text within a Markdown file
- **THEN** the match includes up to 100 characters before and after the matched text as context preview
