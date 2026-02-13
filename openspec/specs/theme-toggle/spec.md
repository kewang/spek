## ADDED Requirements

### Requirement: Theme state management
The system SHALL provide a ThemeContext that manages the current theme ("dark" or "light") and exposes a toggle function. The theme state MUST be persisted in localStorage under the key `spek:theme`.

#### Scenario: Initialize from localStorage
- **WHEN** the application loads and localStorage contains a saved theme preference
- **THEN** the system applies the saved theme

#### Scenario: Initialize from system preference
- **WHEN** the application loads and no theme is saved in localStorage
- **AND** the user's system preference is light mode (`prefers-color-scheme: light`)
- **THEN** the system applies the light theme

#### Scenario: Initialize default
- **WHEN** the application loads and no theme is saved and no system preference is detected
- **THEN** the system applies the dark theme as default

#### Scenario: Toggle theme
- **WHEN** the user triggers the theme toggle
- **THEN** the current theme switches (dark → light or light → dark)
- **AND** the new preference is saved to localStorage
- **AND** the `data-theme` attribute on `<html>` is updated

### Requirement: Light theme CSS variables
The system SHALL define a complete set of light theme CSS variables that override the dark theme defaults when `[data-theme="light"]` is set on the `<html>` element.

#### Scenario: Light theme applied
- **WHEN** the `<html>` element has `data-theme="light"`
- **THEN** all color CSS variables (`--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-accent`, `--color-accent-hover`) are overridden with light-appropriate values

#### Scenario: Dark theme applied
- **WHEN** the `<html>` element has `data-theme="dark"` or no `data-theme` attribute
- **THEN** the default dark theme CSS variables are used

### Requirement: Theme toggle button
The system SHALL display a theme toggle button in the header. The button MUST show a sun icon when in dark mode (indicating "switch to light") and a moon icon when in light mode (indicating "switch to dark").

#### Scenario: Display toggle in header
- **WHEN** any page within the Layout is rendered
- **THEN** a theme toggle button is visible in the header area

#### Scenario: Icon reflects current theme
- **WHEN** the current theme is dark
- **THEN** the toggle button displays a sun icon
- **WHEN** the current theme is light
- **THEN** the toggle button displays a moon icon
