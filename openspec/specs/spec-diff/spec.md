## ADDED Requirements

### Requirement: Read spec content at a specific change version
The system SHALL provide a core function `readSpecAtChange(repoDir, topic, slug)` that reads the spec content from a specific change's delta spec file. It SHALL check both active (`openspec/changes/<slug>/specs/<topic>/spec.md`) and archived (`openspec/changes/archive/<slug>/specs/<topic>/spec.md`) change directories.

#### Scenario: Read spec from active change
- **WHEN** `readSpecAtChange(repoDir, "user-auth", "2026-01-15-add-oauth")` is called
- **AND** `openspec/changes/2026-01-15-add-oauth/specs/user-auth/spec.md` exists
- **THEN** it returns `{ content: "<file contents>" }`

#### Scenario: Read spec from archived change
- **WHEN** `readSpecAtChange(repoDir, "user-auth", "2025-12-01-init")` is called
- **AND** the change is in the archive directory
- **THEN** it returns `{ content: "<file contents>" }` from the archive path

#### Scenario: Spec version not found
- **WHEN** `readSpecAtChange(repoDir, "user-auth", "nonexistent-slug")` is called
- **AND** no delta spec file exists for that topic in that change
- **THEN** it returns `null`

### Requirement: Spec version diff API endpoint
The system SHALL expose `GET /api/openspec/specs/:topic/at/:slug?dir=...` that returns the spec content at a specific change version. The VS Code extension host SHALL handle a `getSpecAtChange` message with the same semantics.

#### Scenario: Fetch spec at change version via REST
- **WHEN** client calls `GET /api/openspec/specs/user-auth/at/2026-01-15-add-oauth?dir=/repo`
- **THEN** the server returns `{ "content": "<delta spec content>" }` with status 200

#### Scenario: Spec version not found via REST
- **WHEN** client calls `GET /api/openspec/specs/user-auth/at/nonexistent?dir=/repo`
- **THEN** the server returns `{ "error": "Spec version not found" }` with status 404

#### Scenario: VS Code extension handles getSpecAtChange
- **WHEN** the webview sends `{ type: "request", method: "getSpecAtChange", params: { topic, slug } }`
- **THEN** the extension host calls `readSpecAtChange` and returns the result

### Requirement: Diff viewer UI component
The system SHALL provide a `SpecDiffViewer` component that renders a unified diff between two spec content strings. Diff computation SHALL be done client-side using the `diff` npm package's `diffLines` function.

#### Scenario: Display unified diff
- **WHEN** the component receives two content strings (old and new)
- **THEN** it renders a unified diff view with added lines highlighted in green and removed lines highlighted in red

#### Scenario: Identical content
- **WHEN** both content strings are identical
- **THEN** it displays a message indicating no differences found

#### Scenario: Empty old content
- **WHEN** the old content is empty (new spec)
- **THEN** all lines in the new content are shown as added

### Requirement: Version comparison interaction on SpecDetail page
The system SHALL add a comparison mode to the SpecDetail page. Users can select a history entry to compare against the current spec content, or select two history entries to compare against each other.

#### Scenario: Compare current vs. history version
- **WHEN** the user clicks a "Compare" action on a history timeline entry
- **THEN** the system fetches the spec content at that change version
- **AND** displays a diff view comparing the change version (old) against the current spec content (new)

#### Scenario: Compare two history versions
- **WHEN** the user selects two history entries for comparison
- **THEN** the system fetches both change versions
- **AND** displays a diff view with the earlier version as old and the later version as new

#### Scenario: Exit diff mode
- **WHEN** the user is viewing a diff and clicks "Close" or "Back to spec"
- **THEN** the diff view is dismissed and the original spec content is shown again

#### Scenario: No history available
- **WHEN** a spec has no history entries
- **THEN** no comparison UI is shown
