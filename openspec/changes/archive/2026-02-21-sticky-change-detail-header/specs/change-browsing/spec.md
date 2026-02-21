## MODIFIED Requirements

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
