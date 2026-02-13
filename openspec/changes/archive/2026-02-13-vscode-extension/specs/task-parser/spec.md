## MODIFIED Requirements

### Requirement: Parse task checkboxes
The task parser SHALL be a pure function in the `@spek/core` package that reads a tasks.md content string and extracts checkbox items with their completion status. It SHALL have no dependency on Express or any HTTP framework.

#### Scenario: Parse file with mixed checkboxes
- **WHEN** parser receives a string containing `- [x] Done task` and `- [ ] Pending task`
- **THEN** it returns each task with `text` and `completed` (boolean) fields

### Requirement: Group tasks by section
The task parser SHALL group tasks under their `##` heading sections.

#### Scenario: Tasks under multiple sections
- **WHEN** parser receives a string with `## Phase 1` followed by tasks and `## Phase 2` followed by tasks
- **THEN** it returns sections array, each with `title` and `tasks` array

#### Scenario: Tasks without section headings
- **WHEN** parser receives a string where tasks appear before any `##` heading
- **THEN** those tasks are grouped under a default section with empty title

### Requirement: Calculate task statistics
The task parser SHALL compute aggregate statistics from parsed tasks.

#### Scenario: Calculate completion stats
- **WHEN** parser processes a string with 10 total checkboxes where 7 are checked
- **THEN** it returns `{ total: 10, completed: 7 }` along with the sections breakdown

#### Scenario: Empty tasks file
- **WHEN** parser processes an empty string or one with no checkboxes
- **THEN** it returns `{ total: 0, completed: 0, sections: [] }`
