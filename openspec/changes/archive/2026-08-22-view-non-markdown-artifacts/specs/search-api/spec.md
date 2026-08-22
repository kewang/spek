## MODIFIED Requirements

### Requirement: Full-text search endpoint
The system SHALL provide `GET /api/openspec/search` that searches across all specs and changes content. A change's searchable content SHALL include its markdown artifacts and its `data` artifacts (root-level `.yaml`, `.yml`, and `.json` files). These come from the same source of truth used for discovery and counting, on every host. Any artifact shown as a tab in the change-detail view is therefore also searchable, whichever host renders it.

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

#### Scenario: Data artifact content is searchable
- **WHEN** a change contains a `data` artifact (for example `asyncapi.yaml`) whose text matches the query
- **THEN** that change appears in the results, consistent with the artifact being shown as a tab
