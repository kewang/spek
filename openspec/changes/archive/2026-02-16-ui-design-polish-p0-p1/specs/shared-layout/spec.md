## MODIFIED Requirements

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

## ADDED Requirements

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
