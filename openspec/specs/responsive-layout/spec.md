## ADDED Requirements

### Requirement: Mobile breakpoint detection
The system SHALL detect whether the viewport width is below 768px and adapt the layout accordingly. The detection MUST use `window.matchMedia` and respond to runtime viewport changes (e.g., device rotation).

#### Scenario: Viewport below 768px
- **WHEN** the viewport width is less than 768px
- **THEN** the sidebar is hidden by default and a hamburger menu button appears in the header

#### Scenario: Viewport at or above 768px
- **WHEN** the viewport width is 768px or greater
- **THEN** the sidebar is displayed in its fixed position and the hamburger menu button is hidden

#### Scenario: Viewport resize crossing breakpoint
- **WHEN** the viewport is resized from below 768px to at or above 768px
- **THEN** the sidebar transitions to fixed display and the hamburger menu button is hidden

### Requirement: Mobile sidebar overlay
The system SHALL display the sidebar as a full-height overlay with a backdrop when opened on viewports below 768px.

#### Scenario: Open mobile sidebar
- **WHEN** the user taps the hamburger menu button on a mobile viewport
- **THEN** the sidebar slides in from the left as an overlay with a semi-transparent backdrop behind it

#### Scenario: Close mobile sidebar via backdrop
- **WHEN** the mobile sidebar overlay is open and the user taps the backdrop area
- **THEN** the sidebar closes and the backdrop disappears

#### Scenario: Close mobile sidebar via navigation
- **WHEN** the mobile sidebar overlay is open and the user taps a navigation link
- **THEN** the system navigates to the selected route and the sidebar closes automatically

### Requirement: Responsive content grids
The system SHALL adapt grid layouts for different viewport sizes. Dashboard stat cards MUST use 2 columns on mobile and 4 columns on desktop. Navigation cards MUST stack vertically on mobile.

#### Scenario: Dashboard stat cards on mobile
- **WHEN** the Dashboard page is rendered on a viewport below 768px
- **THEN** the stat cards are displayed in a 2-column grid

#### Scenario: Dashboard stat cards on desktop
- **WHEN** the Dashboard page is rendered on a viewport at or above 768px
- **THEN** the stat cards are displayed in a 4-column grid

### Requirement: Responsive header
The system SHALL adapt the header layout for mobile viewports. The repo path display MUST be hidden on mobile to save space. The search button MUST remain accessible.

#### Scenario: Header on mobile
- **WHEN** the header is rendered on a viewport below 768px
- **THEN** the hamburger button is shown on the left, the search button is centered, and the repo path is hidden

#### Scenario: Header on desktop
- **WHEN** the header is rendered on a viewport at or above 768px
- **THEN** the layout shows the spek brand on the left, search button centered, and repo path on the right
