## ADDED Requirements

### Requirement: Change list with active/archived separation
The system SHALL display changes grouped into active and archived sections. Archived changes SHALL be sorted by date (most recent first).

#### Scenario: Display active changes
- **WHEN** user navigates to the ChangeList page and there are active changes
- **THEN** active changes are listed in an "Active" section with name and task progress

#### Scenario: Display archived changes
- **WHEN** user navigates to the ChangeList page
- **THEN** archived changes are listed in an "Archived" section sorted by date descending

#### Scenario: No changes
- **WHEN** there are no changes in the repo
- **THEN** system displays an empty state message

### Requirement: Change detail with tab navigation
The system SHALL display change details using a tabbed interface with tabs for: Proposal, Design, Tasks, and Specs (delta specs).

#### Scenario: View proposal tab
- **WHEN** user views a change and clicks the Proposal tab
- **THEN** the proposal.md content is displayed (raw markdown)

#### Scenario: View design tab
- **WHEN** user clicks the Design tab
- **THEN** the design.md content is displayed (raw markdown)

#### Scenario: View tasks tab
- **WHEN** user clicks the Tasks tab
- **THEN** the tasks.md content is displayed with a TaskProgress bar showing completion statistics

#### Scenario: View specs tab
- **WHEN** user clicks the Specs tab and the change has delta specs
- **THEN** the delta spec files are listed and their content displayed

#### Scenario: Missing artifact
- **WHEN** a tab's corresponding artifact file does not exist
- **THEN** the tab shows a "No content" placeholder

### Requirement: Task progress display in change detail
The Tasks tab SHALL display a progress bar and statistics (completed/total) derived from the change's task data.

#### Scenario: Show task progress
- **WHEN** viewing the Tasks tab of a change with tasks
- **THEN** a TaskProgress component shows a visual progress bar with "X / Y completed" text

### Requirement: Capability ID linking in proposal
The system SHALL render inline code elements in proposal markdown as navigable links when the code text matches an existing spec topic name.

#### Scenario: Capability ID matches existing spec
- **WHEN** a proposal markdown contains an inline code element (e.g., `` `responsive-layout` ``)
- **AND** a spec with the topic name `responsive-layout` exists
- **THEN** the inline code SHALL be rendered as a clickable link navigating to `/specs/responsive-layout`

#### Scenario: Inline code does not match any spec
- **WHEN** a proposal markdown contains an inline code element that does not match any existing spec topic
- **THEN** the inline code SHALL be rendered as a normal styled code element without a link

#### Scenario: MarkdownRenderer receives spec topics list
- **WHEN** MarkdownRenderer is used with a `specTopics` prop containing the list of available spec topic names
- **THEN** inline code matching any topic in the list SHALL be rendered as navigable links
