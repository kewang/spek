## ADDED Requirements

### Requirement: Extension activation
The extension SHALL activate when a workspace containing an `openspec/` directory is opened, or when the user explicitly invokes a spek command.

#### Scenario: Workspace with openspec directory
- **WHEN** VS Code opens a workspace where the first workspace folder contains an `openspec/` directory
- **THEN** the extension activates and displays a spek icon in the status bar

#### Scenario: Workspace without openspec directory
- **WHEN** VS Code opens a workspace without an `openspec/` directory
- **THEN** the extension remains inactive and no status bar icon is shown

#### Scenario: Manual activation via command
- **WHEN** the user invokes the `spek.open` command from the command palette
- **THEN** the extension activates and opens the spek Webview Panel

### Requirement: Webview Panel lifecycle
The extension SHALL manage a single Webview Panel instance for displaying the spek UI.

#### Scenario: Open spek panel
- **WHEN** the user invokes `spek.open` and no panel exists
- **THEN** the extension creates a new Webview Panel in the active editor column with the title "spek"

#### Scenario: Focus existing panel
- **WHEN** the user invokes `spek.open` and a panel already exists
- **THEN** the extension reveals (focuses) the existing panel instead of creating a new one

#### Scenario: Panel disposal
- **WHEN** the user closes the spek Webview Panel
- **THEN** the extension cleans up the panel reference and associated message listeners

### Requirement: Command registration
The extension SHALL register commands in the VS Code command palette.

#### Scenario: Available commands
- **WHEN** the extension is active
- **THEN** the following commands are available: `spek.open` (Open spek) and `spek.search` (Search OpenSpec)

#### Scenario: Search command
- **WHEN** the user invokes `spek.search`
- **THEN** the extension opens (or focuses) the spek panel and sends a message to trigger the search dialog

### Requirement: Message handler for API requests
The extension host SHALL handle message-based API requests from the Webview and return responses using core module functions.

#### Scenario: Handle API request
- **WHEN** the Webview sends a message `{ type: 'request', id: 'req-1', method: 'getOverview' }`
- **THEN** the extension host calls the corresponding core module function and replies with `{ type: 'response', id: 'req-1', data: <result> }`

#### Scenario: Handle API error
- **WHEN** the Webview sends a request and the core module function throws an error
- **THEN** the extension host replies with `{ type: 'response', id: 'req-1', error: <error message> }`
