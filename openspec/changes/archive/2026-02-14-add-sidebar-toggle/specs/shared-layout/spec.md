## MODIFIED Requirements

### Requirement: Sidebar navigation
The system SHALL render a sidebar with navigation links: Overview (Dashboard), Specs, and Changes. Each link SHALL have an associated icon (LayoutDashboard for Overview, FileText for Specs, GitBranch for Changes). The current route SHALL be visually highlighted. On viewports below 768px, the sidebar SHALL be hidden by default and displayed as an overlay when toggled. On viewports at or above 768px, the sidebar SHALL support two states: expanded (240px width, showing icons and labels) and collapsed (56px width, showing icons only). A toggle button at the bottom of the sidebar SHALL switch between states. The main content area left margin SHALL adjust to match the current sidebar width.

#### Scenario: Display sidebar links
- **WHEN** any page within the Layout is rendered
- **THEN** the sidebar shows navigation links for Overview, Specs, and Changes with corresponding icons

#### Scenario: Highlight active route
- **WHEN** user is on the Dashboard page
- **THEN** the "Overview" link in the sidebar is highlighted with the accent color

#### Scenario: Sidebar on mobile viewport
- **WHEN** the viewport is below 768px
- **THEN** the sidebar is hidden by default and only shown when the hamburger menu is activated

#### Scenario: Sidebar expanded on desktop viewport
- **WHEN** the viewport is at or above 768px and sidebar is expanded
- **THEN** the sidebar is displayed at 240px width with icons and text labels, and main content has matching left margin

#### Scenario: Sidebar collapsed on desktop viewport
- **WHEN** the viewport is at or above 768px and sidebar is collapsed
- **THEN** the sidebar is displayed at 56px width with icons only, and main content has matching left margin
