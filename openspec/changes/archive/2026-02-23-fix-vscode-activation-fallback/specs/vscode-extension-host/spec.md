## MODIFIED Requirements

### Requirement: Extension activation
The extension SHALL activate when a workspace containing an `openspec/` directory is opened, or when the user explicitly invokes a spek command. Upon activation, the extension SHALL register TreeView providers for the sidebar and display the Activity Bar icon.

#### Scenario: Workspace with openspec directory and config.yaml
- **WHEN** VS Code opens a workspace where the first workspace folder contains `openspec/config.yaml`
- **THEN** the extension activates, displays a spek icon in the status bar, and registers the sidebar TreeView providers

#### Scenario: Workspace with openspec directory without config.yaml
- **WHEN** VS Code opens a workspace where the first workspace folder contains `openspec/specs/` or `openspec/changes/` directory but no `openspec/config.yaml`
- **THEN** the extension activates, displays a spek icon in the status bar, and registers the sidebar TreeView providers

#### Scenario: Workspace without openspec directory
- **WHEN** VS Code opens a workspace without an `openspec/` directory, or with an empty `openspec/` directory containing neither `specs/` nor `changes/`
- **THEN** the extension remains inactive, no status bar icon is shown, and the sidebar is hidden

#### Scenario: Manual activation via command
- **WHEN** the user invokes the `spek.open` command from the command palette
- **THEN** the extension activates and opens the spek Webview Panel
