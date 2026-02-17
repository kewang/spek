## ADDED Requirements

### Requirement: Tab icon display
The Webview Panel SHALL display the spek logo as the tab icon for visual identification.

#### Scenario: Tab icon is set on panel creation
- **WHEN** the extension creates a Webview Panel
- **THEN** the panel's `iconPath` SHALL be set to the `webview/favicon.svg` file from the extension's bundled assets

#### Scenario: Icon visibility across themes
- **WHEN** the tab icon is displayed in either light or dark VS Code theme
- **THEN** the icon SHALL be visually distinguishable against the tab bar background
