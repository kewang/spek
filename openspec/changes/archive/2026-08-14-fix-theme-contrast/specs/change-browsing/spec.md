## MODIFIED Requirements

### Requirement: Custom task checkbox styling
The system SHALL render task items in the Tasks tab using custom SVG icons instead of text-based `[x]`/`[ ]` markers. Completed tasks SHALL display a filled checkmark icon in green, and incomplete tasks SHALL display an empty circle icon. Completed task text SHALL be de-emphasised relative to an incomplete task's, in addition to the existing strikethrough styling.

The de-emphasis SHALL be carried by a colour from the theme's palette, and SHALL NOT be produced by opacity applied
to the task row. Opacity on the row composites every descendant toward the page — the body text, and also the links
and inline code spans a task's Markdown may contain, each of which sets its own colour — so no palette value can
compensate for it. Everything the row renders remains subject to the readability floor stated by `theme-toggle`,
including the checkmark icon, which is a graphical object carrying the completed state.

Task text SHALL be rendered as Markdown using the same CommonMark+GFM renderer as the rest of the
viewer, so inline formatting (emphasis, inline code, links) and a task's continuation lines display as
a standard Markdown renderer would show the same source. The rendering SHALL be limited to standard
Markdown: no spek-specific syntax extensions, and no BDD keyword highlighting or heading anchors in the
Tasks tab. A task with no continuation lines SHALL remain visually unchanged, its text sitting inline
with its checkbox icon.

#### Scenario: Incomplete task display
- **WHEN** a task item is not completed
- **THEN** the task displays an empty circle SVG icon followed by the task text at the primary text colour

#### Scenario: Completed task display
- **WHEN** a task item is completed
- **THEN** the task displays a green checkmark SVG icon followed by the task text with strikethrough and a de-emphasised text colour
- **AND** the row applies no opacity

#### Scenario: A completed task stays readable
- **WHEN** a completed task's text contains a link or an inline code span
- **AND** either theme is active
- **THEN** that link or code span still meets the readability floor stated by `theme-toggle`

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
