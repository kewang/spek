## ADDED Requirements

### Requirement: Standalone core package
The core module SHALL be an independent npm package (`@spek/core`) with no framework dependencies, usable by both the web server and the VS Code extension host.

#### Scenario: Import from web server
- **WHEN** the Express server imports `@spek/core`
- **THEN** it can call scanner and task parser functions directly without additional adapters

#### Scenario: Import from extension host
- **WHEN** the VS Code extension host imports `@spek/core`
- **THEN** it can call scanner and task parser functions directly without additional adapters

### Requirement: Scanner functions
The core module SHALL export scanner functions that accept a base path and return structured OpenSpec data.

#### Scenario: Scan overview
- **WHEN** `scanOverview(basePath)` is called with a valid repo path
- **THEN** it returns `{ specsCount, changesCount: { active, archived }, taskStats: { total, completed } }`

#### Scenario: List specs
- **WHEN** `listSpecs(basePath)` is called
- **THEN** it returns an array of `{ topic, path }` for each spec directory

#### Scenario: Read single spec
- **WHEN** `readSpec(basePath, topic)` is called with an existing topic
- **THEN** it returns `{ topic, content, relatedChanges, history }`

#### Scenario: List changes
- **WHEN** `listChanges(basePath)` is called
- **THEN** it returns `{ active: ChangeInfo[], archived: ChangeInfo[] }`

#### Scenario: Read single change
- **WHEN** `readChange(basePath, slug)` is called with an existing change slug
- **THEN** it returns `{ slug, proposal, design, tasks, specs, metadata }`

#### Scenario: Search content
- **WHEN** `searchContent(basePath, query)` is called
- **THEN** it returns matching results across specs and changes with context snippets

### Requirement: Task parser functions
The core module SHALL export task parsing functions that operate on raw Markdown content strings.

#### Scenario: Parse tasks from content
- **WHEN** `parseTasks(content)` is called with Markdown containing `- [x]` and `- [ ]` checkboxes
- **THEN** it returns `{ total, completed, sections }` with tasks grouped by `##` headings

### Requirement: Shared type definitions
The core module SHALL export all TypeScript type definitions used by both the web app and the extension.

#### Scenario: Type imports
- **WHEN** the web app or extension imports types from `@spek/core`
- **THEN** types such as `OverviewData`, `SpecInfo`, `SpecDetail`, `ChangeInfo`, `ChangeDetail`, `ParsedTasks`, `SearchResult` are available
