## MODIFIED Requirements

### Requirement: Sidebar navigation
The system SHALL render a sidebar with navigation links: Overview (Dashboard), Specs, Changes, and Graph. Each link SHALL have an associated icon (LayoutDashboard for Overview, FileText for Specs, GitBranch for Changes, Share2 for Graph). The current route SHALL be visually highlighted. On viewports below 768px, the sidebar SHALL be hidden by default and displayed as an overlay when toggled. On viewports at or above 768px, the sidebar SHALL support two states: expanded (240px width, showing icons and labels) and collapsed (56px width, showing icons only). A toggle button at the bottom of the sidebar SHALL switch between states. The main content area left margin SHALL adjust to match the current sidebar width.

#### Scenario: Display sidebar links
- **WHEN** any page within the Layout is rendered
- **THEN** the sidebar shows navigation links for Overview, Specs, Changes, and Graph with corresponding icons

#### Scenario: Highlight active route
- **WHEN** user is on the Graph page
- **THEN** the "Graph" link in the sidebar is highlighted with the accent color

#### Scenario: Sidebar on mobile viewport
- **WHEN** the viewport is below 768px
- **THEN** the sidebar is hidden by default and only shown when the hamburger menu is activated

#### Scenario: Sidebar expanded on desktop viewport
- **WHEN** the viewport is at or above 768px and sidebar is expanded
- **THEN** the sidebar is displayed at 240px width with icons and text labels, and main content has matching left margin

#### Scenario: Sidebar collapsed on desktop viewport
- **WHEN** the viewport is at or above 768px and sidebar is collapsed
- **THEN** the sidebar is displayed at 56px width with icons only, and main content has matching left margin
