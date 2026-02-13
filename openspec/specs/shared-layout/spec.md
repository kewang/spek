## ADDED Requirements

### Requirement: Header component
The system SHALL render a fixed header bar (56px height) containing: an inline SVG logomark (S-curve with diamond accents, 24x24) followed by the "spek" brand text (left), a search button (center), and the current repo path (right, desktop only). On mobile viewports, the header SHALL include a hamburger menu button and hide the repo path. The header SHALL also include a theme toggle button. The logomark SVG SHALL use `currentColor` to follow the accent color, ensuring theme compatibility.

#### Scenario: Display header on desktop
- **WHEN** any page within the Layout is rendered on a viewport at or above 768px
- **THEN** the header displays the SVG logomark alongside "spek" brand text, search button, theme toggle, and current repo path

#### Scenario: Display header on mobile
- **WHEN** any page within the Layout is rendered on a viewport below 768px
- **THEN** the header displays a hamburger button, the SVG logomark alongside "spek" brand text, search button, and theme toggle, but hides the repo path

#### Scenario: Logo theme compatibility
- **WHEN** the user toggles between dark and light theme
- **THEN** the logomark color adjusts automatically via the accent color CSS variable

### Requirement: Sidebar navigation
The system SHALL render a sidebar with navigation links: Overview (Dashboard), Specs, and Changes. The current route SHALL be visually highlighted. On viewports below 768px, the sidebar SHALL be hidden by default and displayed as an overlay when toggled. On viewports at or above 768px, the sidebar SHALL be displayed in a fixed position (240px width).

#### Scenario: Display sidebar links
- **WHEN** any page within the Layout is rendered
- **THEN** the sidebar shows navigation links for Overview, Specs, and Changes

#### Scenario: Highlight active route
- **WHEN** user is on the Dashboard page
- **THEN** the "Overview" link in the sidebar is highlighted with the accent color

#### Scenario: Sidebar on mobile viewport
- **WHEN** the viewport is below 768px
- **THEN** the sidebar is hidden by default and only shown when the hamburger menu is activated

#### Scenario: Sidebar on desktop viewport
- **WHEN** the viewport is at or above 768px
- **THEN** the sidebar is displayed in its fixed position (240px width)

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
