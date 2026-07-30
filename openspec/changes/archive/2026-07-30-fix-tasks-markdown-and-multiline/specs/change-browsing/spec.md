## MODIFIED Requirements

### Requirement: Custom task checkbox styling

The system SHALL render task items in the Tasks tab using custom SVG icons instead of text-based
`[x]`/`[ ]` markers. Completed tasks SHALL display a filled checkmark icon in green, and incomplete
tasks SHALL display an empty circle icon. Completed task text SHALL have reduced opacity (0.6) in
addition to the existing strikethrough styling.

Task text SHALL be rendered as Markdown using the same CommonMark+GFM renderer as the rest of the
viewer, so inline formatting (emphasis, inline code, links) and a task's continuation lines display as
a standard Markdown renderer would show the same source. The rendering SHALL be limited to standard
Markdown: no spek-specific syntax extensions, and no BDD keyword highlighting or heading anchors in the
Tasks tab. A task with no continuation lines SHALL remain visually unchanged, its text sitting inline
with its checkbox icon.

#### Scenario: Incomplete task display
- **WHEN** a task item is not completed
- **THEN** the task displays an empty circle SVG icon followed by the task text at full opacity

#### Scenario: Completed task display
- **WHEN** a task item is completed
- **THEN** the task displays a green checkmark SVG icon followed by the task text with strikethrough and reduced opacity (0.6)

#### Scenario: Inline formatting in task text
- **WHEN** a task's text contains `**bold**` or `` `code` ``
- **THEN** it renders as emphasized and inline-code styled content rather than literal asterisks and backticks

#### Scenario: Multi-line task display
- **WHEN** a task's text contains continuation lines
- **THEN** the full text is displayed, with sub-bullets rendered as a nested list where standard
  Markdown would render one

#### Scenario: Single-line task layout preserved
- **WHEN** a task's text is a single line
- **THEN** it renders inline beside its checkbox icon with no added block spacing
