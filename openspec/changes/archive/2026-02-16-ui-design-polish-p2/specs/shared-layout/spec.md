## MODIFIED Requirements

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

## ADDED Requirements

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
