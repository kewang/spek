## ADDED Requirements

### Requirement: Parse task checkboxes
The task parser SHALL read a tasks.md file and extract checkbox items with their completion status.

#### Scenario: Parse file with mixed checkboxes
- **WHEN** parser reads a tasks.md containing `- [x] Done task` and `- [ ] Pending task`
- **THEN** it returns each task with `text` and `completed` (boolean) fields

### Requirement: Group tasks by section
The task parser SHALL group tasks under their `##` heading sections.

#### Scenario: Tasks under multiple sections
- **WHEN** parser reads a tasks.md with `## Phase 1` followed by tasks and `## Phase 2` followed by tasks
- **THEN** it returns sections array, each with `title` and `tasks` array

#### Scenario: Tasks without section headings
- **WHEN** parser reads a tasks.md where tasks appear before any `##` heading
- **THEN** those tasks are grouped under a default section with empty title

### Requirement: Calculate task statistics
The task parser SHALL compute aggregate statistics from parsed tasks.

#### Scenario: Calculate completion stats
- **WHEN** parser processes a tasks.md with 10 total checkboxes where 7 are checked
- **THEN** it returns `{ total: 10, completed: 7 }` along with the sections breakdown

#### Scenario: Empty tasks file
- **WHEN** parser processes an empty tasks.md or one with no checkboxes
- **THEN** it returns `{ total: 0, completed: 0, sections: [] }`
