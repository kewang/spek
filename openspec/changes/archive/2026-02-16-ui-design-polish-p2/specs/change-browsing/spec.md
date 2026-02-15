## MODIFIED Requirements

### Requirement: Change detail with tab navigation
The system SHALL display change details using a tabbed interface with tabs in OpenSpec workflow order: Proposal, Design, Specs (delta specs), and Tasks. Tab content SHALL transition with a fade-in animation when switching.

#### Scenario: View proposal tab
- **WHEN** user views a change and clicks the Proposal tab
- **THEN** the proposal.md content is displayed with a fade-in transition

#### Scenario: View design tab
- **WHEN** user clicks the Design tab
- **THEN** the design.md content is displayed with a fade-in transition

#### Scenario: View specs tab
- **WHEN** user clicks the Specs tab and the change has delta specs
- **THEN** the delta spec files are listed and their content displayed with a fade-in transition

#### Scenario: View tasks tab
- **WHEN** user clicks the Tasks tab
- **THEN** the tasks.md content is displayed with a TaskProgress bar showing completion statistics, with a fade-in transition

#### Scenario: Tab order
- **WHEN** the ChangeDetail page is rendered
- **THEN** the tabs are displayed in order: Proposal, Design, Specs, Tasks (matching the OpenSpec workflow sequence)

#### Scenario: Missing artifact
- **WHEN** a tab's corresponding artifact file does not exist
- **THEN** the tab shows a "No content" placeholder

### Requirement: Change list with active/archived separation
The system SHALL display changes grouped into active and archived sections. Active changes SHALL be visually distinguished with a left accent color border (4px). Archived changes SHALL be sorted by date (most recent first).

#### Scenario: Display active changes
- **WHEN** user navigates to the ChangeList page and there are active changes
- **THEN** active changes are listed in an "Active" section with a left accent color border, name, and task progress

#### Scenario: Display archived changes
- **WHEN** user navigates to the ChangeList page
- **THEN** archived changes are listed in an "Archived" section sorted by date descending, without accent border

#### Scenario: No changes
- **WHEN** there are no changes in the repo
- **THEN** system displays an empty state message

## ADDED Requirements

### Requirement: Custom task checkbox styling
The system SHALL render task items in the Tasks tab using custom SVG icons instead of text-based `[x]`/`[ ]` markers. Completed tasks SHALL display a filled checkmark icon in green, and incomplete tasks SHALL display an empty circle icon. Completed task text SHALL have reduced opacity (0.6) in addition to the existing strikethrough styling.

#### Scenario: Incomplete task display
- **WHEN** a task item is not completed
- **THEN** the task displays an empty circle SVG icon followed by the task text at full opacity

#### Scenario: Completed task display
- **WHEN** a task item is completed
- **THEN** the task displays a green checkmark SVG icon followed by the task text with strikethrough and reduced opacity (0.6)
