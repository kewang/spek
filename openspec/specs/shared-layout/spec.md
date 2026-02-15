## ADDED Requirements

### Requirement: Header component
The system SHALL render a fixed header bar (56px height) containing: an inline SVG logomark (S-curve with diamond accents, 24x24) followed by the "spek" brand text (left), a search button (center), and the current repo path (right, desktop only). On mobile viewports, the header SHALL include a hamburger menu button with `aria-label="Open navigation menu"` and hide the repo path. The header SHALL also include a theme toggle button. The logomark SVG SHALL use `currentColor` to follow the accent color, ensuring theme compatibility.

#### Scenario: Display header on desktop
- **WHEN** any page within the Layout is rendered on a viewport at or above 768px
- **THEN** the header displays the SVG logomark alongside "spek" brand text, search button, theme toggle, and current repo path

#### Scenario: Display header on mobile
- **WHEN** any page within the Layout is rendered on a viewport below 768px
- **THEN** the header displays a hamburger button with `aria-label="Open navigation menu"`, the SVG logomark alongside "spek" brand text, search button, and theme toggle, but hides the repo path

#### Scenario: Logo theme compatibility
- **WHEN** the user toggles between dark and light theme
- **THEN** the logomark color adjusts automatically via the accent color CSS variable

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

### Requirement: TaskProgress component
The system SHALL provide a reusable TaskProgress component that displays a progress bar with completed/total count. The progress bar color SHALL reflect completion status: amber/accent color when incomplete, green when all tasks are completed (completed equals total).

#### Scenario: Display progress
- **WHEN** TaskProgress is rendered with `completed=3` and `total=5`
- **THEN** a progress bar at 60% width is shown in amber/accent color with text "3 / 5"

#### Scenario: Display completed progress
- **WHEN** TaskProgress is rendered with `completed=5` and `total=5`
- **THEN** a progress bar at 100% width is shown in green color with text "5 / 5"

#### Scenario: Zero tasks
- **WHEN** TaskProgress is rendered with `total=0`
- **THEN** component displays "No tasks" or an empty state

### Requirement: TabView component
The system SHALL provide a reusable TabView component that renders tab headers and switches between tab content panels. When switching tabs, the new content panel SHALL fade in with a 150ms CSS animation.

#### Scenario: Switch tabs
- **WHEN** user clicks a tab header
- **THEN** the corresponding tab content panel is displayed with a fade-in animation (150ms duration) and the previous panel is hidden

#### Scenario: Default tab
- **WHEN** TabView is first rendered
- **THEN** the first tab is selected by default

#### Scenario: Reduced motion preference
- **WHEN** user has `prefers-reduced-motion: reduce` enabled
- **THEN** tab content switches instantly without fade animation

### Requirement: Custom typography
The system SHALL use "Plus Jakarta Sans" as the primary font family for all UI text, loaded via Google Fonts CDN. The font stack SHALL include `sans-serif` as fallback for offline environments. Code and monospace text SHALL continue to use "JetBrains Mono".

#### Scenario: Font loading
- **WHEN** the application loads in a browser with internet access
- **THEN** "Plus Jakarta Sans" is loaded and applied to all non-code text elements

#### Scenario: Font fallback
- **WHEN** the application loads without internet access (or Google Fonts is blocked)
- **THEN** the browser falls back to the system default sans-serif font

#### Scenario: Reduced motion preference
- **WHEN** the user has `prefers-reduced-motion: reduce` set in their OS/browser
- **THEN** all CSS entry animations are disabled

### Requirement: Main content area top spacing
The system SHALL render the main content area with sufficient top spacing below the fixed header to provide visual breathing room between the navbar and page content. The top padding SHALL be at least 72px (header height 56px + 16px spacing).

#### Scenario: Page title spacing
- **WHEN** any page is rendered within the Layout
- **THEN** the first content element (typically h1) has at least 16px of visual spacing below the header bar

### Requirement: Back navigation link styling
The system SHALL render back navigation links (e.g., "← Back to Specs", "← Back to Changes") at base font size (16px) with medium font weight for adequate visibility and clickability.

#### Scenario: Back link display
- **WHEN** user views a detail page (SpecDetail or ChangeDetail)
- **THEN** the back navigation link is displayed at 16px font size with medium weight, muted color, and accent color on hover
