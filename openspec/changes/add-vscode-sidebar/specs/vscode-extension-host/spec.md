## MODIFIED Requirements

### Requirement: Extension activation
The extension SHALL activate when a workspace containing an `openspec/` directory is opened, or when the user explicitly invokes a spek command. Upon activation, the extension SHALL register TreeView providers for the sidebar and display the Activity Bar icon.

#### Scenario: Workspace with openspec directory
- **WHEN** VS Code opens a workspace where the first workspace folder contains an `openspec/` directory
- **THEN** the extension activates, displays a spek icon in the status bar, and registers the sidebar TreeView providers

#### Scenario: Workspace without openspec directory
- **WHEN** VS Code opens a workspace without an `openspec/` directory
- **THEN** the extension remains inactive, no status bar icon is shown, and the sidebar is hidden

#### Scenario: Manual activation via command
- **WHEN** the user invokes the `spek.open` command from the command palette
- **THEN** the extension activates and opens the spek Webview Panel

### Requirement: Webview Panel lifecycle
The extension SHALL manage a single Webview Panel instance for displaying the spek UI. The panel SHALL support navigation commands from the extension host.

#### Scenario: Open spek panel
- **WHEN** the user invokes `spek.open` and no panel exists
- **THEN** the extension creates a new Webview Panel in the active editor column with the title "spek"

#### Scenario: Focus existing panel
- **WHEN** the user invokes `spek.open` and a panel already exists
- **THEN** the extension reveals (focuses) the existing panel instead of creating a new one

#### Scenario: Panel disposal
- **WHEN** the user closes the spek Webview Panel
- **THEN** the extension cleans up the panel reference and associated message listeners

#### Scenario: Navigate panel to route
- **WHEN** the extension host sends a `navigate` message with a route path
- **THEN** the webview navigates to the specified route using React Router
