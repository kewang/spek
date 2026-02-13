## ADDED Requirements

### Requirement: Header component
The system SHALL render a fixed header bar (56px height) containing: the "spek" logo/brand text (left), a search button placeholder (center), and the current repo path (right).

#### Scenario: Display header
- **WHEN** any page within the Layout is rendered
- **THEN** the header displays the spek brand, a disabled search button, and the current repo path from RepoContext

### Requirement: Sidebar navigation
The system SHALL render a fixed sidebar (240px width) with navigation links: Overview (Dashboard), Specs, and Changes. The current route SHALL be visually highlighted.

#### Scenario: Display sidebar links
- **WHEN** any page within the Layout is rendered
- **THEN** the sidebar shows navigation links for Overview, Specs, and Changes

#### Scenario: Highlight active route
- **WHEN** user is on the Dashboard page
- **THEN** the "Overview" link in the sidebar is highlighted with the accent color

### Requirement: TaskProgress component
The system SHALL provide a reusable TaskProgress component that displays a progress bar with completed/total count.

#### Scenario: Display progress
- **WHEN** TaskProgress is rendered with `completed=3` and `total=5`
- **THEN** a progress bar at 60% width is shown with text "3 / 5"

#### Scenario: Zero tasks
- **WHEN** TaskProgress is rendered with `total=0`
- **THEN** component displays "No tasks" or an empty state

### Requirement: TabView component
The system SHALL provide a reusable TabView component that renders tab headers and switches between tab content panels.

#### Scenario: Switch tabs
- **WHEN** user clicks a tab header
- **THEN** the corresponding tab content panel is displayed and the previous panel is hidden

#### Scenario: Default tab
- **WHEN** TabView is first rendered
- **THEN** the first tab is selected by default
