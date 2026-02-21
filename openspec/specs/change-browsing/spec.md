## ADDED Requirements

### Requirement: Change list with active/archived separation
The system SHALL display changes grouped into active and archived sections. Active changes SHALL be visually distinguished with a left accent color border (4px). Changes SHALL be sorted by git timestamp descending (most recent first), falling back to slug date when timestamp is unavailable. Each change SHALL display a relative time indicator (e.g., "3 hours ago", "2 days ago") when a git timestamp is available, with the full ISO timestamp shown as a tooltip on hover. When no git timestamp is available, the system SHALL fall back to displaying the slug date in YYYY-MM-DD format.

#### Scenario: Display active changes
- **WHEN** user navigates to the ChangeList page and there are active changes
- **THEN** active changes are listed in an "Active" section with a left accent color border, name, and task progress

#### Scenario: Display archived changes
- **WHEN** user navigates to the ChangeList page
- **THEN** archived changes are listed in an "Archived" section sorted by timestamp descending, without accent border

#### Scenario: Display relative time for changes with timestamp
- **WHEN** a change has a git timestamp
- **THEN** the change displays a relative time (e.g., "2 days ago") instead of YYYY-MM-DD
- **AND** hovering shows the full ISO timestamp as a tooltip

#### Scenario: Display date for changes without timestamp
- **WHEN** a change has no git timestamp
- **THEN** the change displays the slug date in YYYY-MM-DD format

#### Scenario: No changes
- **WHEN** there are no changes in the repo
- **THEN** system displays an empty state message

### Requirement: Change detail with tab navigation
The system SHALL display change details using a tabbed interface with tabs in OpenSpec workflow order: Proposal, Design, Specs (delta specs), and Tasks. Tab content SHALL transition with a fade-in animation when switching. The change title (including back navigation link) and tab navigation bar SHALL be sticky-positioned below the main header, remaining visible when the user scrolls through long content.

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

#### Scenario: Sticky header on scroll
- **WHEN** user scrolls down through long change content
- **THEN** the change title (with back link) and tab navigation bar SHALL remain fixed below the main application header
- **AND** the sticky area SHALL have an opaque background that covers scrolling content beneath it

#### Scenario: Sticky does not overlap main header
- **WHEN** the sticky area is active
- **THEN** it SHALL be positioned directly below the main header (top offset equal to header height) with a z-index lower than the main header and sidebar

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

### Requirement: Custom task checkbox styling
The system SHALL render task items in the Tasks tab using custom SVG icons instead of text-based `[x]`/`[ ]` markers. Completed tasks SHALL display a filled checkmark icon in green, and incomplete tasks SHALL display an empty circle icon. Completed task text SHALL have reduced opacity (0.6) in addition to the existing strikethrough styling.

#### Scenario: Incomplete task display
- **WHEN** a task item is not completed
- **THEN** the task displays an empty circle SVG icon followed by the task text at full opacity

#### Scenario: Completed task display
- **WHEN** a task item is completed
- **THEN** the task displays a green checkmark SVG icon followed by the task text with strikethrough and reduced opacity (0.6)
