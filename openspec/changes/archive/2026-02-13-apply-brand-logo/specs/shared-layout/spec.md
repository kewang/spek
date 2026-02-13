## MODIFIED Requirements

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
